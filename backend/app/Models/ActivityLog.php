<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

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
     * 🔥 GIẢI PHÁP ĐỘC QUYỀN: Tự động bóc tách ID động từ Token Base64 từ Request Header
     */
    private static function resolveUserId(): int
    {
        // 1. Phương án ưu tiên: Lấy qua hệ thống định danh chuẩn của Laravel
        if (Auth::check()) {
            return (int) Auth::id();
        }

        // 2. Phương án dự phòng (Fail-safe): Tự bóc tách chuỗi mã hóa Token từ Client gửi lên
        try {
            $bearerToken = request()->bearerToken();
            if ($bearerToken) {
                // Giải mã ngược chuỗi Base64 do AuthController xuất ra
                $decoded = base64_decode($bearerToken, true);
                if ($decoded && str_contains($decoded, '|')) {
                    // Cấu trúc: user_id | time | sha1
                    $parts = explode('|', $decoded);
                    $userId = (int) $parts[0];

                    if ($userId > 0) {
                        return $userId; // Trả về đúng ID của Manager/Broker thực tế
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('Hệ thống Bcons - Lỗi giải mã token ngầm trong ActivityLog Model: ' . $e->getMessage());
        }

        // 3. Hạn định cuối cùng (Dự phòng tối cao)
        return 1;
    }

    /**
     * Hàm viết nhanh log từ Controller
     */
    public static function write($action, $target, $description = null)
    {
        try {
            // 🔥 ĐÃ CẬP NHẬT: Ép dùng hàm resolveUserId() để lấy ID động chuẩn xác thay vì gán chết số 1
            self::create([
                'user_id'     => self::resolveUserId(),
                'action'      => $action,
                'target'      => $target,
                'description' => $description,
                'is_read'     => 0
            ]);
        } catch (\Exception $e) {
            Log::error('Lỗi ghi nhật ký ActivityLog: ' . $e->getMessage());
        }
    }
}
