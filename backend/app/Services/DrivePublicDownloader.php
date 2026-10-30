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
            return null;
        }

        $body = $response->body();
        $contentType = strtolower($response->header('Content-Type') ?? '');

        // Small files come straight back. Large files return an HTML page with
        // a confirmation token that must be echoed back to get the bytes.
        if (str_contains($contentType, 'text/html')) {
            $confirm = $this->extractConfirmToken($body);
            if ($confirm === null) {
                return null;
            }
            $response = Http::withOptions(['allow_redirects' => true])
                ->timeout(120)
                ->get(self::BASE, [
                    'id' => $fileId,
                    'confirm' => $confirm,
                ]);
            if (! $response->successful()) {
                return null;
            }
            $body = $response->body();
            // Still HTML => not actually downloadable (private / not found).
            $ct = strtolower($response->header('Content-Type') ?? '');
            if (str_contains($ct, 'text/html')) {
                return null;
            }
        }

        return $body !== '' ? $body : null;
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
