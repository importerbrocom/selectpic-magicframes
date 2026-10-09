<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('image_selections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();
            $table->string('file_id');
            $table->string('file_name')->nullable();
            $table->string('thumbnail_link')->nullable();
            // The user's choice: either 'bride' or 'groom'.
            $table->enum('choice', ['bride', 'groom']);
            $table->timestamps();

            // A given image can be chosen once per side within a project.
            $table->unique(['project_id', 'file_id', 'choice']);
            $table->index(['project_id', 'choice']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('image_selections');
    }
};
