<?php

use App\Http\Controllers\AlbumAccessController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GoogleDriveController;
use App\Http\Controllers\ImageSelectionController;
use App\Http\Controllers\PhotoDownloadController;
use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Routes for the SelectPic MagicFrames photo-selection tool.
|
*/

// --- Public -----------------------------------------------------------
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::get('projects/by-slug/{slug}', [ProjectController::class, 'showBySlug']);
Route::post('projects/by-slug/{slug}/unlock', [AlbumAccessController::class, 'unlock'])->middleware('throttle:10,1');

// --- Admin only -------------------------------------------------------
Route::middleware(['auth:sanctum', 'abilities:admin'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::apiResource('projects', ProjectController::class);
    Route::get('drive/images', [GoogleDriveController::class, 'images']);
});

// --- Admin or a client who unlocked this album ------------------------
Route::middleware(['auth:sanctum', 'project.access'])->group(function () {
    Route::get('projects/{project}/selections', [ImageSelectionController::class, 'index']);
    Route::post('projects/{project}/selections', [ImageSelectionController::class, 'store']);
    Route::delete('projects/{project}/selections/{selection}', [ImageSelectionController::class, 'destroy']);
    Route::post('projects/{project}/submit', [AlbumAccessController::class, 'submit']);
});

// --- Any authenticated album/admin token ------------------------------
Route::middleware(['auth:sanctum', 'ability:admin,album'])->group(function () {
    Route::post('photos/zip', [PhotoDownloadController::class, 'zip']);
    Route::post('photos/file', [PhotoDownloadController::class, 'file']);
});

// Download pipeline diagnostics (open in a browser). Safe: no secrets.
Route::get('photos/diagnostics', [PhotoDownloadController::class, 'diagnostics']);
