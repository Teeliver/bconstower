<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản hoặc mật khẩu không chính xác.'
            ], 401);
        }

        // 🔥 GIỮ NGUYÊN BẢO MẬT: BỌC TRY-CATCH ĐỂ ĐỐI CHIẾU THUẬT TOÁN HASH CŨ
        try {
            if (!Hash::check($request->password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tài khoản hoặc mật khẩu không chính xác.'
                ], 401);
            }
        } catch (\Throwable $e) {
            // Lấy 8 ký tự đầu của pass trong DB để nhận diện thuật toán cũ
            $prefix = substr($user->password, 0, 10);

            return response()->json([
                'success' => false,
                'message' => "Mật khẩu cũ không khớp hệ mã hóa Laravel. Ký tự đầu trong DB là: '{$prefix}...'. Vui lòng cập nhật lại mật khẩu chuẩn Bcrypt cho tài khoản này."
            ], 400);
        }

        // 🔥 ĐÃ CẬP NHẬT: Chuẩn hóa và mở rộng bộ lọc phân quyền cho cả Admin, Quản lý và Môi giới
        // Chuyển role về chữ viết hoa để check chuẩn xác bất kể DB ông đang lưu chữ hoa hay chữ thường
        $roleClean = strtoupper(trim($user->role ?? ''));

        // Danh sách các quyền được phép đặt chân vào trang quản trị Bcons
        $allowedRoles = [
            'ADMIN', 'EDITOR',
            'MANAGER', 'QUAN_LY', 'QUẢN LÝ',
            'BROKER', 'MOI_GIOI', 'MÔI GIỚI'
        ];

        if (!in_array($roleClean, $allowedRoles)) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản không có quyền truy cập vào vùng quản trị này.'
            ], 403);
        }

        // GIỮ NGUYÊN: Tạo Token tạm thời dạng base64 theo cấu trúc cũ của ông
        $secretKey = 'Bcons_Design_System_Secret_Key';
        $tokenPayload = $user->id . '|' . time() . '|' . sha1($user->email . $secretKey);
        $token = base64_encode($tokenPayload);

        // GIỮ NGUYÊN 100% cấu trúc UI/UX data trả về cho Frontend Astro bốc tách
        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'fullname' => $user->fullname,
                'email' => $user->email,
                'role' => $user->role, // Trả về nguyên bản để Client bọc lọc khớp menu
                'avatar' => $user->avatar
            ]
        ], 200);
    }
}
