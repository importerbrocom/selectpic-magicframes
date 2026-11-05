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

        // Build the archive in a writable app-owned temp dir (the system temp
        // dir isn't reliably writable on shared hosting).
        $dir = storage_path('app/tmp');
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $tmp = tempnam($dir, 'mfzip');
        if ($tmp === false) {
            return response()->json([
                'message' => 'Could not create a temporary file for the download.',
            ], 500);
        }

        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            @unlink($tmp);
            return response()->json([
                'message' => 'Could not open the ZIP archive for writing.',
            ], 500);
        }

        $added = 0;
        $used = [];
        $parts = []; // temp files to clean up after the zip is built
        try {
            foreach ($data['files'] as $i => $f) {
                // Stream each download to its own temp file so we never hold a
                // whole gallery of full-res originals in memory at once.
                $part = tempnam($dir, 'mfpart');
                if ($part === false) {
                    continue;
                }
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
                $parts[] = $part;

                $base = $f['file_name'] ?? $f['file_id'];
                $name = $this->withExtensionFromFile($base, $part);
                $name = $this->uniqueName($name, $i, $used);
                $zip->addFile($part, $name);
                $added++;
            }

            // close() is where the archive is actually written to disk.
            if (! $zip->close()) {
                throw new \RuntimeException('ZipArchive::close() failed');
            }
        } catch (Throwable $e) {
            Log::error('ZIP build failed: ' . $e->getMessage(), ['exception' => $e]);
            @$zip->close();
            @unlink($tmp);
            foreach ($parts as $p) {
                @unlink($p);
            }

            return response()->json([
                'message' => 'The server could not build this ZIP. '
                    . 'Try downloading fewer photos at a time.',
            ], 500);
        }

        // Parts are already written into the zip; remove the loose copies.
        foreach ($parts as $p) {
            @unlink($p);
        }

        if ($added === 0) {
            @unlink($tmp);
            return response()->json([
                'message' => 'None of the selected photos could be downloaded. '
                    . 'Make sure the Drive folder is shared “Anyone with the link”.',
            ], 422);
        }

        // Send the file and delete it afterwards.
        return response()
            ->download($tmp, $zipName, ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
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
