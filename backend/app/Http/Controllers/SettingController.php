<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký hệ thống xử lý ghi vết trực tiếp
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    /**
     * 1. LẤY THÔNG TIN CẤU HÌNH HỆ THỐNG (Đọc dòng đầu tiên)
     */
    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('settings')) {
                return response()->json(['success' => false, 'message' => 'Bảng settings chưa tồn tại.'], 404);
            }

            // Luôn bốc dòng đầu tiên (hoặc tự tạo mới dòng id = 1 trống nếu chưa có gì)
            $setting = Setting::firstOrCreate(['id' => 1]);

            return response()->json($setting, 200);

        } catch (\Exception $e) {
            Log::error('SettingController index error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi máy chủ: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 2. CẬP NHẬT TOÀN DIỆN HỆ THỐNG
     */
    public function update(Request $request): JsonResponse
    {
        // 🔒 BẢO MẬT: Kiểm soát định dạng tệp tin, dọn sạch MIME-type chống tải mã độc PHP ẩn danh
        $validator = Validator::make($request->all(), [
            'site_title' => 'nullable|string|max:255',
            'hotline' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'facebook_url' => 'nullable|url|max:255',
            'zalo_url' => 'nullable|string|max:255',
            'youtube_url' => 'nullable|url|max:255',
            'google_analytics' => 'nullable|string|max:50',
            'favicon' => 'nullable|file|mimes:ico,png,jpg,jpeg,cur|max:1024', // Chặn Favicon > 1MB
            'og_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:3072', // Ảnh share mạng xã hội < 3MB
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp,svg|max:3072',     // Logo chính
            'logo_footer' => 'nullable|image|mimes:jpeg,png,jpg,webp,svg|max:3072', // Logo chân trang
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $setting = Setting::firstOrCreate(['id' => 1]);

            // 1. Đồng bộ các trường văn bản thuần dữ liệu (Lọc khoảng trắng thừa)
            $setting->site_title = $request->filled('site_title') ? trim($request->site_title) : null;
            $setting->site_description = $request->input('site_description');
            $setting->hotline = $request->filled('hotline') ? preg_replace('/\s+/', '', $request->hotline) : null;
            $setting->email = $request->filled('email') ? trim(strtolower($request->email)) : null;
            $setting->address = $request->input('address');
            $setting->copyright = $request->input('copyright');
            $setting->facebook_url = $request->input('facebook_url');
            $setting->zalo_url = $request->input('zalo_url');
            $setting->youtube_url = $request->input('youtube_url');
            $setting->google_analytics = $request->input('google_analytics');

            // 🔒 BIỆN PHÁP BẢO VỆ: Giữ nguyên mã cấu hình thô, chỉ Admin duyệt qua middleware mới được đẩy lệnh lưu
            $setting->custom_scripts = $request->input('custom_scripts');

            // 2. Xử lý lưu trữ an toàn cho 4 loại tệp tin ảnh hệ thống
            $fileFields = ['favicon', 'og_image', 'logo', 'logo_footer'];
            foreach ($fileFields as $field) {
                if ($request->hasFile($field)) {
                    // Tự động gỡ bỏ tệp tin ảnh cũ trên ổ cứng để chống phình dung lượng lưu trữ của máy chủ
                    if ($setting->$field && file_exists(public_path($setting->$field))) {
                        @unlink(public_path($setting->$field));
                    }

                    $path = public_path('upload/system');
                    if (!file_exists($path)) mkdir($path, 0755, true);

                    // Tạo chuỗi tên file ngẫu nhiên bảo mật tuyệt đối, tránh bị đoán lộ link ảnh hệ thống
                    $filename = $field . '-' . time() . '-' . Str::random(6) . '.' . $request->file($field)->getClientOriginalExtension();
                    $request->file($field)->move($path, $filename);

                    $setting->$field = '/upload/system/' . $filename;
                }
            }

            $setting->save();

            // 📝 GHI LOG CẬP NHẬT CẤU HÌNH HỆ THỐNG TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Cấu hình hệ thống',
                "Tài khoản [{$staffName}] đã tiến hành thay đổi và cập nhật lại cấu hình SEO Meta & Thông tin liên hệ của website."
            );

            return response()->json(['success' => true, 'message' => 'Cấu hình hệ thống Bcons Portal đã được cập nhật thành công!', 'data' => $setting], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi lưu trữ dữ liệu tại SettingController update: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Thất bại: ' . $e->getMessage()], 500);
        }
    }

    /**
     * API Lấy cấu hình hệ thống phục vụ Footer và SEO Meta
     * URL: GET /api/settings
     */
    public function getSettings()
    {
        try {
            if (!\Schema::hasTable('settings')) {
                return response()->json(['success' => false, 'message' => 'Bảng cấu hình không tồn tại'], 404);
            }

            $settings = \DB::table('settings')->first();

            if (!$settings) {
                return response()->json(['success' => false, 'message' => 'Chưa có dữ liệu cấu hình'], 404);
            }

            // 🛡️ PHÒNG THỦ KHÁNG LỖI: Tự động bắt cặp trường nếu gõ lệch tên cột trong DB
            $hotlineData = $settings->hotline ?? ($settings->phone ?? ($settings->phone_number ?? '0911 502 603'));
            $addressData = $settings->address ?? ($settings->company_address ?? 'Văn phòng Bcons Tower');
            $descData = $settings->site_description ?? ($settings->footer_description ?? '');

            // 🔥 LẤY CHUẨN CỘT FAVICON TỪ TABLE SETTINGS
            $faviconData = $settings->favicon ?? ($settings->site_favicon ?? '/favicon.svg');

            $mainLogo = $settings->logo ?? ($settings->site_logo ?? ($settings->logo_footer ?? ''));
            $footerLogo = $settings->logo_footer ?? ($mainLogo ?? '');

            // 🛡️ BẢO MẬT TUYỆT ĐỐI: Khử trùng dữ liệu chống XSS
            return response()->json([
                'success' => true,
                'data'    => [
                    'site_title'       => htmlspecialchars($settings->site_title ?? '', ENT_QUOTES, 'UTF-8'),
                    'site_description' => htmlspecialchars($descData, ENT_QUOTES, 'UTF-8'),
                    'favicon'          => $faviconData, // Đẩy trường favicon chuẩn ra ngoài API
                    'hotline'          => htmlspecialchars($hotlineData, ENT_QUOTES, 'UTF-8'),
                    'email'            => htmlspecialchars($settings->email ?? '', ENT_QUOTES, 'UTF-8'),
                    'address'          => htmlspecialchars($addressData, ENT_QUOTES, 'UTF-8'),
                    'copyright'        => htmlspecialchars($settings->copyright ?? '', ENT_QUOTES, 'UTF-8'),
                    'facebook_url'     => $settings->facebook_url ?? ($settings->link_facebook ?? 'https://facebook.com'),
                    'zalo_url'         => $settings->zalo_url ?? ($settings->link_zalo ?? ''),
                    'youtube_url'      => $settings->youtube_url ?? ($settings->link_youtube ?? 'https://youtube.com'),
                    'logo'             => $mainLogo,
                    'logo_footer'      => $footerLogo
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Lỗi API Settings Tổng Hợp: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống cấu hình'], 500);
        }
    }


}
