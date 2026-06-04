<?php

namespace App\Observers;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ActivityObserver
{
    public function created(Model $model)
    {
        try {
            $user = Auth::user();
            $modelName = class_basename($model);
            $targetName = $this->translateModelName($modelName);
            $identifier = $model->fullname ?? $model->name ?? $model->title ?? "Mã số #{$model->id}";

            ActivityLog::create([
                'user_id'     => $user ? $user->id : 1,
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
                    $sellerName = $user ? $user->fullname : 'Môi giới hệ thống';
                    ActivityLog::create([
                        'user_id'     => $user ? $user->id : 1,
                        'action'      => 'Chốt deal 👑',
                        'target'      => 'Giỏ hàng căn hộ',
                        'description' => "Chiến thần [{$sellerName}] đã bán thành công căn hộ [{$identifier}]!",
                        'is_read'     => 0
                    ]);
                    return;
                }

                // Nhật ký cập nhật thông thường
                ActivityLog::create([
                    'user_id'     => $user ? $user->id : 1,
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
            $user = Auth::user();
            $modelName = class_basename($model);
            $targetName = $this->translateModelName($modelName);
            $identifier = $model->fullname ?? $model->name ?? $model->title ?? "Mã số #{$model->id}";

            ActivityLog::create([
                'user_id'     => $user ? $user->id : 1,
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
