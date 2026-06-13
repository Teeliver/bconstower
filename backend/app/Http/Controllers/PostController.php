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
use Illuminate\Support\Facades\Cache;

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
        return 'image';
    }

    /**
     * Tự động kiểm tra trạng thái hoạt động dựa trên cột thực tế của DB
     */
    private function applyStatusFilter($query, string $status = 'published')
    {
        if (Schema::hasColumn('posts', 'status')) {
            return $query->where('status', $status);
        }
        if (Schema::hasColumn('posts', 'is_published')) {
            return $query->where('is_published', $status === 'published' ? 1 : 0);
        }
        return $query;
    }

    /**
     * 🟢 BỘ LỌC ĐA TẦNG: Áp dụng chung cho tất cả các API public để bắt tham số từ Postman/Frontend
     */
    private function applyCategoryFilter($query, $categoryInput)
    {
        $isThiTruong = ($categoryInput === 'thi-truong' || $categoryInput === '1' || $categoryInput == 1);
        $targetText = $isThiTruong ? 'thi-truong' : 'tien-do';
        $targetId = $isThiTruong ? 1 : 2;

        return $query->where(function($q) use ($targetText, $targetId, $isThiTruong) {
            $q->where(function($sub) use ($targetText, $targetId) {
                if (Schema::hasColumn('posts', 'category') && Schema::hasColumn('posts', 'category_id')) {
                    $sub->where('category', $targetText)->orWhere('category_id', $targetId);
                } elseif (Schema::hasColumn('posts', 'category')) {
                    $sub->where('category', $targetText);
                } elseif (Schema::hasColumn('posts', 'category_id')) {
                    $sub->where('category_id', $targetId);
                }
            });

            if ($isThiTruong) {
                if (Schema::hasColumn('posts', 'category_id')) {
                    $q->orWhere('category_id', 0)->orWhereNull('category_id');
                }
                if (Schema::hasColumn('posts', 'category')) {
                    $q->orWhere('category', '')->orWhereNull('category');
                }
                $q->orWhere('title', 'like', '%thị trường%')
                  ->orWhere('title', 'like', '%thi truong%')
                  ->orWhere('slug', 'like', '%thi-truong%')
                  ->orWhere('summary', 'like', '%thị trường%');
            } else {
                $q->orWhere('title', 'like', '%tiến độ%')
                  ->orWhere('title', 'like', '%tien do%')
                  ->orWhere('slug', 'like', '%tien-do%')
                  ->orWhere('summary', 'like', '%tiến độ%');
            }
        });
    }

    /**
     * 🟢 BỘ ĐỊNH DẠNG ĐẦU RA ĐỒNG BỘ: Đảm bảo phân loại nhãn JSON chuẩn chỉ không lệch pha
     */
    private function formatPostOutput($post, $imgCol): array
    {
        $titleLower = mb_strtolower($post->title ?? '', 'UTF-8');
        $slugLower = strtolower($post->slug ?? '');
        $summaryLower = mb_strtolower($post->summary ?? '', 'UTF-8');

        $rawCat = strtolower((string)($post->category ?? ''));
        $rawCatId = $post->category_id;

        $catString = 'tien-do';

        if (
            str_contains($rawCat, 'thi') ||
            str_contains($rawCat, 'truong') ||
            $rawCatId == 1 ||
            $rawCatId == 0 ||
            $rawCatId === null ||
            $rawCat === '' ||
            str_contains($titleLower, 'thị trường') ||
            str_contains($titleLower, 'thi truong') ||
            str_contains($slugLower, 'thi-truong') ||
            str_contains($summaryLower, 'thị trường')
        ) {
            $catString = 'thi-truong';
        }

        if (
            (str_contains($titleLower, 'tiến độ') || str_contains($titleLower, 'tien do') || str_contains($slugLower, 'tien-do')) &&
            !(str_contains($titleLower, 'thị trường') || str_contains($titleLower, 'thi truong'))
        ) {
            $catString = 'tien-do';
        }

        return [
            'id'          => $post->id,
            'title'       => htmlspecialchars($post->title ?? '', ENT_QUOTES, 'UTF-8'),
            'slug'        => $post->slug,
            'image'       => $post->{$imgCol} ?? '',
            'thumbnail'   => $post->{$imgCol} ?? '',
            'summary'     => htmlspecialchars($post->summary ?? '', ENT_QUOTES, 'UTF-8'),
            'description' => $post->content ?? '',
            'views'       => (int)($post->views ?? 0),
            'created_at'  => $post->created_at,
            'createdAt'   => $post->created_at,
            'category'    => $catString,
        ];
    }

    /**
     * Lấy danh sách bài viết (Admin)
     */
    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('posts')) {
                return response()->json(['message' => 'Bảng dữ liệu posts không tồn tại.'], 404);
            }

            $posts = Post::orderBy('created_at', 'desc')->get();
            $imgCol = $this->getImageColumn();

            // 🟢 FIX TRIỆT ĐỂ: Check tên cột tồn tại thực tế bên ngoài vòng lặp tránh nghẽn CPU
            $hasStatusCol = Schema::hasColumn('posts', 'status');
            $hasIsPublishedCol = Schema::hasColumn('posts', 'is_published');

            $formattedPosts = $posts->map(function ($post) use ($imgCol, $hasStatusCol, $hasIsPublishedCol) {
                $categoryValue = $post->category_id ?? $post->category ?? 'khac';

                // 🚀 BỘ QUÉT TRẠNG THÁI CHUẨN XÁC: Trả về đúng sự thật của DB cho Admin húp
                $statusValue = 'draft';
                if ($hasStatusCol) {
                    $statusValue = ($post->status === 'published' || $post->status === 'active' || $post->status == 1) ? 'published' : 'draft';
                } elseif ($hasIsPublishedCol) {
                    $statusValue = ($post->is_published == 1 || $post->is_published === true || $post->is_published == '1') ? 'published' : 'draft';
                }

                return [
                    'id' => $post->id,
                    'title' => $post->title ?? 'Không tiêu đề',
                    'slug' => $post->slug ?? '',
                    'category' => $categoryValue,
                    'status' => $statusValue, // Trả dữ liệu sạch không fake
                    'thumbnail' => $post->{$imgCol} ?? '',
                    'created_at' => $post->created_at,
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
     * Xem chi tiết bài viết (Admin)
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

            $catInput = $request->category ?? $request->category_id;
            $isThiTruong = ($catInput === 'thi-truong' || $catInput === '1' || $catInput == 1);

            if (Schema::hasColumn('posts', 'category_id')) {
                $post->category_id = $isThiTruong ? 1 : 2;
            }
            if (Schema::hasColumn('posts', 'category')) {
                $post->category = $isThiTruong ? 'thi-truong' : 'tien-do';
            }

            if (Schema::hasColumn('posts', 'status')) {
                $post->status = $request->status ?? 'published';
            }
            if (Schema::hasColumn('posts', 'is_published')) {
                $post->is_published = ($request->status === 'published');
            }

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

            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write('Thêm mới ➕', 'Bài viết tin tức', "Người dùng [{$staffName}] đã đăng bài viết tin tức mới [{$post->title}].");

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

            $catInput = $request->category ?? $request->category_id;
            $isThiTruong = ($catInput === 'thi-truong' || $catInput === '1' || $catInput == 1);

            if (Schema::hasColumn('posts', 'category_id')) {
                $post->category_id = $isThiTruong ? 1 : 2;
            }
            if (Schema::hasColumn('posts', 'category')) {
                $post->category = $isThiTruong ? 'thi-truong' : 'tien-do';
            }

            if (Schema::hasColumn('posts', 'status')) {
                $post->status = $request->status ?? 'published';
            }
            if (Schema::hasColumn('posts', 'is_published')) {
                $post->is_published = ($request->status === 'published');
            }

            if ($request->hasFile('image')) {
                $imgCol = $this->getImageColumn();
                if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) {
                    @unlink(public_path($post->{$imgCol}));
                }

                $filename = Str::slug($request->title) . '-' . time() . '.' . $request->file('image')->getClientOriginalExtension();
                $request->file('image')->move(public_path('upload/posts'), $filename);

                $post->{$imgCol} = '/upload/posts/' . $filename;
            }

            $post->save();

            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write('Chỉnh sửa 📝', 'Bài viết tin tức', "Tài khoản [{$staffName}] đã chỉnh sửa và cập nhật nội dung bài viết [{$post->title}]." );

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

            $postTitle = $post->title ?? 'Không tiêu đề';
            $imgCol = $this->getImageColumn();
            if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) {
                @unlink(public_path($post->{$imgCol}));
            }

            $post->delete();

            $authUser = $request->user();
            $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';
            ActivityLog::write('Xóa bỏ ❌', 'Bài viết tin tức', "Tài khoản [{$staffName}] đã gỡ bỏ hoàn toàn bài viết [{$postTitle}] ra khỏi hệ thống.");

            return response()->json(['success' => true, 'message' => 'Đã xóa bài viết thành công.'], 200);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi xóa bài viết: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Lấy danh sách tin tức công khai tổng quát
     */
    public function getPublicPosts(Request $request): JsonResponse
    {
        try {
            $query = Post::query();
            $query = $this->applyStatusFilter($query, 'published');

            if ($request->has('category')) {
                $query = $this->applyCategoryFilter($query, $request->query('category'));
            }

            $posts = $query->orderBy('created_at', 'desc')->get();
            $imgCol = $this->getImageColumn();

            $data = $posts->map(function ($post) use ($imgCol) {
                return $this->formatPostOutput($post, $imgCol);
            });

            return response()->json($data, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi khi tải tin tức public: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống.'], 500);
        }
    }

    /**
     * API hiển thị chi tiết tin tức theo slug
     */
    public function getPostDetail(Request $request)
    {
        $slug = $request->query('slug');
        if (!$slug) return response()->json(['message' => 'Thiếu tham số slug'], 400);

        try {
            $query = Post::where('slug', $slug);
            $query = $this->applyStatusFilter($query, 'published');
            $post = $query->first();

            if (!$post) return response()->json(['message' => 'Bài viết không tồn tại'], 404);

            $imgCol = $this->getImageColumn();
            return response()->json(['post' => $this->formatPostOutput($post, $imgCol)], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi khi lấy chi tiết bài viết: ' . $e->getMessage());
            return response()->json(['message' => 'Lỗi hệ thống'], 500);
        }
    }

    /**
     * API Lấy danh sách bài viết phục vụ block NewsSection ngoài Frontend Trang chủ
     */
    public function getNewsSection(Request $request)
    {
        try {
            $categoryInput = $request->query('category', 'thi-truong');
            $limit         = (int) $request->query('limit', 4);

            $query = Post::query();
            $query = $this->applyStatusFilter($query, 'published');
            $query = $this->applyCategoryFilter($query, $categoryInput);

            $posts = $query->orderBy('id', 'desc')->limit($limit)->get();
            $imgCol = $this->getImageColumn();

            $formatted = $posts->map(function($post) use ($imgCol) {
                return $this->formatPostOutput($post, $imgCol);
            });

            return response()->json($formatted, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi API bài viết getNewsSection: ' . $e->getMessage());
            return response()->json(['error' => 'Không thể tải danh sách tin tức.', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * API Tăng lượt xem bài viết
     */
    public function incrementView(Request $request, $id): JsonResponse
    {
        try {
            $post = Post::find($id);
            if (!$post) return response()->json(['success' => false, 'message' => 'Bài viết không tồn tại.'], 404);

            $clientIp = $request->ip();
            $cacheKey = 'post_view_cooldown:' . $clientIp . ':' . $id;

            if (Cache::has($cacheKey)) {
                return response()->json(['success' => true, 'message' => 'Lượt xem trùng lặp.', 'views' => (int)($post->views ?? 0)], 200);
            }

            $post->increment('views');
            Cache::put($cacheKey, true, now()->addHours(1));

            return response()->json(['success' => true, 'message' => 'Đã ghi nhận tăng lượt xem.', 'views' => (int)$post->views], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi PostController@incrementView: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi máy chủ khi tăng view.'], 500);
        }
    }
}
