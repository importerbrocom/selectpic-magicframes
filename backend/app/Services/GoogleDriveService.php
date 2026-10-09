<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use RuntimeException;

/**
 * Thin wrapper around the Google Drive API that lists the image files
 * contained in a given Drive folder.
 *
 * Authentication supports two strategies, resolved in this order:
 *   1. A service account JSON key file (GOOGLE_APPLICATION_CREDENTIALS /
 *      google.service_account), suitable for private folders shared with the
 *      service account.
 *   2. An API key (google.api_key), suitable for publicly shared folders.
 */
class GoogleDriveService
{
    private GoogleDrive $drive;

    public function __construct()
    {
        $client = new GoogleClient();
        $client->setApplicationName(config('app.name', 'SelectPic MagicFrames'));
        $client->setScopes([GoogleDrive::DRIVE_READONLY]);

        $serviceAccount = config('services.google.service_account');
        $apiKey = config('services.google.api_key');

        if ($serviceAccount && file_exists($serviceAccount)) {
            $client->setAuthConfig($serviceAccount);
        } elseif ($apiKey) {
            $client->setDeveloperKey($apiKey);
        } else {
            throw new RuntimeException(
                'Google Drive credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_API_KEY.'
            );
        }

        $this->drive = new GoogleDrive($client);
    }

    /**
     * List image files inside a Drive folder.
     *
     * @return array<int, array{
     *     file_id: string,
     *     name: string,
     *     mime_type: string,
     *     thumbnail_link: ?string,
     *     web_view_link: ?string,
     *     image_url: string
     * }>
     */
    public function listImages(string $folderId): array
    {
        $images = [];
        $pageToken = null;

        do {
            $response = $this->drive->files->listFiles([
                'q' => sprintf(
                    "'%s' in parents and mimeType contains 'image/' and trashed = false",
                    addslashes($folderId)
                ),
                'fields' => 'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink)',
                'pageSize' => 100,
                'pageToken' => $pageToken,
                'supportsAllDrives' => true,
                'includeItemsFromAllDrives' => true,
            ]);

            foreach ($response->getFiles() as $file) {
                $images[] = [
                    'file_id' => $file->getId(),
                    'name' => $file->getName(),
                    'mime_type' => $file->getMimeType(),
                    'thumbnail_link' => $file->getThumbnailLink(),
                    'web_view_link' => $file->getWebViewLink(),
                    // Direct-view URL that works for publicly shared files.
                    'image_url' => sprintf('https://drive.google.com/uc?export=view&id=%s', $file->getId()),
                ];
            }

            $pageToken = $response->getNextPageToken();
        } while ($pageToken);

        return $images;
    }
}
