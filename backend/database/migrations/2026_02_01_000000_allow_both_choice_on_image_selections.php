<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Allow a third selection value, 'both', alongside 'bride' and 'groom'.
 *
 * The original column was an ENUM('bride','groom'). Converting it to a plain
 * string keeps things portable across SQLite (dev) and MySQL (prod) and lets
 * the app store 'both' directly, matching the client UI which lets a photo be
 * marked for the bride, the groom, or both.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE image_selections MODIFY choice VARCHAR(16) NOT NULL"
            );
        }
        // SQLite stores enums as TEXT with no CHECK constraint from Laravel's
        // enum() helper, so no change is needed there — 'both' is already
        // storable. Other drivers (pgsql) fall through harmlessly.
    }

    public function down(): void
    {
        // Best-effort: collapse any 'both' rows so the stricter enum can be
        // restored without violating it, then (MySQL) narrow the column again.
        DB::table('image_selections')->where('choice', 'both')->update([
            'choice' => 'bride',
        ]);

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE image_selections MODIFY choice ENUM('bride','groom') NOT NULL"
            );
        }
    }
};
