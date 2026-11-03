<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Definitively allow 'both' as a selection choice.
 *
 * Laravel's enum() column adds a CHECK (choice IN ('bride','groom')) on
 * SQLite, which silently rejected 'both' inserts. SQLite can't ALTER a CHECK
 * constraint in place, so we rebuild the column as plain TEXT. MySQL/other
 * drivers use a direct column change.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // Recreate the column without the CHECK constraint, preserving data.
            Schema::table('image_selections', function ($table) {
                $table->string('choice_tmp')->nullable();
            });
            DB::statement('UPDATE image_selections SET choice_tmp = choice');
            Schema::table('image_selections', function ($table) {
                $table->dropColumn('choice');
            });
            Schema::table('image_selections', function ($table) {
                $table->string('choice')->default('bride');
            });
            DB::statement('UPDATE image_selections SET choice = choice_tmp');
            Schema::table('image_selections', function ($table) {
                $table->dropColumn('choice_tmp');
            });
        } elseif ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE image_selections MODIFY choice VARCHAR(16) NOT NULL DEFAULT 'bride'"
            );
        }
    }

    public function down(): void
    {
        // No-op: keeping the column as a plain string is harmless.
    }
};
