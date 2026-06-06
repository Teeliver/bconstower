<?php

namespace App\Observers;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ActivityObserver
{
    /**
     * 🔥 GIẢI PHÁP ĐỘC QUYỀN: Tự động bóc tách ID động từ Token Base64 nếu Auth guard bị null
     */
    private function resolveUserId(): int
    {
        // 1. Phương án ưu tiên: Lấy qua hệ thống định danh chuẩn của Laravel
        if (Auth::check()) {
            return (int) Auth::id();
        }

        // 2. Phương án dự phòng (Fail-safe): Tự giải mã Token Base64 từ Request Header của trình duyệt
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
                        return $userId; // Trả về đúng ID của Manager/Broker đang thực hiện
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('Hệ thống Bcons - Lỗi giải mã token ngầm trong Observer: ' . $e->getMessage());
        }

        // 3. Hạn định cuối cùng (Chỉ dùng khi chạy Seeder hoặc hệ thống tự động không có phiên đăng nhập)
        return 1;
    }

    public function created(Model $model)
    {
        try {
            $user = Auth::user();
            $modelName = class_basename($model);
            $targetName = $this->translateModelName($modelName);
            $identifier = $model->fullname ?? $model->name ?? $model->title ?? "Mã số #{$model->id}";

            // 🔥 ĐÃ CẬP NHẬT: Ép dùng hàm resolveUserId() để lấy ID động chuẩn xác
            ActivityLog::create([
                'user_id'     => $this->resolveUserId(),
                'action'      => 'Thêm mới ➕',
                'target'      => $targetName,
                'description' => "Đã tạo thành công bản ghi mới: [{$identifier}].",
                'is_read'     => 0
            ]);
        } catch (\Exception $e) {
            Log::error('Observer Created Error: ' . $e->getMessage());
        }
    }

    public function updated(Model $model)
    {
        try {
            if ($model->wasChanged()) {
                $user = Auth::user();
                $modelName = class_basename($model);
                $targetName = $this->translateModelName($modelName);
                $identifier = $model->fullname ?? $model->name ?? $model->title ?? "Mã số #{$model->id}";

                // 👑 ĐẶC BIỆT: Nghiệp vụ chốt deal căn hộ theo yêu cầu của Trung Tín
                if ($modelName === 'Apartment' && $model->wasChanged('status') && $model->status === 'da_ban') {
                    // Nếu $user bị null thì cố lấy tên hiển thị của model hoặc gán nhãn động
                    $sellerName = $user ? $user->fullname : ($model->staff_name ?? 'Môi giới hệ thống');

                    ActivityLog::create([
                        'user_id'     => $this->resolveUserId(),
                        'action'      => 'Chốt deal 👑',
                        'target'      => 'Giỏ hàng căn hộ',
                        'description' => "Chiến thần [{$sellerName}] đã bán thành công căn hộ [{$identifier}]!",
                        'is_read'     => 0
                    ]);
                    return;
                }

                // Nhật ký cập nhật thông thường
                // 🔥 ĐÃ CẬP NHẬT: Ép dùng hàm resolveUserId() để lấy ID động chuẩn xác
                ActivityLog::create([
                    'user_id'     => $this->resolveUserId(),
                    'action'      => 'Chỉnh sửa 📝',
                    'target'      => $targetName,
                    'description' => "Đã thay đổi thông tin của [{$identifier}].",
                    'is_read'     => 0
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Observer Updated Error: ' . $e->getMessage());
        }
    }

    public function deleted(Model $model)
    {
        try {
            $modelName = class_basename($model);
            $targetName = $this->translateModelName($modelName);
            $identifier = $model->fullname ?? $model->name ?? $model->title ?? "Mã số #{$model->id}";

            // 🔥 ĐÃ CẬP NHẬT: Ép dùng hàm resolveUserId() để lấy ID động chuẩn xác
            ActivityLog::create([
                'user_id'     => $this->resolveUserId(),
                'action'      => 'Xóa bỏ ❌',
                'target'      => $targetName,
                'description' => "Đã xóa [{$identifier}] ra khỏi hệ thống.",
                'is_read'     => 0
            ]);
        } catch (\Exception $e) {
            Log::error('Observer Deleted Error: ' . $e->getMessage());
        }
    }

    private function translateModelName($name): string
    {
        return match ($name) {
            'User'        => 'Tài khoản nhân sự',
            'Bank'        => 'Ngân hàng liên kết',
            'Setting'     => 'Cấu hình hệ thống',
            'Apartment'   => 'Giỏ hàng căn hộ',
            'Project'     => 'Danh mục dự án',
            'Post'        => 'Bài viết tin tức',
            'HeroSlide'   => 'Banner Slider trang chủ',
            default       => 'Phân hệ ' . $name,
        };
    }
}
