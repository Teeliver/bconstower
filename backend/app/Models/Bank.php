<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Bank extends Model
{
    use HasFactory;

    // Khai báo khớp với tên bảng chứa cấu trúc của bạn
    protected $table = 'banks';

    // 🔥 QUAN TRỌNG: Cấu trúc bảng không có cột updated_at, ngắt đi để tránh lỗi khi sửa dữ liệu
    const UPDATED_AT = null;

    /**
     * Các cột được phép ghi hàng loạt (chống tấn công Mass Assignment chèn trường lậu)
     */
    protected $fillable = [
        'name',
        'logo',
        'preferential_rate',
        'preferential_term',
        'floating_rate',
        'max_term'
    ];

    /**
     * Ép kiểu dữ liệu an toàn khi trả về API
     */
    protected $casts = [
        'preferential_rate' => 'float',
        'preferential_term' => 'integer',
        'floating_rate' => 'float',
        'max_term' => 'integer',
        'created_at' => 'datetime'
    ];
}
