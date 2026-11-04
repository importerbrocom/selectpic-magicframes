<?php

namespace App\Http\Controllers;

use App\Models\ImageSelection;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ImageSelectionController extends Controller
{
    /**
     * List the selections for a project, grouped by side so the bride's and
     * groom's choices are tracked separately.
     */
    public function index(Project $project): JsonResponse
    {
        $selections = $project->selections()->latest()->get();

        return response()->json([
            'data' => [
                'bride' => $selections->where('choice', 'bride')->values(),
                'groom' => $selections->where('choice', 'groom')->values(),
                'both' => $selections->where('choice', 'both')->values(),
            ],
            'meta' => [
                'project_id' => $project->id,
                'bride_count' => $selections->where('choice', 'bride')->count(),
                'groom_count' => $selections->where('choice', 'groom')->count(),
                'both_count' => $selections->where('choice', 'both')->count(),
            ],
        ]);
    }

    /**
     * Save (or toggle off) a selection for a project.
     *
     * Receives the file id and the choice ('bride' or 'groom'). If the same
     * file/choice pair already exists it is removed (toggle behaviour),
     * otherwise it is created.
     */
    public function store(Request $request, Project $project): JsonResponse
    {
        $this->abortIfLocked($request, $project);

        $data = $request->validate([
            'file_id' => ['required', 'string', 'max:255'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'thumbnail_link' => ['nullable', 'string'],
            'choice' => ['required', Rule::in(['bride', 'groom', 'both'])],
        ]);

        // One selection per photo: a photo is marked bride, groom, or both.
        $existing = $project->selections()
            ->where('file_id', $data['file_id'])
            ->first();

        // Clicking the same choice again clears the selection (toggle off).
        if ($existing && $existing->choice === $data['choice']) {
            $existing->delete();

            return response()->json([
                'data' => null,
                'meta' => ['action' => 'removed'],
            ]);
        }

        // Otherwise set/replace this photo's choice.
        if ($existing) {
            $existing->update([
                'choice' => $data['choice'],
                'file_name' => $data['file_name'] ?? $existing->file_name,
                'thumbnail_link' => $data['thumbnail_link'] ?? $existing->thumbnail_link,
            ]);
            $selection = $existing;
        } else {
            $selection = $project->selections()->create($data);
        }

        return response()->json([
            'data' => $selection,
            'meta' => ['action' => 'saved'],
        ], 201);
    }

    /**
     * Delete a single selection explicitly.
     */
    public function destroy(Project $project, ImageSelection $selection): JsonResponse
    {
        abort_if($selection->project_id !== $project->id, 404);
        $this->abortIfLocked(request(), $project);

        $selection->delete();

        return response()->json(null, 204);
    }

    /** Submitted albums are read-only for clients; admins may still edit. */
    private function abortIfLocked(Request $request, Project $project): void
    {
        $isAdmin = $request->user()?->currentAccessToken()?->can('admin');
        abort_if($project->locked && ! $isAdmin, 423, 'This selection has been submitted and is locked.');
    }
}
