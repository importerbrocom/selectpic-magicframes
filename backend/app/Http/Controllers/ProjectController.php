<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    /**
     * List all projects with selection counts.
     */
    public function index(): JsonResponse
    {
        $projects = Project::query()
            ->withCount(['brideSelections', 'groomSelections'])
            ->latest()
            ->get();

        return response()->json(['data' => $projects]);
    }

    /**
     * Create a new project.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'google_drive_folder_id' => ['nullable', 'string', 'max:255'],
            'bride_name' => ['nullable', 'string', 'max:255'],
            'groom_name' => ['nullable', 'string', 'max:255'],
        ]);

        $project = Project::create($data);

        return response()->json(['data' => $project], 201);
    }

    /**
     * Show a single project together with its selections grouped by side.
     */
    public function show(Project $project): JsonResponse
    {
        $project->load(['brideSelections', 'groomSelections']);

        return response()->json(['data' => $project]);
    }

    /**
     * Update a project.
     */
    public function update(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'google_drive_folder_id' => ['nullable', 'string', 'max:255'],
            'bride_name' => ['nullable', 'string', 'max:255'],
            'groom_name' => ['nullable', 'string', 'max:255'],
        ]);

        $project->update($data);

        return response()->json(['data' => $project]);
    }

    /**
     * Delete a project (and its selections, via cascade).
     */
    public function destroy(Project $project): JsonResponse
    {
        $project->delete();

        return response()->json(null, 204);
    }
}
