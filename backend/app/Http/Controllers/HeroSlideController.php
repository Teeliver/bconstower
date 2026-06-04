<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\HeroSlide;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator; // Dòng này là thứ bạn đang thiếu

class HeroSlideController extends Controller
{
    // Lấy danh sách (trả về mảng JSON thuần)
    public function index() {
        return response()->json(HeroSlide::orderBy('display_order', 'asc')->get());
    }

    // Lưu mới
    public function store(Request $request)
    {
        // 1. Validation nghiêm ngặt (đặc biệt là tệp ảnh)
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
            'is_active' => 'boolean',
            'display_order' => 'integer'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            // 2. Bảo mật: Đảm bảo thư mục tồn tại
            $path = public_path('upload/heroslider');
            if (!file_exists($path)) {
                mkdir($path, 0755, true);
            }

            $file = $request->file('image');

            // 🛡️ BẢO MẬT: Làm sạch tên file và sử dụng Str::random để tránh trùng lặp/tấn công tệp
            $filename = Str::slug($request->title) . '-' . Str::random(5) . '.' . $file->getClientOriginalExtension();
            $file->move($path, $filename);
            $imagePath = '/upload/heroslider/' . $filename;
        } else {
            return response()->json(['success' => false, 'message' => 'Vui lòng chọn ảnh cho slide.'], 422);
        }

        // 3. 🛡️ Gán thuộc tính thủ công để đảm bảo an toàn tuyệt đối với Database
        $slide = new HeroSlide();
        $slide->title = $request->title;
        $slide->subtitle = $request->subtitle;
        $slide->button_text = $request->button_text;
        $slide->link_url = $request->link_url;
        $slide->is_active = $request->is_active ?? true;
        $slide->display_order = $request->display_order ?? 0;
        $slide->image_url = $imagePath; // Đảm bảo khớp với tên cột trong DB của bạn

        // Tự động gán người tạo nếu bảng slide có cột user_id
        if (Schema::hasColumn('hero_slides', 'user_id')) {
            $slide->user_id = $request->user()?->id;
        }

        $slide->save();

        return response()->json([
            'success' => true,
            'message' => 'Tạo Slide thành công!',
            'data' => $slide
        ]);
    }

    public function show($id){
        $slide = HeroSlide::findOrFail($id);
        return response()->json($slide);
    }

    public function update(Request $request, $id){
        $slide = HeroSlide::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'required',
            'image' => 'nullable|image|max:5120'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Lỗi validate'], 422);
        }

        if ($request->hasFile('image')) {
            $path = public_path('upload/heroslider');
            if (!file_exists($path)) mkdir($path, 0755, true);

            $file = $request->file('image');
            $filename = Str::slug($request->title) . '-' . time() . '.' . $file->getClientOriginalExtension();
            $file->move($path, $filename);

            if ($slide->image_url && file_exists(public_path($slide->image_url))) {
                @unlink(public_path($slide->image_url));
            }
            $slide->image_url = '/upload/heroslider/' . $filename;
        }

        $slide->update([
            'title' => $request->title,
            'subtitle' => $request->subtitle,
            'button_text' => $request->button_text,
            'link_url' => $request->link_url,
            'is_active' => $request->is_active,
            'display_order' => $request->display_order
        ]);

        return response()->json(['success' => true, 'message' => 'Cập nhật thành công']);
    }

    public function destroy($id) {
        $slide = HeroSlide::findOrFail($id);

        // Xóa file ảnh vật lý để không bị rác server
        if ($slide->image_url && file_exists(public_path($slide->image_url))) {
            @unlink(public_path($slide->image_url));
        }

        // Xóa record trong DB
        $slide->delete();

        return response()->json(['success' => true, 'message' => 'Đã xóa thành công']);
    }
}
