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

        // 🔥 BỌC TRY-CATCH ĐỂ ĐỐI CHIẾU THUẬT TOÁN HASH CŨ
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

        // Quyền truy cập
        if ($user->role !== 'ADMIN' && $user->role !== 'EDITOR') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản không có quyền truy cập.'
            ], 403);
        }

        // Tạo Token tạm thời
        $secretKey = 'Bcons_Design_System_Secret_Key';
        $tokenPayload = $user->id . '|' . time() . '|' . sha1($user->email . $secretKey);
        $token = base64_encode($tokenPayload);

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'fullname' => $user->fullname,
                'email' => $user->email,
                'role' => $user->role,
                'avatar' => $user->avatar
            ]
        ], 200);
    }
}
