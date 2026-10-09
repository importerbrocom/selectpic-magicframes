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
}
