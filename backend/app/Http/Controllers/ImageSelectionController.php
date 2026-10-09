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
            ],
            'meta' => [
                'project_id' => $project->id,
                'bride_count' => $selections->where('choice', 'bride')->count(),
                'groom_count' => $selections->where('choice', 'groom')->count(),
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
        $data = $request->validate([
            'file_id' => ['required', 'string', 'max:255'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'thumbnail_link' => ['nullable', 'string'],
            'choice' => ['required', Rule::in(['bride', 'groom'])],
        ]);

        $existing = $project->selections()
            ->where('file_id', $data['file_id'])
            ->where('choice', $data['choice'])
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json([
                'data' => null,
                'meta' => ['action' => 'removed'],
            ]);
        }

        $selection = $project->selections()->create($data);

        return response()->json([
            'data' => $selection,
            'meta' => ['action' => 'added'],
        ], 201);
    }

    /**
     * Delete a single selection explicitly.
     */
    public function destroy(Project $project, ImageSelection $selection): JsonResponse
    {
        abort_if($selection->project_id !== $project->id, 404);

        $selection->delete();

        return response()->json(null, 204);
    }
}
