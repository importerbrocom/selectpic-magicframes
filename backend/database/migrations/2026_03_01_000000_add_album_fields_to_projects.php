<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Expand `projects` so a project fully represents a client selection album
 * (shareable by slug on any device): slug, subtitle, password, cover, drive
 * link, locked/allow_download flags and a view counter.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('name');
            $table->string('subtitle')->nullable()->after('slug');
            $table->string('password')->nullable()->after('subtitle');
            $table->string('cover')->nullable()->after('password');
            $table->string('drive_link')->nullable()->after('google_drive_folder_id');
            $table->boolean('locked')->default(false)->after('cover');
            $table->boolean('allow_download')->default(true)->after('locked');
            $table->unsignedInteger('views')->default(0)->after('allow_download');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn([
                'slug',
                'subtitle',
                'password',
                'cover',
                'drive_link',
                'locked',
                'allow_download',
                'views',
            ]);
        });
    }
};
