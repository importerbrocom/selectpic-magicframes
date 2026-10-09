<?php

use App\Http\Controllers\GoogleDriveController;
use App\Http\Controllers\ImageSelectionController;
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

// Projects CRUD.
Route::apiResource('projects', ProjectController::class);

// Image selections, scoped to a project so each side is tracked separately.
Route::get('projects/{project}/selections', [ImageSelectionController::class, 'index']);
Route::post('projects/{project}/selections', [ImageSelectionController::class, 'store']);
Route::delete('projects/{project}/selections/{selection}', [ImageSelectionController::class, 'destroy']);

// Google Drive image fetching.
Route::get('drive/images', [GoogleDriveController::class, 'images']);
