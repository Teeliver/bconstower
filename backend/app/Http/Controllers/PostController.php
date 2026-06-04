<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\ActivityLog; // 🔥 IMPORT: Gọi Model nhật ký hệ thống xử lý ghi vết trực tiếp
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class PostController extends Controller
{
    /**
     * Tự động tìm kiếm tên cột ảnh thực tế trong DB để tránh lỗi Column not found
     */
    private function getImageColumn(): string
    {
        if (Schema::hasColumn('posts', 'thumbnail')) {
            return 'thumbnail';
        }
        if (Schema::hasColumn('posts', 'image_url')) {
            return 'image_url';
        }
        return 'image'; // Phương án dự phòng cuối cùng
    }

    /**
     * Lấy danh sách bài viết
     */
    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('posts')) {
                return response()->json(['message' => 'Bảng dữ liệu posts không tồn tại.'], 404);
            }

            $posts = Post::orderBy('created_at', 'desc')->get();
            $imgCol = $this->getImageColumn();

            $formattedPosts = $posts->map(function ($post) use ($imgCol) {
                return [
                    'id' => $post->id,
                    'title' => $post->title ?? 'Không tiêu đề',
                    'slug' => $post->slug ?? '',
                    'category' => $post->category_id ?? 'khac',
                    'status' => ($post->is_published ?? true) ? 'published' : 'draft',
                    'thumbnail' => $post->{$imgCol} ?? '',
                    'createdAt' => $post->created_at,
                    'views' => $post->views ?? 0,
                ];
            });

            return response()->json($formattedPosts, 200);

        } catch (\Exception $e) {
            Log::error('PostController index error: ' . $e->getMessage());
            return response()->json(['message' => 'Lỗi máy chủ: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Xem chi tiết bài viết
     */
    public function show($id): JsonResponse
    {
        try {
            $post = is_numeric($id) ? Post::find($id) : Post::where('slug', $id)->first();

            if (!$post) {
                return response()->json(['message' => 'Bài viết không tồn tại.'], 404);
            }

            return response()->json($post, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Tạo bài viết mới
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $post = new Post();
            $post->title = $request->title;
            $post->slug = $request->slug ?? Str::slug($request->title);
            $post->content = $request->content;
            $post->summary = $request->summary;

            if (Schema::hasColumn('posts', 'category_id')) {
                $post->category_id = $request->category ?? $request->category_id;
            }

            if (Schema::hasColumn('posts', 'is_published')) {
                $post->is_published = ($request->status === 'published');
            }

            // Xử lý upload ảnh vào đúng cột thực tế trong DB
            if ($request->hasFile('image')) {
                $path = public_path('upload/posts');
                if (!file_exists($path)) mkdir($path, 0755, true);

                $filename = Str::slug($request->title) . '-' . time() . '.' . $request->file('image')->getClientOriginalExtension();
                $request->file('image')->move($path, $filename);

                $imgCol = $this->getImageColumn();
                $post->{$imgCol} = '/upload/posts/' . $filename;
            }

            if (Schema::hasColumn('posts', 'user_id')) {
                $post->user_id = $request->user()?->id;
            }

            $post->save();

            // 📝 GHI LOG THÊM MỚI BÀI VIẾT TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Thêm mới ➕',
                'Bài viết tin tức',
                "Người dùng [{$staffName}] đã đăng bài viết tin tức mới [{$post->title}]."
            );

            return response()->json(['success' => true, 'message' => 'Đăng bài viết thành công!', 'data' => $post], 201);

        } catch (\Exception $e) {
            Log::error('PostController store error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Cập nhật bài viết
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $post = Post::find($id);
            if (!$post) {
                return response()->json(['success' => false, 'message' => 'Bài viết không tồn tại.'], 404);
            }

            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:10240',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $post->title = $request->title;
            $post->slug = $request->slug ?? Str::slug($request->title);
            $post->content = $request->content;
            $post->summary = $request->summary;

            if (Schema::hasColumn('posts', 'category_id')) {
                $post->category_id = $request->category;
            }

            if (Schema::hasColumn('posts', 'is_published')) {
                $post->is_published = ($request->status === 'published');
            }

            // Xử lý ghi đè ảnh vào đúng cột thực tế của Database
            if ($request->hasFile('image')) {
                $imgCol = $this->getImageColumn();

                // Xóa file cũ
                if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) {
                    @unlink(public_path($post->{$imgCol}));
                }

                $filename = Str::slug($request->title) . '-' . time() . '.' . $request->file('image')->getClientOriginalExtension();
                $request->file('image')->move(public_path('upload/posts'), $filename);

                $post->{$imgCol} = '/upload/posts/' . $filename;
            }

            $post->save();

            // 📝 GHI LOG CẬP NHẬT BÀI VIẾT TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Chỉnh sửa 📝',
                'Bài viết tin tức',
                "Tài khoản [{$staffName}] đã chỉnh sửa và cập nhật nội dung bài viết [{$post->title}]."
            );

            return response()->json(['success' => true, 'message' => 'Cập nhật bài viết thành công!', 'data' => $post], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi PostController@update: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Hệ thống sập: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Xóa bài viết
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $post = Post::find($id);
            if (!$post) {
                return response()->json(['success' => false, 'message' => 'Bài viết không tồn tại.'], 404);
            }

            $postTitle = $post->title ?? 'Không tiêu đề'; // Sao lưu lại tiêu đề trước khi xóa vĩnh viễn

            $imgCol = $this->getImageColumn();
            if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) {
                @unlink(public_path($post->{$imgCol}));
            }

            $post->delete();

            // 📝 GHI LOG XÓA BÀI VIẾT TRỰC TIẾP
            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write(
                'Xóa bỏ ❌',
                'Bài viết tin tức',
                "Tài khoản [{$staffName}] đã gỡ bỏ hoàn toàn bài viết [{$postTitle}] ra khỏi hệ thống."
            );

            return response()->json(['success' => true, 'message' => 'Đã xóa bài viết thành công.'], 200);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi xóa bài viết: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Lấy danh sách tin tức công khai
     */
    public function getPublicPosts(): JsonResponse
    {
        try {
            // Lọc bài viết đã xuất bản và sắp xếp theo thời gian mới nhất
            $posts = Post::where('status', 'published')
                ->orderBy('created_at', 'desc')
                ->get();

            // Format và làm sạch dữ liệu
            $data = $posts->map(function ($post) {
                return [
                    'id'          => $post->id,
                    'title'       => htmlspecialchars($post->title ?? '', ENT_QUOTES, 'UTF-8'),
                    'slug'        => $post->slug,
                    'image'       => $post->thumbnail, // Sử dụng cột 'thumbnail' từ table của bạn
                    'summary'     => htmlspecialchars($post->summary ?? '', ENT_QUOTES, 'UTF-8'),
                    'description' => htmlspecialchars($post->content ?? '', ENT_QUOTES, 'UTF-8'), // 'content' là nội dung chi tiết
                    'views'       => (int)($post->views ?? 0),
                    'createdAt'   => $post->created_at,
                    'category'    => $post->category ?? 'news', // 'category' là cột bạn đã định nghĩa
                ];
            });

            return response()->json($data, 200);

        } catch (\Exception $e) {
            \Log::error('Lỗi khi tải tin tức: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống.'], 500);
        }
    }

    /**
     * API hiển thị chi tiết tin tức theo slug
     * URL: GET /api/posts/public/detail?slug=...
     */
    public function getPostDetail(Request $request)
    {
        $slug = $request->query('slug');
        if (!$slug) {
            return response()->json(['message' => 'Thiếu tham số slug'], 400);
        }

        try {
            // Lọc theo trạng thái 'published' để bảo mật
            $post = Post::where('slug', $slug)
                        ->where('status', 'published')
                        ->first();

            if (!$post) {
                return response()->json(['message' => 'Bài viết không tồn tại'], 404);
            }

            // Khử trùng dữ liệu trước khi trả về để chống XSS
            return response()->json([
                'post' => [
                    'id'          => $post->id,
                    'title'       => htmlspecialchars($post->title ?? '', ENT_QUOTES, 'UTF-8'),
                    'slug'        => $post->slug,
                    'thumbnail'   => $post->thumbnail,
                    'summary'     => htmlspecialchars($post->summary ?? '', ENT_QUOTES, 'UTF-8'),
                    'content'     => $post->content, // Nội dung rich-text cần render trực tiếp, đảm bảo Editor đã clean script độc hại trước khi lưu vào DB
                    'views'       => (int)($post->views ?? 0),
                    'created_at'  => $post->created_at,
                    'category'    => $post->category ?? 'news'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi khi lấy chi tiết bài viết: ' . $e->getMessage());
            return response()->json(['message' => 'Lỗi hệ thống'], 500);
        }
    }

    /**
     * API Lấy danh sách bài viết công khai phục vụ block NewsSection ngoài Frontend
     * URL target: GET /api/posts/public?category=thi-truong&limit=4
     */
    public function getNewsSection(Request $request)
    {
        try {
            // Lấy tham số lọc lọc từ query string
            $category = $request->query('category', 'thi-truong');
            $limit    = (int) $request->query('limit', 4);

            // Truy vấn lấy dữ liệu từ bảng posts (Sắp xếp bài mới nhất lên hàng đầu)
            // Lấy đúng tên các cột chuẩn Laravel: id, title, slug, thumbnail, summary, category, created_at
            $posts = DB::table('posts')
                ->select('id', 'title', 'slug', 'thumbnail', 'summary', 'category', 'created_at')
                ->where('category', $category)
                ->orderBy('id', 'desc') // Bài mới nhất leo lên đầu
                ->limit($limit)
                ->get();

            // Trả về mảng JSON thuần để tương thích trực tiếp với map() ngoài Astro
            return response()->json($posts, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi API bài viết: ' . $e->getMessage());
            return response()->json([
                'error' => 'Không thể tải danh sách tin tức.',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * API Tăng lượt xem bài viết có chống spam F5 bằng cơ chế Cache IP người dùng
     * URL target: POST /api/posts/public/{id}/view
     */
    public function incrementView(Request $request, $id): JsonResponse
    {
        try {
            // 1. Kiểm tra bài viết có tồn tại trong hệ thống hay không
            $post = Post::find($id);

            if (!$post) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bài viết không tồn tại.'
                ], 404);
            }

            // 2. Lấy IP chuẩn của client (Laravel tự động xử lý tốt qua Proxy Nginx / Cloudflare)
            $clientIp = $request->ip();

            // 3. Thiết lập mã định danh duy nhất (Key Cache) cho cặp IP + PostID này
            $cacheKey = 'post_view_cooldown:' . $clientIp . ':' . $id;

            // 4. Kiểm tra xem IP này đã xem bài viết này trong vòng 1 tiếng qua chưa
            if (\Illuminate\Support\Facades\Cache::has($cacheKey)) {
                // Nếu đã tồn tại key trong Cache, trả về thành công giả lập nhưng "âm thầm" chặn lệnh update vào DB
                return response()->json([
                    'success' => true,
                    'message' => 'Lượt xem trùng lặp trong thời gian ngắn (Chặn spam F5 thành công).',
                    'views' => (int)($post->views ?? 0)
                ], 200);
            }

            // 5. Nếu vượt qua vòng kiểm tra IP -> Tiến hành tăng view nguyên tử (Atomic Increment) tránh nghẽn luồng DB
            $post->increment('views');

            // 6. Ghi vết Key vào Cache hệ thống, tự động xóa vĩnh viễn sau 60 phút (1 tiếng)
            // Ông có thể đổi thành now()->addMinutes(30) nếu muốn giảm thời gian khóa IP xuống
            \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addHours(1));

            return response()->json([
                'success' => true,
                'message' => 'Đã ghi nhận tăng lượt xem bài viết thành công.',
                'views' => (int)$post->views
            ], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi PostController@incrementView: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Lỗi máy chủ khi tăng view: ' . $e->getMessage()
            ], 500);
        }
    }
}
