<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Consignment;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ConsignmentController extends Controller
{
    /**
     * 1. TIẾP NHẬN ĐĂNG KÝ KÝ GỬI TỪ KHÁCH HÀNG (PUBLIC API)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone'   => 'required|string',
            'project' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Vui lòng cung cấp số điện thoại và tên dự án.'], 400);
        }

        try {
            $consignment = new Consignment();
            $consignment->name           = htmlspecialchars(trim($request->input('name', 'Ẩn danh')), ENT_QUOTES, 'UTF-8');
            $consignment->phone          = htmlspecialchars(trim($request->input('phone')), ENT_QUOTES, 'UTF-8');
            $consignment->type           = htmlspecialchars(trim($request->input('type', 'ban')), ENT_QUOTES, 'UTF-8');
            $consignment->project        = htmlspecialchars(trim($request->input('project')), ENT_QUOTES, 'UTF-8');
            $consignment->apartment_code = htmlspecialchars(trim($request->input('apartment_code', 'N/A')), ENT_QUOTES, 'UTF-8');
            $consignment->price          = htmlspecialchars(trim($request->input('price', 'Thỏa thuận')), ENT_QUOTES, 'UTF-8');
            $consignment->notes          = htmlspecialchars(trim($request->input('notes', '')), ENT_QUOTES, 'UTF-8');
            $consignment->status         = 'moi';
            $consignment->save();

            $typeText = $consignment->type === 'ban' ? 'Ký gửi Bán 💰' : 'Ký gửi Cho Thuê 🔑';
            ActivityLog::write(
                'Thêm mới ➕',
                'Quản lý ký gửi',
                "Khách chủ nhà [{$consignment->name} - SĐT: {$consignment->phone}] vừa gửi căn [{$consignment->apartment_code}] tại dự án [{$consignment->project}] mẫu [{$typeText}]."
            );

            return response()->json([
                'success' => true,
                'message' => '🎉 Tiếp nhận hồ sơ ký gửi thành công!'
            ], 201);

        } catch (\Exception $e) {
            Log::error('Lỗi tiếp nhận ký gửi: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Hệ thống bận.'], 500);
        }
    }

    /**
     * 2. LẤY DANH SÁCH KÝ GỬI CHO ADMIN (Không dùng phân trang trả mảng để chạy bộ lọc Client-side siêu tốc giống trang Posts)
     * URL: GET /api/admin/consignments
     */
    public function index(Request $request)
    {
        try {
            $consignments = Consignment::orderBy('id', 'desc')->get();
            return response()->json($consignments, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi kết nối dữ liệu: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 🔥 THÊM MỚI 3: CẬP NHẬT TRẠNG THÁI DUYỆT HÀNG KÝ GỬI
     * URL: PUT /api/admin/consignments/{id}/status
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Trạng thái không hợp lệ.'], 400);
        }

        try {
            $consignment = Consignment::findOrFail($id);
            $oldStatus = $consignment->status;

            $newStatus = htmlspecialchars(trim($request->input('status')), ENT_QUOTES, 'UTF-8');
            $consignment->status = $newStatus;
            $consignment->save();

            $adminName = auth()->user()?->fullname ?? 'Ẩn danh';
            $statusLabels = ['moi' => 'Mới nhận', 'dang_ra_hang' => 'Đang ra hàng', 'da_chot' => 'Đã chốt xong 💎', 'huy' => 'Hủy bỏ'];
            $oldText = $statusLabels[$oldStatus] ?? $oldStatus;
            $newText = $statusLabels[$newStatus] ?? $newStatus;

            // Ghi log vết
            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Quản lý ký gửi',
                "Nhân sự [{$adminName}] đổi trạng thái căn [{$consignment->apartment_code}] của khách [{$consignment->name}] từ [{$oldText}] sang [{$newText}]."
            );

            return response()->json(['success' => true, 'message' => 'Cập nhật tiến độ ký gửi thành công!'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi xử lý server.'], 500);
        }
    }

    /**
     * 🔥 THÊM MỚI 4: XÓA LƯỢT KÝ GỬI
     * URL: DELETE /api/admin/consignments/{id}
     */
    public function destroy($id)
    {
        try {
            $consignment = Consignment::findOrFail($id);
            $info = "[Căn: {$consignment->apartment_code} - Chủ nhà: {$consignment->name}]";
            $consignment->delete();

            $adminName = auth()->user()?->fullname ?? 'Ẩn danh';
            ActivityLog::write(
                'Xóa bỏ ❌',
                'Quản lý ký gửi',
                "Nhân sự [{$adminName}] đã gỡ hoàn toàn hồ sơ ký gửi hồ sơ {$info} ra khỏi MySQL."
            );

            return response()->json(['success' => true, 'message' => 'Xóa hồ sơ thành công!'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi lệnh gỡ bỏ.'], 500);
        }
    }
}
