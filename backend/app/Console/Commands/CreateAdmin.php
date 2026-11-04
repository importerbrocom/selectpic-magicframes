<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {--name=} {--email=}';

    protected $description = 'Create or reset the admin account (prompts for the password).';

    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('Name', 'Admin');
        $email = $this->option('email') ?: $this->ask('Email');
        $password = $this->secret('Password (min 10 characters)');

        if (strlen((string) $password) < 10) {
            $this->error('Password must be at least 10 characters.');

            return self::FAILURE;
        }
        if ($password !== $this->secret('Confirm password')) {
            $this->error('Passwords do not match.');

            return self::FAILURE;
        }

        $user = User::updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password]);
        $user->tokens()->where('name', 'admin')->delete();

        $this->info("Admin ready: {$user->email}");

        return self::SUCCESS;
    }
}
