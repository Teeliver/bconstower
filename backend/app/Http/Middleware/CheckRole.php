<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class CheckRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        try {
            // 1. Lấy thông tin user đăng nhập qua các tầng bảo bọc để tránh xung đột middleware cũ
            $user = Auth::user()
                ?? Auth::guard('sanctum')->user()
                ?? $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chưa đăng nhập hoặc phiên làm việc hết hạn!'
                ], 401);
            }

            // 2. Chuẩn hóa chuỗi quyền trong DB của Trung Tín
            $rawRole = strtolower(trim($user->role ?? ''));

            // Quy đổi biến thể về nhóm chuẩn (admin, manager, broker)
            $userGroup = $rawRole;
            if (in_array($rawRole, ['quan_ly', 'quản lý', 'manager', 'editor'])) {
                $userGroup = 'manager';
            } elseif (in_array($rawRole, ['moi_gioi', 'môi giới', 'broker', 'nhan_vien', 'nhân viên'])) {
                $userGroup = 'broker';
            } elseif (in_array($rawRole, ['admin', 'administrator'])) {
                $userGroup = 'admin';
            }

            // 3. So khớp với mảng quyền được cấu hình trong routes/api.php
            $requestedRoles = array_map('strtolower', $roles);

            if (in_array($userGroup, $requestedRoles)) {
                return $next($request); // Hợp lệ, thông tuyến API!
            }

            return response()->json([
                'success' => false,
                'message' => "Tài khoản cấp [{$rawRole}] không có thẩm quyền truy cập mục này!"
            ], 403);

        } catch (\Exception $e) {
            // 🔥 NẾU CÓ LỖI: Ghi log chi tiết ra file laravel.log để ông dễ debug, không làm sập server
            Log::error('[Bcons CheckRole Error] Bị lỗi 500 do: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Lỗi xử lý phân quyền hệ thống nội bộ backend (500)!',
                'error_debug' => $e->getMessage() // Dòng này giúp ông thấy lỗi ngay trên console trình duyệt
            ], 500);
        }
    }
}
