<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\BrokerProfile;
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký hệ thống xử lý ghi vết trực tiếp
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * 1. DANH SÁCH THÀNH VIÊN KÈM HỒ SƠ MÔI GIỚI
     */
    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('users')) {
                return response()->json(['success' => false, 'message' => 'Bảng users không tồn tại.'], 404);
            }

            // Nạp dữ liệu (Eager Loading) gộp kèm profile môi giới
            $users = User::with('profile')->orderBy('created_at', 'desc')->get();

            $formatted = $users->map(function ($user) {
                return [
                    'id' => $user->id,
                    // 🔥 CHIẾN LƯỢC PHÒNG THỦ KÉP: Trả về cả name lẫn fullname để Frontend bốc kiểu gì cũng không lỗi
                    'name' => $user->fullname ?? 'Không tên',
                    'fullname' => $user->fullname ?? 'Không tên',
                    'email' => $user->email,
                    'role' => $user->role ?? 'USER',
                    'avatar' => $user->avatar ?? '',
                    'createdAt' => $user->created_at,
                    'profile' => $user->profile ? [
                        'licenseNumber' => $user->profile->license_number ?? '',
                        'companyName' => $user->profile->company_name ?? '',
                        'experienceYears' => $user->profile->experience_years ?? 0,
                        'areaFocus' => $user->profile->area_focus ?? '',
                        'bio' => $user->profile->bio ?? '',
                        'verified' => (bool)($user->profile->verified ?? 0),
                    ] : null
                ];
            });

            return response()->json($formatted, 200);

        } catch (\Exception $e) {
            Log::error('UserController index error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi tải danh sách: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 2. XEM CHI TIẾT THÀNH VIÊN
     */
    public function show($id): JsonResponse
    {
        try {
            $user = User::with('profile')->find($id);

            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Thành viên không tồn tại.'], 404);
            }

            return response()->json($user, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 3. TẠO MỚI THÀNH VIÊN VÀ HỒ SƠ MÔI GIỚI (Transaction an toàn kèm ghi log)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'fullname' => 'required|string|max:255',
            'email' => 'required|email|max:150|unique:users,email',
            'password' => 'required|string|min:6|max:32',
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();
        try {
            $user = new User();
            $user->fullname = $request->fullname;
            $user->email = trim(strtolower($request->email));
            $user->password = Hash::make($request->password);
            $user->phone = $request->phone;
            $user->address = $request->address;

            if (Schema::hasColumn('users', 'role')) {
                $user->role = $request->role ?? 'USER';
            }

            // Xử lý upload ảnh đại diện vào đúng cột avatar
            if ($request->hasFile('avatar')) {
                $path = public_path('upload/avatars');
                if (!file_exists($path)) mkdir($path, 0755, true);

                $filename = 'avatar-' . time() . '-' . Str::random(5) . '.' . $request->file('avatar')->getClientOriginalExtension();
                $request->file('avatar')->move($path, $filename);
                $user->avatar = '/upload/avatars/' . $filename;
            }

            $user->save();

            // Khởi tạo lưu bảng liên kết môi giới nếu có bảng thực tế
            $profileTable = (new BrokerProfile())->getTable();
            if (Schema::hasTable($profileTable)) {
                $profile = new BrokerProfile();
                $profile->user_id = $user->id;
                $profile->license_number = $request->license_number ?? $request->licenseNumber;
                $profile->company_name = $request->company_name ?? $request->companyName;
                $profile->experience_years = $request->experience_years ?? $request->experienceYears ?? 0;
                $profile->area_focus = $request->area_focus ?? $request->areaFocus;
                $profile->bio = $request->bio;
                $profile->verified = $request->boolean('verified', false) ? 1 : 0;
                $profile->save();
            }

            // 📝 GHI LOG THÊM MỚI TÀI KHOẢN TRỰC TIẾP (Trước khi commit)
            $authUser = $request->user();
            $adminName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Thêm mới ➕',
                'Tài khoản nhân sự',
                "Tài khoản [{$adminName}] đã đăng ký mới nhân sự/môi giới [{$user->fullname}] ({$user->email}) vào hệ thống."
            );

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Tạo thành viên môi giới mới thành công!', 'data' => $user], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('UserController store error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 4. CẬP NHẬT TÀI KHOẢN VÀ HỒ SƠ MÔI GIỚI (Ghi nhật ký thay đổi thông tin)
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $user = User::find($id);
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Thành viên không tồn tại.'], 404);
            }

            $validator = Validator::make($request->all(), [
                'email' => 'required|email|max:150|unique:users,email,' . $id,
                'password' => 'nullable|string|min:6|max:32',
                'avatar' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            DB::beginTransaction();

            $user->fullname = $request->fullname ?? $request->name ?? $user->fullname;
            $user->email = trim(strtolower($request->email));
            $user->phone = $request->phone ?? $user->phone;
            $user->address = $request->address ?? $user->address;

            if ($request->filled('password')) {
                $user->password = Hash::make($request->password);
            }

            if (Schema::hasColumn('users', 'role')) {
                $user->role = $request->role ?? $user->role;
            }

            if ($request->hasFile('avatar')) {
                if ($user->avatar && file_exists(public_path($user->avatar))) {
                    @unlink(public_path($user->avatar));
                }

                $path = public_path('upload/avatars');
                if (!file_exists($path)) mkdir($path, 0755, true);

                $filename = 'avatar-' . $id . '-' . time() . '.' . $request->file('avatar')->getClientOriginalExtension();
                $request->file('avatar')->move($path, $filename);
                $user->avatar = '/upload/avatars/' . $filename;
            }

            $user->save();

            $profileTable = (new BrokerProfile())->getTable();
            if (Schema::hasTable($profileTable)) {
                BrokerProfile::updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'license_number' => $request->license_number ?? $request->licenseNumber,
                        'company_name' => $request->company_name ?? $request->companyName,
                        'experience_years' => $request->experience_years ?? $request->experienceYears ?? 0,
                        'area_focus' => $request->area_focus ?? $request->areaFocus,
                        'bio' => $request->bio,
                        'verified' => $request->boolean('verified', false) ? 1 : 0,
                    ]
                );
            }

            // 📝 GHI LOG CẬP NHẬT TÀI KHOẢN TRỰC TIẾP
            $authUser = $request->user();
            $adminName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Tài khoản nhân sự',
                "Tài khoản [{$adminName}] đã cập nhật lại hồ sơ thông tin và phân quyền của [{$user->fullname}]."
            );

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Cập nhật thông tin môi giới thành công!', 'data' => $user], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Lỗi nghiêm trọng tại UserController@update: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Hệ thống sập: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 5. XÓA THÀNH VIÊN VÀ HỒ SƠ LIÊN KẾT (Chống tự xóa chính mình)
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $userToDelete = User::find($id);
            if (!$userToDelete) {
                return response()->json(['success' => false, 'message' => 'Thành viên không tồn tại.'], 404);
            }

            if ($request->user() && $request->user()->id == $id) {
                return response()->json(['success' => false, 'message' => '⚠️ Từ chối hành động! Bạn không được tự xóa tài khoản của chính mình khi đang làm việc.'], 400);
            }

            // Sao lưu lại tên nhân viên trước khi gỡ bỏ khỏi MySQL
            $deletedStaffName = $userToDelete->fullname ?? $userToDelete->name ?? 'Không tên';

            DB::beginTransaction();

            if ($userToDelete->avatar && file_exists(public_path($userToDelete->avatar))) {
                @unlink(public_path($userToDelete->avatar));
            }

            $profileTable = (new BrokerProfile())->getTable();
            if (Schema::hasTable($profileTable)) {
                BrokerProfile::where('user_id', $id)->delete();
            }

            $userToDelete->delete();

            // 📝 GHI LOG XÓA TÀI KHOẢN TRỰC TIẾP
            $authUser = $request->user();
            $adminName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Xóa bỏ ❌',
                'Tài khoản nhân sự',
                "Tài khoản [{$adminName}] đã gỡ bỏ hoàn toàn nhân sự [{$deletedStaffName}] ra khỏi danh sách nhân sự công ty."
            );

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Đã xóa tài khoản và mọi hồ sơ môi giới thành công.'], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Lỗi xóa dữ liệu: ' . $e->getMessage()], 500);
        }
    }
}
