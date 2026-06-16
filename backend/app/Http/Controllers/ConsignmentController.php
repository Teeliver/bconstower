<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Consignment;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema; // 🔥 IMPORT: Bọc lót kiểm tra cột ip_address thực tế của bảng
use Illuminate\Support\Facades\DB;     // 🔥 IMPORT: Chạy truy vấn quét trùng số điện thoại
use Illuminate\Support\Facades\Cache;  // 🔥 IMPORT: Triển khai đai siết xích cổ IP bot rác 24h

class ConsignmentController extends Controller
{
    /**
     * 1. TIẾP NHẬN ĐĂNG KÝ KÝ GỬI TỪ KHÁCH HÀNG (PUBLIC API)
     * KHÓA CỨNG IP BẢO MẬT ĐỒNG BỘ: CHỈ CHO PHÉP GỬI HỒ SƠ 1 LẦN / 1 NGÀY (24 GIỜ)
     */
    public function store(Request $request)
    {
        // 🔒 LỚP GIÁP 1: KHÓA CỨNG ĐỊNH DẠNG SĐT VIỆT NAM (Gõ số bậy bạ block từ vòng gửi xe)
        $validator = Validator::make($request->all(), [
            'phone'   => [
                'required',
                'string',
                'regex:/^(0|84)(3|5|7|8|9)[0-9]{8}$/' // Bắt buộc đầu số VN (03,05,07,08,09) đủ 10 số
            ],
            'project' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Vui lòng cung cấp đúng định dạng số điện thoại Việt Nam và dự án cần ký gửi.'], 400);
        }

        try {
            $ipAddress = $request->ip();
            $phone = htmlspecialchars(trim($request->input('phone')), ENT_QUOTES, 'UTF-8');

            // 🔒 LỚP GIÁP 2: THIẾT LẬP VÒNG KIM CÔ FILE CACHE - KHÓA IP KÝ GỬI 24 GIỜ
            $cacheKey = 'consignment_block_ip_24h:' . md5($ipAddress);

            if (Cache::driver('file')->has($cacheKey)) {
                Log::warning("Phát hiện Spam Bot nã API Ký Gửi trực tiếp. Đã chặn đứng IP: {$ipAddress} | SĐT: {$phone}");

                // 🚀 CHIÊU ĐÁNH LỪA UX: Trả về Fake JSON Success 201 để lừa Bot tưởng phá hoại thành công, nhưng SERVER KHÔNG LƯU GÌ VÀO DB!
                return response()->json([
                    'success' => true,
                    'message' => '🎉 Tiếp nhận hồ sơ ký gửi thành công!'
                ], 201);
            }

            // 🔒 LỚP GIÁP BỔ TÚC: Chống trường hợp Bot chạy đa luồng nã trùng số điện thoại liên tục trong 5 phút
            $hasIpColumn = Schema::hasColumn('consignments', 'ip_address');
            $isPhoneSpam = DB::table('consignments')
                ->where('phone', $phone)
                ->where('created_at', '>=', now()->subMinutes(5))
                ->exists();

            if ($isPhoneSpam) {
                return response()->json([ 'success' => true, 'message' => '🎉 Tiếp nhận hồ sơ ký gửi thành công!' ], 201);
            }

            // 3. THỰC THI KHỬ TRÙNG VÀ LƯU DỮ LIỆU SẠCH
            $consignment = new Consignment();
            $consignment->name           = htmlspecialchars(trim($request->input('name', 'Ẩn danh')), ENT_QUOTES, 'UTF-8');
            $consignment->phone          = $phone;
            $consignment->type           = htmlspecialchars(trim($request->input('type', 'ban')), ENT_QUOTES, 'UTF-8');
            $consignment->project        = htmlspecialchars(trim($request->input('project')), ENT_QUOTES, 'UTF-8');
            $consignment->apartment_code = htmlspecialchars(trim($request->input('apartment_code', 'N/A')), ENT_QUOTES, 'UTF-8');
            $consignment->price          = htmlspecialchars(trim($request->input('price', 'Thỏa thuận')), ENT_QUOTES, 'UTF-8');
            $consignment->notes          = htmlspecialchars(trim($request->input('notes', '')), ENT_QUOTES, 'UTF-8');
            $consignment->status         = 'moi';

            if ($hasIpColumn) {
                $consignment->ip_address = $ipAddress;
            }

            $consignment->save();

            // 🔒 KÍCH HOẠT KHÓA IP: Người thật lưu thành công -> Khóa cứng IP này 24 giờ (1440 phút)
            Cache::driver('file')->put($cacheKey, true, now()->addHours(24));

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

        } catch (\Throwable $e) { // Đồng bộ Throwable bắt trọn mọi lỗi Fatal ngầm
            Log::error('Lỗi tiếp nhận ký gửi: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Hệ thống đang bận, vui lòng gửi lại sau ít phút.'], 500);
        }
    }

    /**
     * 2. LẤY DANH SÁCH KÝ GỬI CHO ADMIN
     * URL: GET /api/admin/consignments
     */
    public function index(Request $request)
    {
        try {
            $consignments = Consignment::orderBy('id', 'desc')->get();
            return response()->json($consignments, 200);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi kết nối dữ liệu: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 🔥 3: CẬP NHẬT TRẠNG THÁI DUYỆT HÀNG KÝ GỬI
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

            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Quản lý ký gửi',
                "Nhân sự [{$adminName}] đổi trạng thái căn [{$consignment->apartment_code}] của khách [{$consignment->name}] từ [{$oldText}] sang [{$newText}]."
            );

            return response()->json(['success' => true, 'message' => 'Cập nhật tiến độ ký gửi thành công!'], 200);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi xử lý server.'], 500);
        }
    }

    /**
     * 🔥 4: XÓA LƯỢT KÝ GỬI
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
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi lệnh gỡ bỏ.'], 500);
        }
    }
}
