<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE projects MODIFY password TEXT NULL');
        }

        foreach (DB::table('projects')->whereNotNull('password')->get() as $row) {
            try {
                Crypt::decryptString($row->password); // already encrypted
            } catch (\Throwable $e) {
                DB::table('projects')->where('id', $row->id)
                    ->update(['password' => Crypt::encryptString($row->password)]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('projects')->whereNotNull('password')->get() as $row) {
            try {
                DB::table('projects')->where('id', $row->id)
                    ->update(['password' => Crypt::decryptString($row->password)]);
            } catch (\Throwable $e) {
            }
        }
    }
};
