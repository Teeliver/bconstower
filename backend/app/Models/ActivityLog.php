<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    use HasFactory;

    // 🔥 ĐỒNG BỘ CHUẨN XÁC: Khớp 100% tên bảng thực tế của Tín
    protected $table = 'activity_logs';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'target',
        'description',
        'is_read'
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Hàm viết nhanh log từ Controller
     */
    public static function write($action, $target, $description = null)
    {
        try {
            $user = Auth::user();
            self::create([
                'user_id'     => $user ? $user->id : 1,
                'action'      => $action,
                'target'      => $target,
                'description' => $description,
                'is_read'     => 0
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Lỗi ghi nhật ký ActivityLog: ' . $e->getMessage());
        }
    }
}
