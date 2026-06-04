<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HeroSlide extends Model
{
    // 1. Chỉ định chính xác tên bảng dưới Database Hosting
    protected $table = 'hero_slides';

    // 2. Cấu hình các cột được phép nạp/sửa dữ liệu diện rộng an toàn
    protected $fillable = [
        'title',
        'subtitle',
        'image_url',
        'link_url',
        'button_text',
        'is_active',
        'display_order'
    ];

    // 3. Khai báo kiểu dữ liệu trả về chuẩn hóa cho Frontend
    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
