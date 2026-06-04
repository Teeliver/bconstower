<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $table = 'users';

    // 🔥 QUAN TRỌNG: Bảng thực tế không có cột updated_at, tắt đi để tránh lỗi Column not found khi Save
    const UPDATED_AT = null;

    /**
     * Các trường cho phép ghi hàng loạt (Mass Assignment)
     */
    protected $fillable = [
        'fullname', // 🔥 ĐÃ ĐỒNG BỘ: Khớp với cột fullname dưới DB
        'email',
        'password',
        'phone',
        'address',
        'avatar',   // Khớp với cột avatar dưới DB
        'role'
    ];

    /**
     * 🔒 BẢO MẬT: Ẩn hoàn toàn mật khẩu khi trả dữ liệu về API JSON
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed', // Tự động băm Bcrypt bảo mật cao khi ghi dữ liệu
        'created_at' => 'datetime',
    ];

    /**
     * Liên kết 1-1 sang bảng hồ sơ môi giới của bạn
     */
    public function profile()
    {
        return $this->hasOne(BrokerProfile::class, 'user_id');
    }
}
