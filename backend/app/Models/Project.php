<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'google_drive_folder_id',
        'bride_name',
        'groom_name',
    ];

    /**
     * All image selections that belong to this project.
     *
     * @return HasMany<ImageSelection>
     */
    public function selections(): HasMany
    {
        return $this->hasMany(ImageSelection::class);
    }

    /**
     * Only the bride's selections for this project.
     *
     * @return HasMany<ImageSelection>
     */
    public function brideSelections(): HasMany
    {
        return $this->hasMany(ImageSelection::class)->where('choice', 'bride');
    }

    /**
     * Only the groom's selections for this project.
     *
     * @return HasMany<ImageSelection>
     */
    public function groomSelections(): HasMany
    {
        return $this->hasMany(ImageSelection::class)->where('choice', 'groom');
    }
}
