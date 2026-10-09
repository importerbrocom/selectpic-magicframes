<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImageSelection extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'file_id',
        'file_name',
        'thumbnail_link',
        'choice',
    ];

    /**
     * The project this selection belongs to.
     *
     * @return BelongsTo<Project, ImageSelection>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
