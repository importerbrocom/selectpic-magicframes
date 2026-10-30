<?php

namespace App\Http\Controllers;

use App\Services\DrivePublicDownloader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
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

        DrivePublicDownloader::assertZipSupport();

        // Large galleries take a while to fetch + zip; don't let PHP abort.
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

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
        foreach ($data['files'] as $i => $f) {
            try {
                $bytes = $this->downloader->download($f['file_id']);
            } catch (Throwable) {
                $bytes = null;
            }
            if ($bytes === null) {
                continue; // skip unreachable files, keep going
            }
            $base = $f['file_name'] ?? $f['file_id'];
            $name = $this->withExtension($base, $bytes);
            $name = $this->uniqueName($name, $i, $used);
            $zip->addFromString($name, $bytes);
            $added++;
        }

        $zip->close();

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
