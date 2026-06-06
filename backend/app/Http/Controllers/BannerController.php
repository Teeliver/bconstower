<?php

namespace App\Http\Controllers;

use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class BannerController extends Controller
{
    /**
     * API 1: Phục vụ ngoài Client Astro (Public - Không cần Token)
     * Logic: Sắp xếp nối tiếp theo sort_order tăng dần, trùng số thì thằng mới hơn nằm trên.
     */
    public function getBannersByPosition(Request $request)
    {
        $position = $request->query('position');

        // Chặn lọc dữ liệu rác truyền lên từ Query
        if (!in_array($position, ['news_sidebar', 'apartment_sidebar', 'project_horizontal'])) {
            return response()->json(['success' => false, 'message' => 'Vị trí yêu cầu không hợp lệ!'], 400);
        }

        $banners = Banner::where('is_active', true)
            ->where('position', $position)
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json(['success' => true, 'data' => $banners], 200);
    }

    /**
     * API 2: Lấy danh sách quản trị (Admin/Manager)
     */
    public function index()
    {
        return response()->json(['success' => true, 'data' => Banner::orderBy('position')->orderBy('sort_order')->get()]);
    }

    /**
     * API 3: Thêm mới Banner kèm kiểm duyệt File ảnh nghiêm ngặt (Bảo mật cao)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'link_url' => 'nullable|url',
            'position' => 'required|in:news_sidebar,apartment_sidebar,project_horizontal',
            'sort_order' => 'required|integer|min:0',
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:3072', // Tối đa 3MB, chỉ cho phép đuôi ảnh sạch
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        try {
            // Xử lý upload ảnh vào đĩa cứng biệt lập 'public'
            $file = $request->file('image');
            $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $filePath = $file->storeAs('uploads/banners', $fileName, 'public');

            $banner = Banner::create([
                'title' => $request->title,
                'link_url' => $request->link_url,
                'position' => $request->position,
                'sort_order' => $request->sort_order,
                'image_path' => '/storage/' . $filePath,
            ]);

            return response()->json(['success' => true, 'message' => 'Tạo banner trực quan thành công!', 'data' => $banner], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống không lưu được file.'], 500);
        }
    }

    /**
     * API 4: Xóa Banner khỏi hệ thống và giải phóng đĩa cứng
     */
    public function destroy($id)
    {
        $banner = Banner::find($id);
        if (!$banner) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy banner.'], 404);
        }

        // Xóa file ảnh vật lý để tránh rác ổ cứng server
        $purePath = str_replace('/storage/', '', $banner->image_path);
        if (Storage::disk('public')->exists($purePath)) {
            Storage::disk('public')->delete($purePath);
        }

        $banner->delete();
        return response()->json(['success' => true, 'message' => 'Đã gỡ bỏ banner hoàn toàn.']);
    }
}
