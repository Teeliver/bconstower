<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\ActivityLog;
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
    private function getImageColumn(): string
    {
        if (Schema::hasColumn('posts', 'thumbnail')) return 'thumbnail';
        if (Schema::hasColumn('posts', 'image_url')) return 'image_url';
        return 'image';
    }

    private function applyStatusFilter($query, string $status = 'published')
    {
        if (Schema::hasColumn('posts', 'status')) return $query->where('status', $status);
        if (Schema::hasColumn('posts', 'is_published')) return $query->where('is_published', $status === 'published' ? 1 : 0);
        return $query;
    }

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
                if (Schema::hasColumn('posts', 'category_id')) $q->orWhere('category_id', 0)->orWhereNull('category_id');
                if (Schema::hasColumn('posts', 'category')) $q->orWhere('category', '')->orWhereNull('category');
                $q->orWhere('title', 'like', '%thị trường%')->orWhere('slug', 'like', '%thi-truong%');
            } else {
                $q->orWhere('title', 'like', '%tiến độ%')->orWhere('slug', 'like', '%tien-do%');
            }
        });
    }

  	/**
     * 🔥 HÀM GỬI YÊU CẦU LÊN GOOGLE INDEXING API (Dán vào cuối cả 3 Controller)
     */
    private function sendUrlToGoogleIndexing($url, $action = 'URL_UPDATED')
    {
        try {
            $keyPath = base_path(env('GOOGLE_INDEXING_KEY_PATH', 'storage/app/google-indexing-key.json'));
            if (!file_exists($keyPath)) {
                \Illuminate\Support\Facades\Log::error("Không tìm thấy file JSON Google Indexing tại: {$keyPath}");
                return false;
            }

            $client = new \Google\Client();
            $client->setAuthConfig($keyPath);
            $client->addScope('https://www.googleapis.com/auth/indexing');

            $httpClient = $client->authorize();
            $endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

            $content = json_encode(['url' => $url, 'type' => $action]);
            $response = $httpClient->post($endpoint, [
                'headers' => ['Content-Type' => 'application/json'],
                'body'    => $content
            ]);

            if ($response->getStatusCode() === 200) {
                \Illuminate\Support\Facades\Log::info("🎉 Ép Google Index thành công cho URL: {$url} [Action: {$action}]");
                return true;
            }
            return false;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Lỗi Google Indexing API: " . $e->getMessage());
            return false;
        }
    }

    /**
     * 🟢 BỘ ĐỊNH DẠNG ĐẦU RA ĐỒNG BỘ: Sửa dứt điểm lỗi author_id không nhận
     */
    private function formatPostOutput($post, $imgCol): array
    {
        $titleLower = mb_strtolower($post->title ?? '', 'UTF-8');
        $slugLower = strtolower($post->slug ?? '');
        $summaryLower = mb_strtolower($post->summary ?? '', 'UTF-8');

        $rawCat = strtolower((string)($post->category ?? ''));
        $rawCatId = $post->category_id;
        $catString = 'tien-do';

        if (str_contains($rawCat, 'thi') || str_contains($rawCat, 'truong') || $rawCatId == 1 || $rawCatId == 0 || $rawCatId === null || $rawCat === '' || str_contains($titleLower, 'thị trường') || str_contains($slugLower, 'thi-truong')) {
            $catString = 'thi-truong';
        }
        if ((str_contains($titleLower, 'tiến độ') || str_contains($slugLower, 'tien-do')) && !(str_contains($titleLower, 'thị trường'))) {
            $catString = 'tien-do';
        }

        // 🔥 PHƯƠNG ÁN ĐẬP TAN LỖI AUTHOR: Quét trực tiếp Database hốt đích danh tên thật ra ngoài
        $authorName = 'Ban Quản Trị';
        $userId = $post->user_id ?? $post->author_id ?? null;

        if (!$userId && isset($post->attributes)) {
            $userId = $post->attributes['author_id'] ?? $post->attributes['user_id'] ?? null;
        }

        if ($userId) {
            try {
                $userRecord = DB::table('users')->where('id', $userId)->first();
                if ($userRecord) {
                    $authorName = $userRecord->fullname ?? $userRecord->name ?? $userRecord->username ?? 'Ban Quản Trị';
                }
            } catch (\Throwable $e) {
                Log::error('Lỗi truy vấn trực tiếp tên người đăng: ' . $e->getMessage());
            }
        }

        // Tự động nhận diện cột view thực tế tránh lỗi null
        $viewCol = Schema::hasColumn('posts', 'views') ? 'views' : (Schema::hasColumn('posts', 'view_count') ? 'view_count' : 'views');

        return [
            'id'          => $post->id,
            'title'       => htmlspecialchars($post->title ?? '', ENT_QUOTES, 'UTF-8'),
            'slug'        => $post->slug,
            'image'       => $post->{$imgCol} ?? '',
            'thumbnail'   => $post->{$imgCol} ?? '',
            'summary'     => htmlspecialchars($post->summary ?? '', ENT_QUOTES, 'UTF-8'),
            'description' => $post->content ?? $post->description ?? '',
            'views'       => (int)($post->{$viewCol} ?? 0),
            'created_at'  => $post->created_at,
            'createdAt'   => $post->created_at,
            'category'    => $catString,
            'authorName'  => $authorName, // Trả dữ liệu sạch không fake cứng
        ];
    }

    public function index(): JsonResponse
    {
        try {
            if (!Schema::hasTable('posts')) return response()->json(['message' => 'Bảng không tồn tại.'], 404);
            $posts = Post::orderBy('created_at', 'desc')->get();
            $imgCol = $this->getImageColumn();
            $hasStatusCol = Schema::hasColumn('posts', 'status');
            $hasIsPublishedCol = Schema::hasColumn('posts', 'is_published');

            $formattedPosts = $posts->map(function ($post) use ($imgCol, $hasStatusCol, $hasIsPublishedCol) {
                $categoryValue = $post->category_id ?? $post->category ?? 'khac';
                $statusValue = 'draft';
                if ($hasStatusCol) $statusValue = ($post->status === 'published' || $post->status === 'active' || $post->status == 1) ? 'published' : 'draft';
                elseif ($hasIsPublishedCol) $statusValue = ($post->is_published == 1 || $post->is_published === true) ? 'published' : 'draft';

                return [
                    'id' => $post->id,
                    'title' => $post->title ?? 'Không tiêu đề',
                    'slug' => $post->slug ?? '',
                    'category' => $categoryValue,
                    'status' => $statusValue,
                    'thumbnail' => $post->{$imgCol} ?? '',
                    'created_at' => $post->created_at,
                    'createdAt' => $post->created_at,
                    'views' => $post->views ?? $post->view_count ?? 0,
                ];
            });
            return response()->json($formattedPosts, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    public function show($id): JsonResponse
    {
        try {
            $post = is_numeric($id) ? Post::find($id) : Post::where('slug', $id)->first();
            if (!$post) return response()->json(['message' => 'Không tồn tại.'], 404);
            return response()->json($post, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
        ]);
        if ($validator->fails()) return response()->json(['success' => false, 'errors' => $validator->errors()], 422);

        try {
            $post = new Post();
            $post->title = $request->title;
            $post->slug = $request->slug ?? Str::slug($request->title);
            $post->content = $request->content;
            $post->summary = $request->summary;

            $catInput = $request->category ?? $request->category_id;
            $isThiTruong = ($catInput === 'thi-truong' || $catInput === '1' || $catInput == 1);

            if (Schema::hasColumn('posts', 'category_id')) $post->category_id = $isThiTruong ? 1 : 2;
            if (Schema::hasColumn('posts', 'category')) $post->category = $isThiTruong ? 'thi-truong' : 'tien-do';
            if (Schema::hasColumn('posts', 'status')) $post->status = $request->status ?? 'published';
            if (Schema::hasColumn('posts', 'is_published')) $post->is_published = ($request->status === 'published');

            if ($request->hasFile('image')) {
                $path = public_path('upload/posts');
                if (!file_exists($path)) mkdir($path, 0755, true);
                $filename = Str::slug($request->title) . '-' . time() . '.' . $request->file('image')->getClientOriginalExtension();
                $request->file('image')->move($path, $filename);
                $imgCol = $this->getImageColumn();
                $post->{$imgCol} = '/upload/posts/' . $filename;
            }

            // =========================================================================
            // 🟢 TUYỆT CHIÊU GỌNG KÌM: Ưu tiên bốc từ Token, nếu Token hụt bốc ngay từ Form gửi lên
            // =========================================================================
            $curUser = $request->user() ?? auth()->user();
            $fallbackUserId = $request->input('author_id') ?? $request->input('user_id') ?? null;

            // Xác định chính xác ID cuối cùng hợp lệ để ghi nhận
            $finalAuthorId = $curUser ? $curUser->id : $fallbackUserId;

            if ($finalAuthorId) {
                if (Schema::hasColumn('posts', 'user_id')) $post->user_id = $finalAuthorId;
                if (Schema::hasColumn('posts', 'author_id')) $post->author_id = $finalAuthorId;
            }
            // =========================================================================

          	$post->save();

            if (($post->status ?? 'published') === 'published' || ($post->is_published ?? 1) == 1) {
            	$this->sendUrlToGoogleIndexing("https://www.bconstower.vn/tin-tuc/{$post->slug}", 'URL_UPDATED');
            }

            // Lấy tên tác giả để ghi lịch sử hệ thống hoạt động chính xác
            $staffName = 'Quản trị viên';
            if ($curUser) {
                $staffName = $curUser->fullname ?? $curUser->name ?? 'Quản trị viên';
            } elseif ($fallbackUserId) {
                $userDb = DB::table('users')->where('id', $fallbackUserId)->first();
                if ($userDb) {
                    $staffName = $userDb->fullname ?? $userDb->name ?? 'Quản trị viên';
                }
            }

            ActivityLog::write('Thêm mới ➕', 'Bài viết tin tức', "Người dùng [{$staffName}] đã đăng bài viết mới [{$post->title}].");

            return response()->json(['success' => true, 'message' => 'Đăng bài viết thành công!', 'data' => $post], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id): JsonResponse
    {
        try {
            $post = Post::find($id);
            if (!$post) return response()->json(['success' => false, 'message' => 'Không tồn tại.'], 404);

            $post->title = $request->title;
            $post->slug = $request->slug ?? Str::slug($request->title);
            $post->content = $request->content;
            $post->summary = $request->summary;

            $catInput = $request->category ?? $request->category_id;
            $isThiTruong = ($catInput === 'thi-truong' || $catInput === '1' || $catInput == 1);

            if (Schema::hasColumn('posts', 'category_id')) $post->category_id = $isThiTruong ? 1 : 2;
            if (Schema::hasColumn('posts', 'category')) $post->category = $isThiTruong ? 'thi-truong' : 'tien-do';
            if (Schema::hasColumn('posts', 'status')) $post->status = $request->status ?? 'published';
            if (Schema::hasColumn('posts', 'is_published')) $post->is_published = ($request->status === 'published');

            if ($request->hasFile('image')) {
                $imgCol = $this->getImageColumn();
                if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) @unlink(public_path($post->{$imgCol}));
                $filename = Str::slug($request->title) . '-' . time() . '.' . $request->file('image')->getClientOriginalExtension();
                $request->file('image')->move(public_path('upload/posts'), $filename);
                $post->{$imgCol} = '/upload/posts/' . $filename;
            }

            $post->save();

            if (($post->status ?? 'published') === 'published' || ($post->is_published ?? 1) == 1) {
                $this->sendUrlToGoogleIndexing("https://www.bconstower.vn/tin-tuc/{$post->slug}", 'URL_UPDATED');
            }

            $curUser = $request->user() ?? auth()->user();
            $staffName = $curUser->fullname ?? $curUser->name ?? 'Quản trị viên';
            ActivityLog::write('Chỉnh sửa 📝', 'Bài viết tin tức', "Tài khoản [{$staffName}] đã chỉnh sửa bài viết [{$post->title}].");

            return response()->json(['success' => true, 'message' => 'Cập nhật thành công!'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $post = Post::find($id);
            if (!$post) return response()->json(['success' => false, 'message' => 'Không tồn tại.'], 404);
            $postTitle = $post->title;
            $imgCol = $this->getImageColumn();
            if ($post->{$imgCol} && file_exists(public_path($post->{$imgCol}))) @unlink(public_path($post->{$imgCol}));
          	if (!empty($post->slug)) {
              $this->sendUrlToGoogleIndexing("https://www.bconstower.vn/tin-tuc/{$post->slug}", 'URL_DELETED');
            }
            $post->delete();

            $curUser = $request->user() ?? auth()->user();
            $staffName = $curUser->fullname ?? $curUser->name ?? 'Quản trị viên';
            ActivityLog::write('Xóa bỏ ❌', 'Bài viết tin tức', "Tài khoản [{$staffName}] đã gỡ bài viết [{$postTitle}].");
            return response()->json(['success' => true, 'message' => 'Đã xóa.'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()], 500);
        }
    }

    public function getPublicPosts(Request $request): JsonResponse
    {
        try {
            $query = Post::query();
            $query = $this->applyStatusFilter($query, 'published');
            if ($request->has('category')) $query = $this->applyCategoryFilter($query, $request->query('category'));

            $posts = $query->orderBy('created_at', 'desc')->get();
            $imgCol = $this->getImageColumn();
            $data = $posts->map(function ($post) use ($imgCol) { return $this->formatPostOutput($post, $imgCol); });
            return response()->json($data, 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getPostDetail(Request $request)
    {
        $slug = $request->query('slug');
        if (!$slug) return response()->json(['message' => 'Thiếu slug'], 400);

        try {
            $query = Post::where('slug', $slug);
            $query = $this->applyStatusFilter($query, 'published');
            $post = $query->first();
            if (!$post) return response()->json(['message' => 'Không tồn tại'], 404);

            $imgCol = $this->getImageColumn();
            return response()->json(['post' => $this->formatPostOutput($post, $imgCol)], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

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
            $formatted = $posts->map(function($post) use ($imgCol) { return $this->formatPostOutput($post, $imgCol); });
            return response()->json($formatted, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * 🔥 THẦN TỐC TĂNG LƯỢT XEM CHỐNG SẬP PHÂN QUYỀN TRÊN VPS BCONS
     */
    public function incrementView(Request $request, $id): JsonResponse
    {
        try {
            // 1. Tự động quét tên cột lượt xem thực tế tránh lỗi lệch tên trường DB
            $viewCol = Schema::hasColumn('posts', 'views') ? 'views' : (Schema::hasColumn('posts', 'view_count') ? 'view_count' : 'views');

            // 2. 🔥 GIẢI PHÁP PHÁ bẫy NGINX: Bốc tách IP thật từ Header Forwarded
            $clientIp = $request->header('X-Forwarded-For')
                        ?? $request->header('X-Real-IP')
                        ?? $request->ip();

            // Nếu chuỗi IP bị lặp (Ví dụ: 14.232.2.4, 127.0.0.1) thì bốc đúng thằng đầu tiên ra xử lý
            if (str_contains($clientIp, ',')) {
                $ips = explode(',', $clientIp);
                $clientIp = trim($ips[0]);
            }
            $clientIp = trim($clientIp);

            // Ghi một dòng log sạch sẽ để ông giáo mở file storage/logs/laravel.log ra nghiệm thu IP nhảy liên tục
            \Illuminate\Support\Facades\Log::info("Luồng đọc bài ID [{$id}] - IP bốc tách thành công: {$clientIp}");

            // 3. Thiết lập khóa cứng mã hóa MD5 IP bảo mật trong 24 giờ trên mỗi bài viết
            $cacheKey = 'post_view_ip_lock_24h:' . md5($clientIp) . ':' . $id;

            $alreadyViewed = false;
            try {
                if (\Illuminate\Support\Facades\Cache::driver('file')->has($cacheKey)) {
                    $alreadyViewed = true;
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Lỗi phân quyền bộ nhớ cache Storage trên VPS: ' . $e->getMessage());
            }

            // 🔒 NẾU ĐÃ TRÙNG IP TRONG 24H: Trả về số view hiện tại, chặn đứng tăng bậy
            if ($alreadyViewed) {
                $currentPost = \App\Models\Post::find($id);
                return response()->json(['success' => true, 'views' => (int)($currentPost->{$viewCol} ?? 0)], 200);
            }

            // 🔓 NẾU IP MỚI TOÀN DIỆN TRONG NGÀY: Ép lệnh tăng thô trực tiếp vào bảng MySQL
            if (\Illuminate\Support\Facades\Schema::hasColumn('posts', $viewCol)) {
                \Illuminate\Support\Facades\DB::table('posts')->where('id', $id)->increment($viewCol);
            }

            try {
                // Đóng dấu xích cổ IP này đúng 24 giờ (1440 phút)
                \Illuminate\Support\Facades\Cache::driver('file')->put($cacheKey, true, now()->addHours(24));
            } catch (\Throwable $e) {}

            // Lấy lại data mới tinh sau khi cộng mốc từ DB ra trả công khai cho Frontend
            $updatedPost = \App\Models\Post::find($id);
            return response()->json(['success' => true, 'views' => (int)($updatedPost->{$viewCol} ?? 0)], 200);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Lỗi nghiêm trọng hàm incrementView: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
