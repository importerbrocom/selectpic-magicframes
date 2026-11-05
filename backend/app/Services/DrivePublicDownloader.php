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
     * Stream a GET to a file. Returns true if a non-HTML, non-empty body was
     * written; null if the response looked like an HTML page (caller should
     * try the fallback host); false on transport failure.
     */
    private function streamTo(string $url, array $query, string $path): ?bool
    {
        try {
            $response = Http::withOptions([
                'allow_redirects' => true,
                'sink' => $path,
            ])->timeout(180)->get($url, $query);
        } catch (\Throwable) {
            return false;
        }

        if (! $response->successful()) {
            return false;
        }

        $ct = strtolower($response->header('Content-Type') ?? '');
        if (str_contains($ct, 'text/html')) {
            return null;
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
