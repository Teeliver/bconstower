<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $table = 'settings';

    // 🔥 QUAN TRỌNG: Bảng thực tế chỉ có updated_at, ngắt created_at để tránh sập SQL khi lưu
    const CREATED_AT = null;

    /**
     * Khai báo chính xác 100% các cột dựa theo cấu trúc bảng
     */
    protected $fillable = [
        'site_title',
        'site_description',
        'favicon',
        'og_image',
        'logo',
        'logo_footer',
        'hotline',
        'email',
        'address',
        'copyright',
        'facebook_url',
        'zalo_url',
        'youtube_url',
        'google_analytics',
        'custom_scripts'
    ];
}
