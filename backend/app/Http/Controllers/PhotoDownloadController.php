<?php

namespace App\Http\Controllers;

use App\Services\DrivePublicDownloader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;
use ZipArchive;

class PhotoDownloadController extends Controller
{
    public function __construct(private DrivePublicDownloader $downloader)
    {
    }

    /**
     * Diagnostics for the download pipeline. Open in a browser to see exactly
     * why ZIP downloads fail (zip extension, temp-dir writability, limits, and
     * whether a single Drive file can actually be fetched from this server).
     *
     * Query: ?file_id=<a-public-drive-file-id> to test a real fetch.
     */
    public function diagnostics(Request $request): JsonResponse
    {
        $dir = storage_path('app/tmp');
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $tmpWritable = false;
        $tmpError = null;
        try {
            $probe = tempnam($dir, 'mfdiag');
            if ($probe !== false) {
                $tmpWritable = @file_put_contents($probe, 'ok') !== false;
                @unlink($probe);
            }
        } catch (Throwable $e) {
            $tmpError = $e->getMessage();
        }

        $fetch = null;
        $fileId = $request->query('file_id');
        if (is_string($fileId) && $fileId !== '') {
            $part = @tempnam($dir, 'mffetch');
            try {
                $ok = $part !== false
                    && $this->downloader->downloadToFile($fileId, $part);
                $fetch = [
                    'file_id' => $fileId,
                    'ok' => (bool) $ok,
                    'bytes' => $ok && $part ? (int) @filesize($part) : 0,
                ];
            } catch (Throwable $e) {
                $fetch = ['file_id' => $fileId, 'ok' => false, 'error' => $e->getMessage()];
            } finally {
                if ($part !== false) {
                    @unlink($part);
                }
            }
        }

        return response()->json([
            'php_version' => PHP_VERSION,
            'zip_extension' => class_exists(ZipArchive::class),
            'tmp_dir' => $dir,
            'tmp_dir_exists' => is_dir($dir),
            'tmp_dir_writable' => $tmpWritable,
            'tmp_dir_error' => $tmpError,
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'allow_url_fopen' => (bool) ini_get('allow_url_fopen'),
            'curl_extension' => extension_loaded('curl'),
            'fetch_test' => $fetch,
        ]);
    }

    /**
     * Build a ZIP of the given Google Drive photos and return it.
     *
     * Request body:
     *   album   string   album/couple name (used for the zip filename)
     *   type    string   bride|groom|both|all (used for the zip filename)
     *   files   array    [{ file_id: string, file_name?: string }, ...]
     *
     * The files are PUBLIC Drive files; no Google credentials are required.
     * Returns 422 JSON if none of the files could be fetched.
     */
    public function zip(Request $request): BinaryFileResponse|JsonResponse
    {
        $data = $request->validate([
            'album' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:32'],
            'files' => ['required', 'array', 'min:1'],
            'files.*.file_id' => ['required', 'string', 'max:255'],
            'files.*.file_name' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            DrivePublicDownloader::assertZipSupport();
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        // Large galleries take a while to fetch + zip; don't let PHP abort.
        @set_time_limit(0);
        @ini_set('memory_limit', '1024M');
        // Guard against a single request trying to zip an unbounded set.
        if (count($data['files']) > 400) {
            return response()->json([
                'message' => 'Too many photos in one download (max 400). '
                    . 'Please download this event in smaller batches.',
            ], 413);
        }

        $albumSlug = $this->slug($data['album'] ?? 'album');
        $typeSlug = $this->slug($data['type'] ?? 'selected');
        $zipName = "{$albumSlug}_{$typeSlug}_photos.zip";

        // Work in a writable app-owned temp dir (the system temp dir isn't
        // reliably writable on shared hosting).
        $base = storage_path('app/tmp');
        if (! is_dir($base)) {
            @mkdir($base, 0775, true);
        }
        // Per-request working folder; downloaded files live here, then we zip
        // the folder and remove it.
        $work = $base . '/' . uniqid('mfzip_', true);
        if (! @mkdir($work, 0775, true)) {
            return response()->json([
                'message' => 'Could not create a working folder for the download.',
            ], 500);
        }
        $tmp = $base . '/' . uniqid('mfarc_', true) . '.zip';

        $added = 0;
        $used = [];
        try {
            // 1) Stream every file to disk (constant memory — no full buffer).
            foreach ($data['files'] as $i => $f) {
                $part = $work . '/' . sprintf('%04d', $i) . '.bin';
                $ok = false;
                try {
                    $ok = $this->downloader->downloadToFile($f['file_id'], $part);
                } catch (Throwable) {
                    $ok = false;
                }
                if (! $ok) {
                    @unlink($part);
                    continue; // skip unreachable files, keep going
                }

                $rawName = $f['file_name'] ?? $f['file_id'];
                $name = $this->withExtensionFromFile($rawName, $part);
                $name = $this->uniqueName($name, $i, $used);
                // Rename to the final in-zip filename so we can zip by folder.
                $dest = $work . '/' . $name;
                if (@rename($part, $dest)) {
                    $added++;
                } else {
                    @unlink($part);
                }
            }

            if ($added === 0) {
                $this->rrmdir($work);
                return response()->json([
                    'message' => 'None of the selected photos could be downloaded. '
                        . 'Make sure the Drive folder is shared “Anyone with the link”.',
                ], 422);
            }

            // 2) Build the zip. Prefer the system `zip` binary (near-zero PHP
            // memory); fall back to a chunked ZipArchive if it's unavailable.
            if (! $this->zipWithSystemBinary($work, $tmp)
                && ! $this->zipWithArchive($work, $tmp)) {
                throw new \RuntimeException('No working zip method on this host.');
            }
        } catch (Throwable $e) {
            Log::error('ZIP build failed: ' . $e->getMessage(), ['exception' => $e]);
            $this->rrmdir($work);
            @unlink($tmp);

            return response()->json([
                'message' => 'The server could not build this ZIP. '
                    . 'Please try again, or download in smaller batches.',
            ], 500);
        }

        // Working folder no longer needed; the zip has everything.
        $this->rrmdir($work);

        // Send the file and delete it afterwards.
        return response()
            ->download($tmp, $zipName, ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
    }

    /**
     * Zip a folder with the system `zip` binary. Returns false if `zip` isn't
     * available or the command fails. Uses almost no PHP memory.
     */
    private function zipWithSystemBinary(string $folder, string $zipPath): bool
    {
        if (! function_exists('exec')) {
            return false;
        }
        // Is there a `zip` on PATH?
        @exec('command -v zip 2>/dev/null', $which, $code);
        if ($code !== 0 || empty($which)) {
            return false;
        }
        $cmd = 'cd ' . escapeshellarg($folder)
            . ' && zip -q -0 -r ' . escapeshellarg($zipPath) . ' .';
        @exec($cmd, $out, $status);

        return $status === 0 && is_file($zipPath) && filesize($zipPath) > 0;
    }

    /**
     * Fallback: build the zip with ZipArchive, flushing to disk every few
     * files (close + reopen) so memory doesn't grow with the gallery size.
     */
    private function zipWithArchive(string $folder, string $zipPath): bool
    {
        $files = array_values(array_filter(
            scandir($folder) ?: [],
            fn ($n) => $n !== '.' && $n !== '..',
        ));
        if (empty($files)) {
            return false;
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        $sinceFlush = 0;
        foreach ($files as $name) {
            $zip->addFile($folder . '/' . $name, $name);
            // Store (no compression) — photos are already compressed, and it
            // keeps CPU/memory low.
            $zip->setCompressionName($name, ZipArchive::CM_STORE);
            if (++$sinceFlush >= 20) {
                // Flush what's queued to disk and reopen to release memory.
                if (! $zip->close()) {
                    return false;
                }
                $sinceFlush = 0;
                if ($zip->open($zipPath) !== true) {
                    return false;
                }
            }
        }

        return $zip->close() && is_file($zipPath) && filesize($zipPath) > 0;
    }

    /** Recursively delete a directory and its contents. */
    private function rrmdir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . '/' . $entry;
            is_dir($path) ? $this->rrmdir($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    /**
     * Download a SINGLE public Drive photo directly as an image (no ZIP).
     *
     * Request body:
     *   file_id    string   the Drive file id (required)
     *   file_name  string   suggested filename (optional)
     */
    public function file(Request $request): StreamedResponse|JsonResponse
    {
        $data = $request->validate([
            'file_id' => ['required', 'string', 'max:255'],
            'file_name' => ['nullable', 'string', 'max:255'],
        ]);

        @set_time_limit(0);

        try {
            $bytes = $this->downloader->download($data['file_id']);
        } catch (Throwable) {
            $bytes = null;
        }

        if ($bytes === null) {
            return response()->json([
                'message' => 'That photo could not be downloaded. Make sure the '
                    . 'Drive folder is shared “Anyone with the link”.',
            ], 422);
        }

        $name = $this->withExtension($data['file_name'] ?? $data['file_id'], $bytes);
        $mime = $this->mimeFor($bytes);

        return response()->streamDownload(function () use ($bytes) {
            echo $bytes;
        }, $name, [
            'Content-Type' => $mime,
            'Content-Length' => (string) strlen($bytes),
        ]);
    }

    /** Map detected bytes to an image MIME type. */
    private function mimeFor(string $bytes): string
    {
        return match ($this->detectExtension($bytes)) {
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'bmp' => 'image/bmp',
            default => 'image/jpeg',
        };
    }

    /**
     * Ensure the filename ends in a real image extension. If it already has a
     * common image extension, keep it; otherwise detect the type from the
     * bytes (magic numbers) and append the right one so files preview on all
     * operating systems.
     */
    private function withExtension(string $name, string $bytes): string
    {
        if (preg_match('/\.(jpe?g|png|webp|gif|heic|tiff?|bmp)$/i', $name)) {
            return $name;
        }
        $ext = $this->detectExtension($bytes);
        return $name . '.' . $ext;
    }

    /**
     * Same as withExtension() but reads only the first bytes of a file on disk
     * (so we never load the whole image into memory just to name it).
     */
    private function withExtensionFromFile(string $name, string $path): string
    {
        if (preg_match('/\.(jpe?g|png|webp|gif|heic|tiff?|bmp)$/i', $name)) {
            return $name;
        }
        $head = (string) @file_get_contents($path, false, null, 0, 12);
        return $name . '.' . $this->detectExtension($head);
    }

    private function detectExtension(string $bytes): string
    {
        $head = substr($bytes, 0, 12);
        if (str_starts_with($head, "\xFF\xD8\xFF")) {
            return 'jpg';
        }
        if (str_starts_with($head, "\x89PNG")) {
            return 'png';
        }
        if (str_starts_with($head, 'GIF8')) {
            return 'gif';
        }
        if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') {
            return 'webp';
        }
        if (str_starts_with($head, 'BM')) {
            return 'bmp';
        }
        return 'jpg'; // sensible default for wedding photos
    }

    private function slug(string $value): string
    {
        $slug = preg_replace('/[^a-z0-9]+/i', '_', $value) ?? '';
        return trim($slug, '_') ?: 'album';
    }

    /**
     * Keep filenames unique inside the zip (duplicates would overwrite).
     *
     * @param  array<string, bool>  $used
     */
    private function uniqueName(string $name, int $index, array &$used): string
    {
        $candidate = $name;
        if (isset($used[$candidate])) {
            $dot = strrpos($name, '.');
            if ($dot !== false) {
                $candidate = substr($name, 0, $dot) . "_{$index}" . substr($name, $dot);
            } else {
                $candidate = "{$name}_{$index}";
            }
        }
        $used[$candidate] = true;
        return $candidate;
    }
}
