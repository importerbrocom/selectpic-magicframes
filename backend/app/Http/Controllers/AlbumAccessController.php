<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlbumAccessController extends Controller
{
    /**
     * Verify the album password server-side. On success returns the full
     * album (including the Drive folder) and an album-scoped token.
     */
    public function unlock(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'max:255']]);
        $project = Project::where('slug', $slug)->firstOrFail();

        try {
            $stored = (string) $project->password;
        } catch (\Throwable $e) {
            $stored = '';
        }

        if ($stored === '' || ! hash_equals(trim($stored), trim($data['password']))) {
            return response()->json(['message' => 'That password is not correct.'], 422);
        }

        // Tokens ride on the first user (tokenable); abilities scope them to this album.
        $owner = User::query()->orderBy('id')->firstOrFail();
        $expires = now()->addHours(12);
        $owner->tokens()->where('expires_at', '<', now())->delete();
        $token = $owner->createToken('album:' . $project->id, ['album', 'album:' . $project->id], $expires);

        $project->increment('views');
        $project->load(['brideSelections', 'groomSelections', 'bothSelections']);

        return response()->json([
            'token' => $token->plainTextToken,
            'expires_at' => $expires->toIso8601String(),
            'data' => $project,
        ]);
    }

    /** Client finishes selecting: lock the album. */
    public function submit(Request $request, Project $project): JsonResponse
    {
        $project->update(['locked' => true]);

        return response()->json(['data' => $project]);
    }
}
