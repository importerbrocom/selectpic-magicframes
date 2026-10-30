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
            $name = $f['file_name'] ?? ($f['file_id'] . '.jpg');
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
