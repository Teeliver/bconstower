<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Log;

class AdminAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // 🔥 BƯỚC 1: Bọc lót CORS Preflight - Bỏ qua kiểm tra token đối với request OPTIONS
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        // Bước 2: Lấy Header Authorization (hỗ trợ cả chữ hoa lẫn chữ thường)
        $header = $request->header('Authorization') ?? $request->header('authorization');

        if (!$header || !str_starts_with($header, 'Bearer ')) {
            // Ghi lại log hệ thống để xem thực tế Laravel nhận được Header gì từ Frontend
            Log::warning('AdminAuth: Thiếu Bearer hoặc Header rỗng. Toàn bộ Header nhận được: ' . json_encode($request->headers->all()));
            return response()->json(['success' => false, 'message' => 'Thiếu mã Token xác thực.'], 401);
        }

        $token = str_replace('Bearer ', '', $header);
        $token = str_replace(['"', "'"], '', trim($token));

        try {
            $decoded = base64_decode($token, true);
            if (!$decoded) throw new \Exception("Token decode thất bại");

            $parts = explode('|', $decoded);
            if (count($parts) !== 3) throw new \Exception("Token sai định dạng");

            [$userId, $timestamp, $emailHash] = $parts;

            if (time() - (int)$timestamp > 86400) {
                return response()->json(['success' => false, 'message' => 'Phiên đăng nhập hết hạn.'], 401);
            }

            $user = User::find($userId);
            $secretKey = 'Bcons_Design_System_Secret_Key';

            if (!$user || sha1($user->email . $secretKey) !== $emailHash) {
                return response()->json(['success' => false, 'message' => 'Mã Token không hợp lệ.'], 401);
            }

            $request->setUserResolver(function () use ($user) {
                return $user;
            });

            return $next($request);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Xác thực thất bại.'], 401);
        }
    }
}
