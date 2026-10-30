<?php

namespace App\Http\Controllers;

use App\Services\DrivePublicDownloader;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;
use ZipArchive;

class PhotoDownloadController extends Controller
{
    public function __construct(private DrivePublicDownloader $downloader)
    {
    }

    /**
     * Build a ZIP of the given Google Drive photos and stream it back.
     *
     * Request body:
     *   album   string   album/couple name (used for the zip filename)
     *   type    string   bride|groom|both|all (used for the zip filename)
     *   files   array    [{ file_id: string, file_name?: string }, ...]
     *
     * The files are PUBLIC Drive files; no Google credentials are required.
     */
    public function zip(Request $request): StreamedResponse
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

        $files = $data['files'];
        $downloader = $this->downloader;

        return response()->streamDownload(function () use ($files, $downloader) {
            // ZipArchive needs a real file path, so build in a temp file and
            // echo it out, then clean up.
            $tmp = tempnam(sys_get_temp_dir(), 'mfzip');
            $zip = new ZipArchive();
            $zip->open($tmp, ZipArchive::OVERWRITE);

            $used = [];
            foreach ($files as $i => $f) {
                try {
                    $bytes = $downloader->download($f['file_id']);
                } catch (Throwable) {
                    $bytes = null;
                }
                if ($bytes === null) {
                    continue; // skip unreachable files, keep going
                }

                $name = $f['file_name'] ?? ($f['file_id'] . '.jpg');
                $name = $this->uniqueName($name, $i, $used);
                $zip->addFromString($name, $bytes);
            }

            $zip->close();
            readfile($tmp);
            @unlink($tmp);
        }, $zipName, [
            'Content-Type' => 'application/zip',
        ]);
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
