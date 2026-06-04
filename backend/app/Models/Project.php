<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model {
    protected $fillable = ['title', 'slug', 'address', 'image', 'status', 'legal', 'lat', 'lng'];
    public $timestamps = false;

    public function apartments() {
        return $this->hasMany(Apartment::class, 'project_id', 'id');
    }
}
