<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $table = 'posts';

    protected $fillable = [
        'title',
        'slug',
        'content',
        'summary',
        'image_url', // Bọc lót trường cũ
        'thumbnail', // 🔥 THÊM: Khớp với cột thật trong DB của bạn
        'category_id',
        'is_published',
        'views',
        'user_id'
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'views' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
