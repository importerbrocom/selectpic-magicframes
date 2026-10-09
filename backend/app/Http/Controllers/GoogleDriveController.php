<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\GoogleDriveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class GoogleDriveController extends Controller
{
    /**
     * Fetch images from a Google Drive folder.
     *
     * The folder id can be supplied directly as a query parameter, or it will
     * fall back to the project's stored folder id when a project is provided.
     */
    public function images(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folder_id' => ['nullable', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
        ]);

        $folderId = $validated['folder_id'] ?? null;

        if (! $folderId && ! empty($validated['project_id'])) {
            $project = Project::find($validated['project_id']);
            $folderId = $project?->google_drive_folder_id;
        }

        // Accept either a bare folder id or a full Google Drive URL.
        $folderId = $this->normalizeFolderId($folderId);

        if (! $folderId) {
            return response()->json([
                'message' => 'A folder_id is required (either directly or via a project with a stored folder id).',
            ], 422);
        }

        try {
            // Resolve lazily so a missing-credentials error is handled here
            // (returning 502) rather than failing during DI resolution.
            $images = app(GoogleDriveService::class)->listImages($folderId);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Unable to fetch images from Google Drive.',
                'error' => $e->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $images,
            'meta' => [
                'folder_id' => $folderId,
                'count' => count($images),
            ],
        ]);
    }

    /**
     * Extract a Google Drive folder id from either a bare id or a full URL.
     *
     * Handles common link shapes, e.g.:
     *   https://drive.google.com/drive/folders/<ID>
     *   https://drive.google.com/drive/u/0/folders/<ID>
     *   https://drive.google.com/open?id=<ID>
     *   https://drive.google.com/drive/folders/<ID>?usp=sharing
     * and returns the trimmed id unchanged when no URL is detected.
     */
    private function normalizeFolderId(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        // .../folders/<ID>
        if (preg_match('#/folders/([A-Za-z0-9_-]+)#', $value, $m)) {
            return $m[1];
        }

        // ...?id=<ID> or ...&id=<ID>
        if (preg_match('#[?&]id=([A-Za-z0-9_-]+)#', $value, $m)) {
            return $m[1];
        }

        // Already a bare id (strip any trailing query string just in case).
        return preg_replace('/[?#].*$/', '', $value);
    }
}
