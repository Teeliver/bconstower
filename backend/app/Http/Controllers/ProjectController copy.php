<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Project;
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký vào để ghi log trực tiếp
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema; // 🔥 FIX LỖI: Bổ sung Import Schema bị thiếu để không bị crash ngầm
use Illuminate\Support\Facades\Log;

class ProjectController extends Controller
{
    /**
     * 1. LẤY DANH SÁCH DỰ ÁN
     */
    public function index()
    {
        try {
            $projects = Project::orderBy('created_at', 'desc')->get();
            return response()->json($projects, 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi kết nối dữ liệu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 2. LẤY CHI TIẾT DỰ ÁN (Thông minh: Hỗ trợ tìm kiếm linh hoạt bằng cả ID hoặc Slug)
     * Giúp thông suốt cho cả trang Client công khai (/projects/slug) và trang Quản trị (/admin/projects/id)
     */
    public function show($idOrSlug)
    {
        try {
            $project = is_numeric($idOrSlug)
                ? Project::find($idOrSlug)
                : Project::where('slug', $idOrSlug)->first();

            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy thông tin dự án!'], 404);
            }

            return response()->json($project, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 3. TẠO MỚI DỰ ÁN
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $path = public_path('upload/projects');
            if (!file_exists($path)) {
                mkdir($path, 0755, true);
            }

            $file = $request->file('image');
            $safeName = Str::slug($request->title) . '-' . time();
            $extension = $file->getClientOriginalExtension();
            $filename = $safeName . '.' . $extension;

            $file->move($path, $filename);
            $imagePath = '/upload/projects/' . $filename;
        }

        // Áp dụng gán thuộc tính thủ công để vượt rào cơ chế $fillable của Laravel
        $project = new Project();
        $project->title = $request->title;
        $project->slug = Str::slug($request->title);
        $project->address = $request->address;
        $project->lat = $request->lat;
        $project->lng = $request->lng;
        $project->status = $request->status ?? 'open';
        $project->legal = $request->legal;
        $project->image = $imagePath;

        if (Schema::hasColumn('projects', 'user_id')) {
            $project->user_id = $request->user()?->id;
        }

        $project->save();

        // 📝 GHI NHẬT KÝ ĐÍCH DANH: Đảm bảo sáng đèn Dashboard 100%
        ActivityLog::write(
            'Thêm mới ➕',
            'Danh mục dự án',
            "Đã tạo thành công dự án mới [{$project->title}] trên hệ thống Portal."
        );

        return response()->json([
            'success' => true,
            'message' => 'Tạo dự án thành công!',
            'data' => $project
        ], 201);
    }

    /**
     * 4. CẬP NHẬT DỰ ÁN (Đã tối ưu cấu trúc gán trực tiếp để kích hoạt lịch sử hoạt động)
     */
    public function update(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'image' => 'nullable|image|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        if ($request->hasFile('image')) {
            $path = public_path('upload/projects');
            if (!file_exists($path)) {
                mkdir($path, 0755, true);
            }

            $file = $request->file('image');
            $filename = Str::slug($request->title) . '-' . time() . '.' . $file->getClientOriginalExtension();
            $file->move($path, $filename);

            if ($project->image && file_exists(public_path($project->image))) {
                @unlink(public_path($project->image));
            }

            $project->image = '/upload/projects/' . $filename;
        }

        // 🔥 FIX CHÍ MẠNG: Chuyển đổi sang gán thuộc tính trực tiếp + gọi hàm save()
        // Giải pháp này bẻ gãy mọi giới hạn của biến $fillable trong file Model Project và ép ghi nhật ký thành công
        $project->title = $request->title;
        $project->slug = Str::slug($request->title);
        $project->address = $request->address;
        $project->lat = $request->lat;
        $project->lng = $request->lng;
        $project->status = $request->status;
        $project->legal = $request->legal;

        $project->save(); // Thực thi lưu dữ liệu thật xuống MySQL

        // 📝 GHI NHẬT KÝ ĐÍCH DANH: Đảm bảo Dashboard nhảy số thời gian thực
        ActivityLog::write(
            'Chỉnh sửa 📝',
            'Danh mục dự án',
            "Đã cập nhật thay đổi thông tin dự án [{$project->title}] thành công."
        );

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật thông tin dự án thành công!',
            'data' => $project
        ], 200);
    }

    /**
     * 5. XÓA DỰ ÁN
     */
    public function destroy($id)
    {
        $project = Project::findOrFail($id);
        $projectName = $project->title; // Lưu giữ lại tên dự án trước khi thực hiện xóa khỏi bộ nhớ

        if ($project->image && file_exists(public_path($project->image))) {
            @unlink(public_path($project->image));
        }

        $project->delete();

        // 📝 GHI NHẬT KÝ ĐÍCH DANH: Đảm bảo lưu vết xóa vĩnh viễn dữ liệu
        ActivityLog::write(
            'Xóa bỏ ❌',
            'Danh mục dự án',
            "Đã gỡ bỏ hoàn toàn dự án [{$projectName}] ra khỏi cơ sở dữ liệu."
        );

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa dự án thành công khỏi hệ thống!'
        ], 200);
    }

    // Lấy danh sách dự án hiển thị ngoài trang chủ
    public function getPublicProjects(Request $request)
    {
        try {
            // Đọc tham số giới hạn số lượng (?limit=100), mặc định lấy tối đa 100 dự án
            $limit = $request->query('limit', 100);

            // ⚡ TỐI ƯU SQL: Chỉ Select đúng các trường Frontend cần render, tránh tốn RAM server
            $projects = Project::select([
                    'id',
                    'title',
                    'slug',
                    'image',
                    'address',
                    'location',
                    'status',
                    'legal',
                    'created_at'
                ])
                ->orderBy('created_at', 'desc') // Dự án mới cập nhật lên đầu
                ->take($limit)
                ->get();

            return response()->json($projects, 200);

        } catch (\Exception $e) {
            try {
                // 🛡️ LỚP PHÒNG THỦ: Tự kích hoạt luồng dự phòng khi lệnh tối ưu xảy ra lỗi cấu trúc cột
                Log::error('Kích hoạt lớp phòng thủ getPublicProjects: ' . $e->getMessage());

                $limit = $request->query('limit', 100);
                $projects = Project::orderBy('created_at', 'desc')
                    ->take($limit)
                    ->get();

                return response()->json($projects, 200);
            } catch (\Exception $ex) {
                // Sập luồng tối cao: Trả thông báo lỗi an toàn hệ thống
                return response()->json([
                    'success' => false,
                    'message' => 'Lỗi kết nối dữ liệu dự án nghiêm trọng: ' . $ex->getMessage()
                ], 500);
            }
        }
    }
}
