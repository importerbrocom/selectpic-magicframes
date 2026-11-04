<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    /**
     * List all projects with selection counts.
     */
    public function index(): JsonResponse
    {
        $projects = Project::query()
            ->withCount(['brideSelections', 'groomSelections', 'bothSelections'])
            ->latest()
            ->get();

        return response()->json(['data' => $projects]);
    }

    /**
     * Create a new album project. Generates a unique, name-based slug.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, creating: true);
        $data['slug'] = $this->uniqueSlug($data['name']);

        $project = Project::create($data);

        return response()->json(['data' => $project], 201);
    }

    /**
     * Show a project by numeric id, with its selections grouped by side.
     */
    public function show(Project $project): JsonResponse
    {
        $project->load(['brideSelections', 'groomSelections', 'bothSelections']);

        return response()->json(['data' => $project]);
    }

    /**
     * Public lookup by slug — used by the client share link on any device.
     */
    public function showBySlug(string $slug): JsonResponse
    {
        $project = Project::where('slug', $slug)->firstOrFail();
        $project->increment('views');
        $project->load(['brideSelections', 'groomSelections', 'bothSelections']);

        return response()->json(['data' => $project]);
    }

    /**
     * Update a project.
     */
    public function update(Request $request, Project $project): JsonResponse
    {
        $data = $this->validatePayload($request, creating: false);

        // Regenerate the slug if the name changed and no slug is kept.
        if (isset($data['name']) && $data['name'] !== $project->name && ! $project->slug) {
            $data['slug'] = $this->uniqueSlug($data['name']);
        }

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

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$req, 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'cover' => ['nullable', 'string', 'max:2048'],
            'google_drive_folder_id' => ['nullable', 'string', 'max:255'],
            'drive_link' => ['nullable', 'string', 'max:2048'],
            'bride_name' => ['nullable', 'string', 'max:255'],
            'groom_name' => ['nullable', 'string', 'max:255'],
            'locked' => ['sometimes', 'boolean'],
            'allow_download' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * Build a unique, URL-safe slug from the album name plus a short code so
     * two couples with the same name never collide, e.g. "job-maya-7k2x".
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'album';
        do {
            $slug = $base . '-' . Str::lower(Str::random(4));
        } while (Project::where('slug', $slug)->exists());

        return $slug;
    }
}
