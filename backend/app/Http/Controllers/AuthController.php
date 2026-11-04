<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        // Always run a hash check so timing doesn't reveal valid emails.
        $hash = $user?->password ?? '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
        $valid = Hash::check($data['password'], $hash) && $user;

        if (! $valid) {
            return response()->json(['message' => 'Invalid email or password.'], 422);
        }

        $token = $user->createToken('admin', ['admin'], now()->addDays(14));

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $u = $request->user();

        return response()->json(['data' => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email]]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }
}
