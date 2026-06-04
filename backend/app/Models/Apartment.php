<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Apartment extends Model {
    protected $fillable = [
        'project_id', 'name', 'slug', 'block', 'floor', 'area', 'bedrooms',
        'bathrooms', 'direction_main', 'direction_balcony', 'furniture',
        'description', 'price', 'status', 'approval_status', 'image', 'folder_path', 'user_id', 'created_by'
    ];
    public $timestamps = false;

    public function project() {
        return $this->belongsTo(Project::class, 'project_id', 'id');
    }
}

