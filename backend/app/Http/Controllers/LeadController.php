<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache; // Gọi bộ nhớ đệm Cache hệ thống để xích cổ IP Bot
use App\Models\Lead;
use App\Models\ActivityLog;

class LeadController extends Controller
{
    /**
     * API Tiếp nhận thông tin Đăng ký từ Form CTA Trang Chủ & Trang Liên Hệ
     * KHÓA CỨNG IP BẢO MẬT: CHỈ CHO PHÉP GỬI 1 LẦN / 1 NGÀY (24 GIỜ) TRÊN MỖI IP
     */
    public function store(Request $request)
    {
        // 🔒 LỚP GIÁP 1: KHÓA CỨNG REGEX SĐT VIỆT NAM
        $validator = Validator::make($request->all(), [
            'phone' => [
                'required',
                'string',
                'regex:/^(0|84)(3|5|7|8|9)[0-9]{8}$/'
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Số điện thoại không hợp lệ hoặc không đúng định dạng Việt Nam.'
            ], 400);
        }

        try {
            $ipAddress = $request->ip();
            $phone = htmlspecialchars(trim($request->input('phone')), ENT_QUOTES, 'UTF-8');

            // 🔒 LỚP GIÁP 2: THIẾT LẬP VÒNG KIM CÔ FILE CACHE - KHÓA IP 1 NGÀY (24 GIỜ)
            $cacheKey = 'lead_block_ip_24h:' . md5($ipAddress);

            if (Cache::driver('file')->has($cacheKey)) {
                Log::warning("Phát hiện Spam Bot hoặc cố tình nã form. Đã chặn đứng IP: {$ipAddress} | SĐT: {$phone}");
                return response()->json([
                    'success' => true,
                    'message' => '🎉 Đăng ký thành công! Hệ thống đã ghi nhận yêu cầu tư vấn của ông.',
                ], 200);
            }

            // 🔒 LỚP GIÁP BỔ TÚC: Kiểm tra trùng số điện thoại trong 5 phút
            $hasIpColumn = Schema::hasColumn('leads', 'ip_address');
            $isPhoneSpam = DB::table('leads')
                ->where('phone', $phone)
                ->where('created_at', '>=', now()->subMinutes(5))
                ->exists();

            if ($isPhoneSpam) {
                return response()->json([ 'success' => true, 'message' => '🎉 Đăng ký thành công! Hệ thống đã ghi nhận yêu cầu tư vấn của ông.' ], 200);
            }

            // 3. KHỬ TRÙNG TOÀN DIỆN NỘI DUNG CHỐNG XSS
            $name    = htmlspecialchars(trim($request->input('name', 'Ẩn danh')), ENT_QUOTES, 'UTF-8');
            $project = htmlspecialchars(trim($request->input('project', 'Trang chủ Bcons')), ENT_QUOTES, 'UTF-8');
            $source  = htmlspecialchars(trim($request->input('source', 'CTA Form')), ENT_QUOTES, 'UTF-8');
            $status  = htmlspecialchars(trim($request->input('status', 'bao_gia')), ENT_QUOTES, 'UTF-8');

            // Khởi tạo thực thể bằng "new Lead" để né lỗi MassAssignmentException
            $lead = new Lead();
            $lead->name = $name;
            $lead->phone = $phone;
            $lead->project = $project;
            $lead->source = $source;
            $lead->status = $status;

            if ($hasIpColumn) {
                $lead->ip_address = $ipAddress;
            }

            $lead->save();

            // KÍCH HOẠT KHÓA IP 24 GIỜ
            Cache::driver('file')->put($cacheKey, true, now()->addHours(24));

            return response()->json([
                'success' => true,
                'message' => '🎉 Đăng ký thành công! Hệ thống đã ghi nhận yêu cầu tư vấn của ông.',
                'lead_id' => $lead->id
            ], 200);

        } catch (\Throwable $e) {
            Log::error('Lỗi nghiêm trọng luồng xử lý lưu Lead Database: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Hệ thống đang bận, không thể ghi nhận thông tin đăng ký lúc này.'
            ], 500);
        }
    }

    /**
     * 🔥 API 2: Đổ danh sách Lead vào trang quản trị Admin Form
     */
    public function index(Request $request)
    {
        try {
            $query = Lead::query();

            if ($request->has('search') && !empty($request->search)) {
                $search = trim($request->search);
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('phone', 'LIKE', "%{$search}%");
                });
            }

            if ($request->has('project') && !empty($request->project) && $request->project !== 'all') {
                $query->where('project', $request->project);
            }

            if ($request->has('status') && !empty($request->status) && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            $leads = $query->orderBy('id', 'desc')->paginate(15);

            return response()->json([
                'success' => true,
                'data' => $leads->items(),
                'pagination' => [
                    'current_page' => $leads->currentPage(),
                    'last_page'    => $leads->lastPage(),
                    'per_page'     => $leads->perPage(),
                    'total'        => $leads->total(), // 🔥 ĐÃ SỬA CHÍ MẠNG: Thay -> bằng => chuẩn cú pháp PHP
                ]
            ], 200);

        } catch (\Throwable $e) {
            Log::error('Lỗi lấy danh sách Admin Lead: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Không thể tải danh sách khách hàng.'], 500);
        }
    }

    /**
     * 🔥 API 3: Cập nhật trạng thái xử lý cuộc gọi cho Sales
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

            $oldStatus = $lead->status;
            $newStatus = htmlspecialchars(trim($request->input('status')), ENT_QUOTES, 'UTF-8');
            $lead->status = $newStatus;
            $lead->save();

            $statusLabels = [
                'bao_gia' => 'Cần báo giá',
                'tham_quan_nha_mau' => 'Đăng ký nhà mẫu',
                'dang_tu_van' => 'Đang tư vấn',
                'da_chot' => 'Đã chốt cọc 💎',
                'sai_so' => 'Sai số / Hủy bỏ'
            ];
            $oldText = $statusLabels[$oldStatus] ?? $oldStatus;
            $newText = $statusLabels[$newStatus] ?? $newStatus;

            ActivityLog::write(
                'Cập nhật trạng thái',
                "Đã cập nhật trạng thái của khách hàng [{$lead->name} - SĐT: {$lead->phone}] từ [{$oldText}] sang [{$newText}]."
            );

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật trạng thái chăm sóc khách hàng và ghi nhật ký thành công!',
                'data' => $lead
            ], 200);

        } catch (\Throwable $e) {
            Log::error('Lỗi cập nhật trạng thái Lead: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Không thể cập nhật trạng thái lúc này.'], 500);
        }
    }
}
