<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Definitively allow 'both' as a selection choice.
 *
 * Laravel's enum() column adds a CHECK (choice IN ('bride','groom')) on
 * SQLite, which silently rejected 'both' inserts. SQLite can't ALTER a CHECK
 * constraint in place, so we rebuild the table without it. Written to be
 * idempotent / recover from a previously half-applied attempt.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver !== 'sqlite') {
            if ($driver === 'mysql') {
                DB::statement(
                    "ALTER TABLE image_selections MODIFY choice VARCHAR(16) NOT NULL DEFAULT 'bride'"
                );
                // Switch to one-selection-per-photo uniqueness.
                try {
                    DB::statement('ALTER TABLE image_selections DROP INDEX image_selections_project_id_file_id_choice_unique');
                } catch (\Throwable) {
                    // index name may differ / already dropped
                }
                try {
                    DB::statement('ALTER TABLE image_selections ADD UNIQUE image_selections_project_id_file_id_unique (project_id, file_id)');
                } catch (\Throwable) {
                    // already exists
                }
            }
            return;
        }

        // --- SQLite: rebuild the table without the CHECK constraint ---

        // Clean up any leftover temp column from a prior partial run.
        if (Schema::hasColumn('image_selections', 'choice_tmp')) {
            DB::statement('ALTER TABLE image_selections DROP COLUMN choice_tmp');
        }

        DB::transaction(function () {
            // Drop indexes that reference `choice` (they'll be recreated).
            DB::statement('DROP INDEX IF EXISTS image_selections_project_id_file_id_choice_unique');
            DB::statement('DROP INDEX IF EXISTS image_selections_project_id_choice_index');

            // Build a fresh table with `choice` as plain TEXT (no CHECK).
            DB::statement('
                CREATE TABLE image_selections_new (
                    id integer primary key autoincrement not null,
                    project_id integer not null,
                    file_id varchar not null,
                    file_name varchar,
                    thumbnail_link varchar,
                    choice varchar not null default \'bride\',
                    created_at datetime,
                    updated_at datetime,
                    foreign key("project_id") references "projects"("id") on delete cascade
                )
            ');

            DB::statement('
                INSERT INTO image_selections_new
                    (id, project_id, file_id, file_name, thumbnail_link, choice, created_at, updated_at)
                SELECT id, project_id, file_id, file_name, thumbnail_link, choice, created_at, updated_at
                FROM image_selections
            ');

            DB::statement('DROP TABLE image_selections');
            DB::statement('ALTER TABLE image_selections_new RENAME TO image_selections');

            // One selection per (project, file): unique on those two columns.
            DB::statement('CREATE UNIQUE INDEX image_selections_project_id_file_id_unique ON image_selections (project_id, file_id)');
            DB::statement('CREATE INDEX image_selections_project_id_choice_index ON image_selections (project_id, choice)');
        });
    }

    public function down(): void
    {
        // No-op: a plain string column is a harmless superset.
    }
};
