<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Downloads the bytes of a PUBLIC ("anyone with the link") Google Drive file
 * without requiring Google API credentials.
 *
 * It hits the user-facing download endpoint and, for larger files, follows
 * Google's "can't scan for viruses" confirmation step. This matches the app's
 * public-folder model (the same folders the frontend reads with an API key),
 * so no service account is needed just to build ZIPs.
 */
class DrivePublicDownloader
{
    private const BASE = 'https://drive.google.com/uc?export=download';

    private const USERCONTENT = 'https://drive.usercontent.google.com/download';

    /**
     * Fetch a public Drive file's raw bytes. Returns null if it can't be
     * retrieved (so the caller can skip it and continue the ZIP).
     */
    public function download(string $fileId): ?string
    {
        $response = Http::withOptions(['allow_redirects' => true])
            ->timeout(60)
            ->get(self::BASE, ['id' => $fileId]);

        if (! $response->successful()) {
            return $this->downloadViaUsercontent($fileId);
        }

        $body = $response->body();
        $contentType = strtolower($response->header('Content-Type') ?? '');

        // Small files come straight back. Large files return an HTML page with
        // a confirmation token that must be echoed back to get the bytes.
        if (str_contains($contentType, 'text/html')) {
            $confirm = $this->extractConfirmToken($body);
            if ($confirm === null) {
                // Newer Drive responses no longer embed a token on this host;
                // the usercontent endpoint serves the bytes directly.
                return $this->downloadViaUsercontent($fileId);
            }
            $response = Http::withOptions(['allow_redirects' => true])
                ->timeout(120)
                ->get(self::BASE, [
                    'id' => $fileId,
                    'confirm' => $confirm,
                ]);
            if (! $response->successful()) {
                return $this->downloadViaUsercontent($fileId);
            }
            $body = $response->body();
            // Still HTML => not actually downloadable (private / not found).
            $ct = strtolower($response->header('Content-Type') ?? '');
            if (str_contains($ct, 'text/html')) {
                return $this->downloadViaUsercontent($fileId);
            }
        }

        return $body !== '' ? $body : null;
    }

    /**
     * Fallback host that Google now uses for large public downloads. It
     * returns the bytes directly (with a confirm param when prompted).
     */
    private function downloadViaUsercontent(string $fileId): ?string
    {
        foreach (['', 't'] as $confirm) {
            $params = ['id' => $fileId, 'export' => 'download'];
            if ($confirm !== '') {
                $params['confirm'] = $confirm;
            }
            $response = Http::withOptions(['allow_redirects' => true])
                ->timeout(120)
                ->get(self::USERCONTENT, $params);

            if (! $response->successful()) {
                continue;
            }
            $ct = strtolower($response->header('Content-Type') ?? '');
            $body = $response->body();
            if (! str_contains($ct, 'text/html') && $body !== '') {
                return $body;
            }
        }

        return null;
    }

    /**
     * Stream a public Drive file straight to a local path (no full in-memory
     * buffer). Returns true on success. Used by the ZIP builder so large
     * galleries don't exhaust PHP's memory.
     */
    public function downloadToFile(string $fileId, string $path): bool
    {
        // First attempt: main endpoint streamed to disk.
        $ok = $this->streamTo(self::BASE, ['id' => $fileId], $path);
        if ($ok === true) {
            return true;
        }
        // $ok === null means we got an HTML interstitial; fall back.
        return $this->streamTo(
            self::USERCONTENT,
            ['id' => $fileId, 'export' => 'download', 'confirm' => 't'],
            $path,
        ) === true;
    }

    /**
     * Stream a GET straight to a file using cURL writing to a file handle, so
     * the full body is NEVER held in memory (critical on shared hosts). cURL
     * is the most reliable transport on cPanel/LiteSpeed.
     *
     * Returns true if a non-HTML, non-empty body was written; null if the
     * response looked like an HTML page (caller should try the fallback host);
     * false on transport failure.
     */
    private function streamTo(string $url, array $query, string $path): ?bool
    {
        if (! function_exists('curl_init')) {
            return $this->streamToViaFopen($url, $query, $path);
        }

        $full = $url . '?' . http_build_query($query);
        $out = @fopen($path, 'wb');
        if ($out === false) {
            return false;
        }

        $contentType = '';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $full,
            CURLOPT_FILE => $out,            // write body directly to disk
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 6,
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'MagicFrames/1.0',
            CURLOPT_HEADERFUNCTION => function ($c, $header) use (&$contentType) {
                if (stripos($header, 'Content-Type:') === 0) {
                    $contentType = strtolower(trim(substr($header, 13)));
                }
                return strlen($header);
            },
        ]);
        $ok = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($out);

        if ($ok === false || $status >= 400) {
            return false;
        }
        if (str_contains($contentType, 'text/html')) {
            return null; // interstitial / error page — try the fallback host
        }

        return (is_file($path) && filesize($path) > 0) ? true : false;
    }

    /**
     * Fallback transport when cURL is unavailable: fopen HTTP wrapper, read in
     * 256KB chunks (still constant memory).
     */
    private function streamToViaFopen(string $url, array $query, string $path): ?bool
    {
        $full = $url . '?' . http_build_query($query);
        $in = null;
        $out = null;
        try {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'follow_location' => 1,
                    'timeout' => 300,
                    'header' => "User-Agent: MagicFrames/1.0\r\n",
                    'ignore_errors' => true,
                ],
                'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
            ]);
            $in = @fopen($full, 'rb', false, $context);
            if ($in === false) {
                return false;
            }
            $meta = stream_get_meta_data($in);
            $contentType = '';
            $status = 200;
            foreach ($meta['wrapper_data'] ?? [] as $h) {
                if (stripos($h, 'Content-Type:') === 0) {
                    $contentType = strtolower(trim(substr($h, 13)));
                }
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                    $status = (int) $m[1];
                }
            }
            if ($status >= 400) {
                return false;
            }
            if (str_contains($contentType, 'text/html')) {
                return null;
            }
            $out = @fopen($path, 'wb');
            if ($out === false) {
                return false;
            }
            while (! feof($in)) {
                $chunk = fread($in, 262144);
                if ($chunk === false) {
                    break;
                }
                fwrite($out, $chunk);
            }
        } catch (\Throwable) {
            return false;
        } finally {
            if (is_resource($in)) {
                fclose($in);
            }
            if (is_resource($out)) {
                fclose($out);
            }
        }

        return (is_file($path) && filesize($path) > 0) ? true : false;
    }

    private function extractConfirmToken(string $html): ?string
    {
        if (preg_match('/confirm=([0-9A-Za-z_-]+)/', $html, $m)) {
            return $m[1];
        }
        if (preg_match('/name="confirm"\s+value="([^"]+)"/', $html, $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Ensure the PHP zip extension is available before attempting a ZIP build.
     */
    public static function assertZipSupport(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            throw new RuntimeException(
                'The PHP zip extension (ext-zip) is required to build downloads.'
            );
        }
    }
}
