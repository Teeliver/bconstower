<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    /**
     * API 1: LẤY DANH SÁCH THÔNG BÁO (Bốc từ activity_logs + Join lấy tên thật)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            if (!Schema::hasTable('activity_logs')) {
                return response()->json([], 200);
            }

            // Tự động kiểm tra xem bảng đã được nạp cột is_read chưa để tránh lỗi sập Query
            $hasIsRead = Schema::hasColumn('activity_logs', 'is_read');

            // Thực hiện ghép bảng bốc trọn vẹn dữ liệu tên nhân sự thời gian thực
            $query = DB::table('activity_logs')
                ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
                ->select('activity_logs.*', 'users.fullname as user_fullname')
                ->orderBy('activity_logs.id', 'desc')
                ->take(30);

            $notifications = $query->get();

            $formatted = $notifications->map(function ($n) use ($hasIsRead) {
                // Nối trường target và trường mô tả description lại làm một để hiển thị trọn vẹn lên giao diện Astro
                $detailedTarget = $n->target ?? '';
                if (!empty($n->description)) {
                    $detailedTarget .= ' — ' . $n->description;
                }

                $isReadVal = $hasIsRead ? (int)($n->is_read ?? 0) : 0;

                return [
                    'id'        => $n->id,
                    'action'    => $n->action ?? 'THÔNG BÁO',
                    'userName'  => $n->user_fullname ?? 'Hệ thống', // Lấy tên thật từ bảng users
                    'user_name' => $n->user_fullname ?? 'Hệ thống',
                    'target'    => $detailedTarget,
                    'isRead'    => $isReadVal,
                    'is_read'   => $isReadVal,
                    'createdAt' => $n->created_at
                ];
            });

            return response()->json($formatted, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi API notifications list từ activity_logs: ' . $e->getMessage());
            return response()->json([], 200); // Trả mảng rỗng phòng thủ giữ vững giao diện Front
        }
    }

    /**
     * API 2: ĐẾM SỐ THÔNG BÁO CHƯA ĐỌC
     */
    public function unreadCount(Request $request): JsonResponse
    {
        try {
            if (!Schema::hasTable('activity_logs')) {
                return response()->json(['unreadCount' => 0, 'unread_count' => 0], 200);
            }

            // Nếu DB chưa chạy lệnh bảo trì thêm cột, trả về số 0 giả lập để không sập UI
            if (!Schema::hasColumn('activity_logs', 'is_read')) {
                return response()->json(['unreadCount' => 0, 'unread_count' => 0], 200);
            }

            $count = DB::table('activity_logs')
                ->where('is_read', 0)
                ->count();

            return response()->json([
                'unreadCount'  => $count,
                'unread_count' => $count
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['unreadCount' => 0, 'unread_count' => 0], 200);
        }
    }

    /**
     * API 3: ĐÁNH DẤU TẤT CẢ LÀ ĐÃ ĐỌC
     */
    public function markAllRead(Request $request): JsonResponse
    {
        try {
            if (Schema::hasTable('activity_logs') && Schema::hasColumn('activity_logs', 'is_read')) {
                DB::table('activity_logs')
                    ->where('is_read', 0)
                    ->update(['is_read' => 1]);
            }

            return response()->json(['success' => true, 'message' => 'Đã đọc tất cả thông báo!'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
