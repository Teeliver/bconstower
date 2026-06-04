<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BrokerProfile extends Model
{
    use HasFactory;

    // 🔥 ĐỒNG BỘ: Khớp chính xác 100% với tên bảng thực tế trong DB của bạn
    protected $table = 'broker_profiles';

    // Giữ nguyên bọc lót bảo vệ hệ thống vì bảng không có cột created_at
    const CREATED_AT = null;

    protected $fillable = [
        'user_id',
        'license_number',
        'company_name',
        'experience_years',
        'area_focus',
        'bio',
        'verified'
    ];

    protected $casts = [
        'experience_years' => 'integer',
        'verified' => 'integer',
        'updated_at' => 'datetime'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
