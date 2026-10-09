<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Serve the compiled React single-page app. The frontend is built into
| public/index.html (with assets under public/app). Any non-API, non-asset
| route returns that file so client-side routing works, while the API lives
| under /api (see routes/api.php).
|
*/

Route::get('/{any?}', function () {
    $index = public_path('index.html');

    // Fall back to Laravel's welcome page if the SPA hasn't been built yet.
    if (! file_exists($index)) {
        return view('welcome');
    }

    return response()->file($index);
})->where('any', '^(?!api|up|storage).*$');
