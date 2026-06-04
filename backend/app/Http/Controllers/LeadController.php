<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Models\Lead; // Đảm bảo ông đã chạy lệnh php artisan migrate tạo bảng ghim Lead rồi nhé
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký vào để ghi log trực tiếp

class LeadController extends Controller
{
    /**
     * API Tiếp nhận thông tin Đăng ký từ Form CTA Trang Chủ
     * Xử lý lưu Database siêu tốc (Lược bỏ hoàn toàn Mail tránh nghẽn luồng)
     * URL target: POST /api/leads
     */
    public function store(Request $request)
    {
        // 1. Kiểm duyệt dữ liệu đầu vào (Chỉ bắt buộc có số điện thoại)
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Thiếu số điện thoại hoặc định dạng không hợp lệ.'
            ], 400);
        }

        try {
            // 2. Khử trùng dữ liệu đầu vào thô chống tấn công chèn mã độc XSS
            $name    = htmlspecialchars(trim($request->input('name', 'Ẩn danh')), ENT_QUOTES, 'UTF-8');
            $phone   = htmlspecialchars(trim($request->input('phone')), ENT_QUOTES, 'UTF-8');
            $project = htmlspecialchars(trim($request->input('project', 'Trang chủ Bcons')), ENT_QUOTES, 'UTF-8');
            $source  = htmlspecialchars(trim($request->input('source', 'CTA Form')), ENT_QUOTES, 'UTF-8');

            // 🔥 PHÂN LOẠI NHU CẦU: Hứng mốc trạng thái 'bao_gia' hoặc 'tham_quan_nha_mau' từ Frontend
            $status  = htmlspecialchars(trim($request->input('status', 'bao_gia')), ENT_QUOTES, 'UTF-8');

            // 3. Thực thi lưu thẳng bản ghi vào Cơ sở dữ liệu thông qua Eloquent Model
            $lead = Lead::create([
                'name'    => $name,
                'phone'   => $phone,
                'project' => $project,
                'source'  => $source,
                'status'  => $status, // Lưu chuẩn trạng thái yêu cầu thực tế của khách
            ]);

            // Trả về JSON phản hồi siêu tốc về cho Frontend Astro
            return response()->json([
                'success' => true,
                'message' => '🎉 Đăng ký thành công! Hệ thống đã ghi nhận yêu cầu tư vấn của ông.',
                'lead_id' => $lead->id
            ], 200);

        } catch (\Exception $e) {
            // Ghi nhận vết lỗi hệ thống vào log phòng hờ trường hợp sập mạng DB
            Log::error('Lỗi nghiêm trọng luồng xử lý lưu Lead Database: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Hệ thống đang bận, không thể ghi nhận thông tin đăng ký lúc này.'
            ], 500);
        }
    }

    /**
     * 🔥 API MỚI 2: Đổ danh sách Lead vào trang quản trị Admin Form
     * Hỗ trợ: Phân trang, Tìm kiếm tên/SĐT, Lọc theo dự án, Lọc theo trạng thái yêu cầu
     * URL: GET /api/admin/leads
     */
    public function index(Request $request)
    {
        try {
            $query = Lead::query();

            // 1. Bộ lọc tìm kiếm nhanh theo Tên hoặc Số điện thoại
            if ($request->has('search') && !empty($request->search)) {
                $search = trim($request->search);
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('phone', 'LIKE', "%{$search}%");
                });
            }

            // 2. Bộ lọc theo Dự án quan tâm
            if ($request->has('project') && !empty($request->project) && $request->project !== 'all') {
                $query->where('project', $request->project);
            }

            // 3. Bộ lọc theo Trạng thái / Yêu cầu (bao_gia, tham_quan_nha_mau, dang_tu_van,...)
            if ($request->has('status') && !empty($request->status) && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            // 🔥 Luôn ưu tiên ông nào mới để lại thông tin lên trên cùng
            $leads = $query->orderBy('id', 'desc')->paginate(15);

            return response()->json([
                'success' => true,
                'data' => $leads->items(),
                'pagination' => [
                    'current_page' => $leads->currentPage(),
                    'last_page'    => $leads->lastPage(),
                    'per_page'     => $leads->perPage(),
                    'total'        => $leads->total(),
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi lấy danh sách Admin Lead: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Không thể tải danh sách khách hàng.'], 500);
        }
    }

    /**
     * 🔥 API MỚI 3: Cập nhật trạng thái xử lý cuộc gọi cho Sales
     * URL: PUT /api/admin/leads/{id}/status
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Trạng thái cập nhật không hợp lệ.'], 400);
        }

        try {
            $lead = Lead::find($id);

            if (!$lead) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy thông tin khách hàng này.'], 404);
            }

            // 1. 🔥 LƯU LẠI TRẠNG THÁI CŨ TRƯỚC KHI ĐỔI MỚI
            $oldStatus = $lead->status;

            // Cập nhật mốc trạng thái mới (Ví dụ: dang_tu_van, da_chot, khong_nhac_may...)
            $newStatus = htmlspecialchars(trim($request->input('status')), ENT_QUOTES, 'UTF-8');
            $lead->status = $newStatus;
            $lead->save();

            // 2. 🔥 BỐC TÊN ĐÍCH DANH ADMIN ĐANG ĐĂNG NHẬP (Lấy cột fullname chuẩn của bảng users)
            $adminName = auth()->user()?->fullname ?? 'Ẩn danh';

            // 3. 🔥 DỊCH TỪ KHÓA SANG TIẾNG VIỆT ĐỂ DASHBOARD HIỂN THỊ ĐẸP
            $statusLabels = [
                'bao_gia' => 'Cần báo giá',
                'tham_quan_nha_mau' => 'Đăng ký nhà mẫu',
                'dang_tu_van' => 'Đang tư vấn',
                'da_chot' => 'Đã chốt cọc 💎',
                'sai_so' => 'Sai số / Hủy bỏ'
            ];
            $oldText = $statusLabels[$oldStatus] ?? $oldStatus;
            $newText = $statusLabels[$newStatus] ?? $newStatus;

            // 4. 🔥 GHI NHẬT KÝ HOẠT ĐỘNG (Dùng hàm static write chuẩn có sẵn của ông)
            ActivityLog::write(
                'Cập nhật trạng thái',
                // 'Quản lý khách hàng',
                "Đã cập nhật trạng thái của khách hàng [{$lead->name} - SĐT: {$lead->phone}] từ [{$oldText}] sang [{$newText}]."
            );

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật trạng thái chăm sóc khách hàng và ghi nhật ký thành công!',
                'data' => $lead
            ], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi cập nhật trạng thái Lead: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Không thể cập nhật trạng thái lúc này.'], 500);
        }
    }
}
