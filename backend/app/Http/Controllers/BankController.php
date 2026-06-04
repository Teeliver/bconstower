<?php

namespace App\Http\Controllers;

use App\Models\Bank;
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký hệ thống xử lý ghi vết trực tiếp
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BankController extends Controller
{
    /**
     * 1. LẤY DANH SÁCH NGÂN HÀNG LIÊN KẾT
     */
    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('banks')) {
                return response()->json(['success' => false, 'message' => 'Bảng dữ liệu banks không tồn tại.'], 404);
            }

            // Lấy danh sách sắp xếp theo ngày tạo mới nhất
            $banks = Bank::orderBy('created_at', 'desc')->get();

            return response()->json($banks, 200);

        } catch (\Exception $e) {
            Log::error('BankController index error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi máy chủ khi tải danh sách ngân hàng.'], 500);
        }
    }

    /**
     * 2. XEM CHI TIẾT MỘT NGÂN HÀNG
     */
    public function show($id): JsonResponse
    {
        try {
            $bank = Bank::find($id);

            if (!$bank) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy ngân hàng yêu cầu.'], 404);
            }

            return response()->json($bank, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 3. THÊM MỚI NGÂN HÀNG
     */
    public function store(Request $request): JsonResponse
    {
        // 🔒 BẢO MẬT: Kiểm tra kiểu dữ liệu nghiêm ngặt, giới hạn biên decimal(4,2) từ 0 đến 99.99
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp,svg|max:2048', // Giới hạn ảnh logo sạch dưới 2MB
            'preferential_rate' => 'required|numeric|between:0,99.99',    // Lãi suất ưu đãi
            'preferential_term' => 'required|integer|min:0',               // Thời gian ưu đãi (tháng)
            'floating_rate' => 'required|numeric|between:0,99.99',        // Lãi suất thả nổi
            'max_term' => 'required|integer|min:0',                       // Thời gian vay tối đa (tháng)
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $bank = new Bank();
            $bank->name = trim($request->name);
            $bank->preferential_rate = $request->preferential_rate;
            $bank->preferential_term = $request->preferential_term;
            $bank->floating_rate = $request->floating_rate;
            $bank->max_term = $request->max_term;

            // Xử lý upload ảnh Logo an toàn, tự động đổi tên file ngẫu nhiên chống ghi đè
            if ($request->hasFile('logo')) {
                $path = public_path('upload/banks');
                if (!file_exists($path)) mkdir($path, 0755, true);

                $filename = 'bank-' . time() . '-' . Str::random(5) . '.' . $request->file('logo')->getClientOriginalExtension();
                $request->file('logo')->move($path, $filename);
                $bank->logo = '/upload/banks/' . $filename;
            }

            $bank->save();

            // 📝 GHI LOG THÊM MỚI ĐỐI TÁC NGÂN HÀNG TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Thêm mới ➕',
                'Ngân hàng liên kết',
                "Người dùng [{$staffName}] đã thêm mới đối tác ngân hàng [{$bank->name}] vào hệ thống tính toán khoản vay."
            );

            return response()->json(['success' => true, 'message' => 'Thêm ngân hàng liên kết thành công!', 'data' => $bank], 201);

        } catch (\Exception $e) {
            Log::error('BankController store error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Thất bại: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 4. CẬP NHẬT THÔNG TIN NGÂN HÀNG
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $bank = Bank::find($id);
            if (!$bank) {
                return response()->json(['success' => false, 'message' => 'Ngân hàng không tồn tại trên hệ thống.'], 404);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp,svg|max:2048',
                'preferential_rate' => 'required|numeric|between:0,99.99',
                'preferential_term' => 'required|integer|min:0',
                'floating_rate' => 'required|numeric|between:0,99.99',
                'max_term' => 'required|integer|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $bank->name = trim($request->name);
            $bank->preferential_rate = $request->preferential_rate;
            $bank->preferential_term = $request->preferential_term;
            $bank->floating_rate = $request->floating_rate;
            $bank->max_term = $request->max_term;

            if ($request->hasFile('logo')) {
                if ($bank->logo && file_exists(public_path($bank->logo))) {
                    @unlink(public_path($bank->logo));
                }

                $path = public_path('upload/banks');
                if (!file_exists($path)) mkdir($path, 0755, true);

                $filename = 'bank-' . $id . '-' . time() . '.' . $request->file('logo')->getClientOriginalExtension();
                $request->file('logo')->move($path, $filename);
                $bank->logo = '/upload/banks/' . $filename;
            }

            $bank->save();

            // 📝 GHI LOG CẬP NHẬT THÔNG TIN NGÂN HÀNG TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Ngân hàng liên kết',
                "Tài khoản [{$staffName}] đã cập nhật lại các chỉ số tài chính và lãi suất của ngân hàng [{$bank->name}]."
            );

            return response()->json(['success' => true, 'message' => 'Cập nhật dữ liệu ngân hàng thành công!', 'data' => $bank], 200);

        } catch (\Exception $e) {
            Log::error('BankController update error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi cập nhật: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 5. XÓA NGÂN HÀNG LIÊN KẾT (Cập nhật Request để bốc user)
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $bank = Bank::find($id);
            if (!$bank) {
                return response()->json(['success' => false, 'message' => 'Mục ngân hàng này không tồn tại.'], 404);
            }

            $bankName = $bank->name; // Lưu lại tên đối tác trước khi gỡ vĩnh viễn

            if ($bank->logo && file_exists(public_path($bank->logo))) {
                @unlink(public_path($bank->logo));
            }

            $bank->delete();

            // 📝 GHI LOG XÓA ĐỐI TÁC NGÂN HÀNG TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Xóa bỏ ❌',
                'Ngân hàng liên kết',
                "Tài khoản [{$staffName}] đã gỡ bỏ hoàn toàn đối tác ngân hàng [{$bankName}] ra khỏi hệ thống Portal."
            );

            return response()->json(['success' => true, 'message' => 'Đã xóa ngân hàng liên kết khỏi danh mục.'], 200);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi xóa dữ liệu: ' . $e->getMessage()], 500);
        }
    }
}
