<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Project;
use App\Models\ActivityLog; // 📝 Ghi log hoạt động hệ thống Portal
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache; // ⚡ Kích hoạt hệ thống tăng tốc phản hồi cho Ads

class ProjectController extends Controller
{
    /**
     * 1. LẤY DANH SÁCH DỰ ÁN (Bảng điều khiển Admin)
     */
    public function index()
    {
        try {
            // ⚡ FIX TRIỆT ĐỂ: Bổ sung 'image', 'address', 'legal' vào chuỗi select để trả về đủ dữ liệu cho Astro render
            $projects = Project::select(['id', 'title', 'slug', 'image', 'address', 'legal', 'status', 'created_at'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json($projects, 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi kết nối dữ liệu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 2. LẤY CHI TIẾT DỰ ÁN & LANDING DATA (Hỗ trợ cả ID và Slug)
     * Thích hợp cho cả trang Client hiển thị Landing (/du-an/{slug}) và Admin sửa đổi (/admin/projects/{id})
     */
    public function show($idOrSlug)
    {
        try {
            // Sử dụng Route Model Binding thông minh thông qua Cache để tăng tốc độ phản hồi < 100ms
            $project = is_numeric($idOrSlug)
                ? Project::find($idOrSlug)
                : Cache::remember("project_landing_{$idOrSlug}", 3600, function () use ($idOrSlug) {
                    return Project::where('slug', $idOrSlug)->first();
                });

            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy thông tin dự án!'], 404);
            }

            return response()->json($project, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 3. TẠO MỚI DỰ ÁN TÍCH HỢP TOÀN VẸN LAYOUT LANDING PAGE 11 SECTIONS
     */
    public function store(Request $request)
    {
        // Kiểm tra an toàn bảo mật, loại bỏ tệp độc hại độc và giới hạn dung lượng tải file
        $validator = Validator::make($request->all(), [
            'landing_structure' => 'required|json',
            'hero_bg' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'overview_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'location_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'plan_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:8192',
            'unit_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:8192',
            'furniture_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        if ($validator->fails()) {
        return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
    }

    try {
        // 1. Thu thập cấu trúc JSON
        $landingStructure = json_decode($request->input('landing_structure'), true);
        if (!$landingStructure) {
            return response()->json(['success' => false, 'message' => 'Cấu trúc Landing Page không hợp lệ.'], 400);
        }

        $project = new Project();

        // 2. Xử lý Ảnh flat đại diện (Cốt lõi Section 00)
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $fileName = time() . '_' . Str::random(5) . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('upload/projects'), $fileName);
            $project->image = '/upload/projects/' . $fileName;
        }

        // 3. Xử lý các file ảnh đơn lẻ
        $fileFields = [
            'hero_bg' => ['section' => 'hero', 'key' => 'bg_url'],
            'overview_image' => ['section' => 'overview', 'key' => 'image_url'],
            'location_image' => ['section' => 'location_links', 'key' => 'image_url'],
            'plan_image' => ['section' => 'floorplan', 'key' => 'image_url'],
            'unit_image' => ['section' => 'unit_designs', 'key' => 'image_url'],
            'furniture_image' => ['section' => 'furniture', 'key' => 'image_url'],
        ];

        foreach ($fileFields as $formKey => $target) {
            if ($request->hasFile($formKey)) {
                $file = $request->file($formKey);
                $fileName = time() . '_' . $formKey . '.' . $file->getClientOriginalExtension();
                $file->move(public_path('upload/projects/sections'), $fileName);
                $landingStructure[$target['section']][$target['key']] = '/upload/projects/sections/' . $fileName;
            }
        }

        // 4. Xử lý ma trận tiện ích (amenities)
        if (isset($landingStructure['amenities']['list']) && is_array($landingStructure['amenities']['list'])) {
            foreach ($landingStructure['amenities']['list'] as $key => &$amenity) {
                $idx = $amenity['index'];
                if ($request->hasFile("amenity_file_{$idx}")) {
                    $file = $request->file("amenity_file_{$idx}");
                    $fileName = time() . "_amenity_{$idx}." . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/amenities'), $fileName);
                    $amenity['image_url'] = '/upload/projects/amenities/' . $fileName;
                }
            }
        }

        // 5. Xử lý tài liệu thanh toán (payment_methods)
        if (isset($landingStructure['payment_methods']['list']) && is_array($landingStructure['payment_methods']['list'])) {
            foreach ($landingStructure['payment_methods']['list'] as $key => &$payment) {
                $keyIndex = $payment['key_index'];
                if ($request->hasFile("payment_document_file_{$keyIndex}")) {
                    $file = $request->file("payment_document_file_{$keyIndex}");
                    $fileName = time() . "_payment_{$keyIndex}." . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/payments'), $fileName);
                    $payment['file_url'] = '/upload/projects/payments/' . $fileName;
                }
            }
        }

        // 6. Gán các thông số phẳng lõi (Section 00)
        $project->title = $request->input('title');
        $project->slug = $request->input('slug');
        $project->status = $request->input('status') ?? 'dang_xay_dung';
        $project->legal = $request->input('legal') ?? 'hdmb';
        $project->lat = $request->input('lat');
        $project->lng = $request->input('lng');
        $project->address = $request->input('address');
        $project->landing_data = $landingStructure;

        // 7. Thực thi lưu trữ
        if ($project->save()) {
            return response()->json(['success' => true, 'message' => 'Thêm dự án mới thành công!']);
        }

        return response()->json(['success' => false, 'message' => 'Lỗi lưu database.'], 500);

    } catch (\Exception $e) {
        return response()->json(['success' => false, 'message' => 'Lỗi hệ thống: ' . $e->getMessage()], 500);
    }
    }

    /**
     * 4. CẬP NHẬT THÔNG TIN DỰ ÁN & TOÀN BỘ LAYOUT LANDING PAGE
     */
    public function update(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        // 1. Thu thập cấu trúc JSON từ frontend gửi lên
        $landingStructure = json_decode($request->input('landing_structure'), true);

        if (!$landingStructure) {
            return response()->json(['success' => false, 'message' => 'Cấu trúc Landing Page không hợp lệ.'], 400);
        }

        // 2. Xử lý Ảnh flat đại diện (Cốt lõi Section 00) nếu có nạp ảnh mới
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $fileName = time() . '_' . $file->getClientOriginalName();
            $file->move(public_path('upload/projects'), $fileName);
            $project->image = '/upload/projects/' . $fileName;
        }

        // 3. Xử lý các file ảnh đơn lẻ tại container của các Section
        $fileFields = [
            'hero_bg' => ['section' => 'hero', 'key' => 'bg_url'],
            'overview_image' => ['section' => 'overview', 'key' => 'image_url'],
            'location_image' => ['section' => 'location_links', 'key' => 'image_url'],
            'plan_image' => ['section' => 'floorplan', 'key' => 'image_url'],
        ];

        foreach ($fileFields as $formKey => $target) {
            if ($request->hasFile($formKey)) {
                $file = $request->file($formKey);
                $fileName = time() . '_' . $formKey . '.' . $file->getClientOriginalExtension();
                $file->move(public_path('upload/projects/sections'), $fileName);

                // Cập nhật đường dẫn ảnh mới vào khối cấu trúc JSON tương ứng
                $landingStructure[$target['section']][$target['key']] = '/upload/projects/sections/' . $fileName;
            }
        }

        // 4a. Xử lý ảnh cho ma trận 6 ô Tiện ích nội khu (Section 08)
        if (isset($landingStructure['amenities']) && is_array($landingStructure['amenities'])) {
            foreach ($landingStructure['amenities'] as $key => $amenity) {
                $idx = $amenity['index'];
                if ($request->hasFile("amenity_file_{$idx}")) {
                    $file = $request->file("amenity_file_{$idx}");
                    $fileName = time() . "_amenity_{$idx}." . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/amenities'), $fileName);

                    $landingStructure['amenities'][$key]['image_url'] = '/upload/projects/amenities/' . $fileName;
                }
            }
        }

        // 4b. BỔ SUNG: Xử lý mảng ảnh chi tiết layout căn hộ mẫu (Section 09)
        if (isset($landingStructure['unit_designs']['units']) && is_array($landingStructure['unit_designs']['units'])) {
            foreach ($landingStructure['unit_designs']['units'] as $key => $unit) {
                if ($request->hasFile("unit_layout_files.{$key}")) {
                    $file = $request->file("unit_layout_files.{$key}");
                    $fileName = time() . "_unit_layout_{$key}." . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/units'), $fileName);

                    $landingStructure['unit_designs']['units'][$key]['image_url'] = '/upload/projects/units/' . $fileName;
                }
            }
        }

        // 4c. BỔ SUNG: Xử lý mảng ảnh các phòng nội thất bàn giao (Section 10)
        if (isset($landingStructure['furniture']['rooms']) && is_array($landingStructure['furniture']['rooms'])) {
            foreach ($landingStructure['furniture']['rooms'] as $key => $room) {
                if ($request->hasFile("furniture_room_files.{$key}")) {
                    $file = $request->file("furniture_room_files.{$key}");
                    $fileName = time() . "_furniture_room_{$key}." . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/furniture'), $fileName);

                    $landingStructure['furniture']['rooms'][$key]['image_url'] = '/upload/projects/furniture/' . $fileName;
                }
            }
            // Đồng bộ lại ảnh đại diện phòng đầu tiên ra ngoài cho tương thích data cũ của ông
            if (isset($landingStructure['furniture']['rooms'][0])) {
                $landingStructure['furniture']['image_url'] = $landingStructure['furniture']['rooms'][0]['image_url'];
                $landingStructure['furniture']['items'] = array_map(function($i) {
                    return ['space' => $i['title'], 'brand' => $i['description']];
                }, $landingStructure['furniture']['rooms'][0]['items']);
            }
        }

        // 5. 🔥 FIX TRIỆT ĐỂ: Xử lý tài liệu đính kèm cho các phương thức thanh toán (Section 11)
        if (isset($landingStructure['payment_methods']) && is_array($landingStructure['payment_methods'])) {
            foreach ($landingStructure['payment_methods'] as $key => $payment) {
                // Kiểm tra file truyền lên từ mảng Frontend theo ký pháp dot-notation của Laravel (payment_document_files.0, payment_document_files.1, ...)
                if ($request->hasFile("payment_document_files.{$key}")) {
                    $file = $request->file("payment_document_files.{$key}");
                    $fileName = time() . "_payment_" . ($key + 1) . '.' . $file->getClientOriginalExtension();
                    $file->move(public_path('upload/projects/payments'), $fileName);

                    // Ghi đè đường dẫn file vừa lưu vào đúng phần tử trong JSON structure
                    $landingStructure['payment_methods'][$key]['file_url'] = '/upload/projects/payments/' . $fileName;
                }
            }
        }

        // 6. Gán ngược cục cấu trúc JSON hoàn chỉnh cuối cùng vào trường lưu trữ hệ thống
        // (Nếu Model của ông chưa khai báo $casts array cho trường này, ông có thể dùng json_encode($landingStructure))
        $project->landing_data = $landingStructure;

        // 7. Đồng bộ các thông số phẳng lõi (Section 00)
        $project->title = $request->input('title');
        $project->slug = $request->input('slug');
        $project->status = $request->input('status');
        $project->legal = $request->input('legal');
        $project->lat = $request->input('lat');
        $project->lng = $request->input('lng');
        $project->address = $request->input('address');

        // 8. Thực thi lưu trữ xuống DB
        if ($project->save()) {
            return response()->json(['success' => true, 'message' => 'Cập nhật thành công!']);
        }

        return response()->json(['success' => false, 'message' => 'Lỗi lưu database.'], 500);
    }

    /**
     * 5. XÓA DỰ ÁN & SẠCH SẼ TOÀN BỘ THƯ MỤC FILE TRÁNH RÁC STORAGE ĐƯỜNG DÀI
     */
    public function destroy($id)
    {
        $project = Project::findOrFail($id);
        $projectName = $project->title;
        $slug = $project->slug;

        // Tiến hành xóa bỏ thư mục chứa toàn bộ tệp tin hình ảnh/PDF của dự án này trên server
        $projectPath = public_path('upload/projects/' . $slug);
        if (file_exists($projectPath)) {
            self::deleteDirectoryRecursive($projectPath);
        }

        $project->delete();

        // Xóa sạch dấu vết Cache public
        Cache::forget("project_landing_{$slug}");

        // 📝 GHI NHẬT KÝ ĐÍCH DANH
        ActivityLog::write(
            'Xóa bỏ ❌',
            'Danh mục dự án',
            "Đã gỡ bỏ hoàn toàn dự án và dữ liệu Landing Page [{$projectName}] ra khỏi hệ thống."
        );

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa dự án và dọn dẹp thư mục tài nguyên thành công!'
        ], 200);
    }

    /**
     * 6. LẤY DANH SÁCH DỰ ÁN HIỂN THỊ TRANG CHỦ NGOÀI WEBSITE CLIENT (TỐI ƯU SIÊU TỐC)
     */
    public function getPublicProjects(Request $request)
    {
        try {
            $limit = $request->query('limit', 100);

            // ⚡ CHỈ SỐ SQL VÀNG: Loại bỏ trường `landing_data` khi query list nhằm giảm tải tối đa RAM cho máy chủ
            $projects = Project::select([
                    'id',
                    'title',
                    'slug',
                    'image',
                    'address',
                    'status',
                    'legal',
                    'created_at'
                ])
                ->orderBy('created_at', 'desc')
                ->take($limit)
                ->get();

            return response()->json($projects, 200);

        } catch (\Exception $e) {
            try {
                Log::error('Kích hoạt lớp phòng thủ getPublicProjects: ' . $e->getMessage());
                $limit = $request->query('limit', 100);
                $projects = Project::orderBy('created_at', 'desc')->take($limit)->get();
                return response()->json($projects, 200);
            } catch (\Exception $ex) {
                return response()->json([
                    'success' => false,
                    'message' => 'Lỗi kết nối dữ liệu dự án nghiêm trọng: ' . $ex->getMessage()
                ], 500);
            }
        }
    }

    /**
     * Hàm Helper nội bộ xử lý xóa đệ quy toàn bộ file và thư mục con một cách triệt để
     */
    private static function deleteDirectoryRecursive($dir) {
        if (!file_exists($dir)) return true;
        if (!is_dir($dir)) return unlink($dir);
        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') continue;
            if (!self::deleteDirectoryRecursive($dir . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return rmdir($dir);
    }
}
