<?php

namespace App\Http\Middleware;

use App\Models\Project;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Allows admins, or a client whose token was issued by unlocking this album.
 */
class EnsureProjectAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $project = $request->route('project');
        $id = $project instanceof Project ? $project->id : $project;

        $token = $user?->currentAccessToken();
        $ok = $token && ($token->can('admin') || $token->can('album:' . $id));

        abort_unless($ok, 403, 'You do not have access to this album.');

        return $next($request);
    }
}
