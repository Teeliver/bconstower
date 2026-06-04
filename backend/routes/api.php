<?php

// routes/api.php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeroSlideController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ApartmentController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\ConsignmentController;

/*
|--------------------------------------------------------------------------
| 🌐 1. PUBLIC CLIENT API ROUTES (Không cần đăng nhập)
|--------------------------------------------------------------------------
| Phục vụ hiển thị trang chủ, tra cứu thông tin giỏ hàng và công cụ tính vay
*/

Route::get('/apartments/hot-transfers', [ApartmentController::class, 'getHotTransfers']);
Route::get('/apartments/new-posts', [ApartmentController::class, 'getNewPostList']);
Route::get('/apartments/public-list', [ApartmentController::class, 'getPublicApartmentList']);
Route::get('/apartments/by-project', [ApartmentController::class, 'getApartmentsByProject']);
Route::get('/apartments/public-detail', [ApartmentController::class, 'getPublicDetail']);
Route::get('/apartments/public-paths', [ApartmentController::class, 'getPublicPaths']);
Route::get('/apartments/{id}/price-range-m2', [ApartmentController::class, 'getPriceRangeStats']);

Route::get('/projects/public', [ProjectController::class, 'getPublicProjects']);
Route::get('/posts/public', [PostController::class, 'getPublicPosts']);
Route::get('/posts/public/detail', [PostController::class, 'getPostDetail']);
Route::get('/posts/public/new-section', [PostController::class, 'getNewsSection']);

Route::get('/settings/info', [SettingController::class, 'getSettings']);

Route::post('/leads', [LeadController::class, 'store']);
Route::get('/projects-list', function() {
    try {
        // 🔥 ĐÃ CẬP NHẬT: Sắp xếp theo id desc để dự án MỚI NHẤT luôn nằm trên cùng
        $projects = DB::table('projects')
            ->select('id', 'title', 'slug')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $projects
        ], 200);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'data'    => [],
            'message' => 'Không thể tải danh sách quỹ dự án hệ thống: ' . $e->getMessage()
        ], 500);
    }
});

Route::post('/consignments', [ConsignmentController::class, 'store']);


// Ngân hàng liên kết & Công cụ vay vốn
Route::get('/banks', [BankController::class, 'index']);

// Danh mục Dự án Bcons (Danh sách & Chi tiết theo Slug)
Route::get('/projects', [ProjectController::class, 'index']);
Route::get('/projects/{slug}', [ProjectController::class, 'show']);


// Giỏ hàng Căn hộ (Danh sách & Chi tiết theo Slug)
Route::get('/apartments', [ApartmentController::class, 'index']);
Route::get('/apartments/{slug}', [ApartmentController::class, 'show']);
Route::get('/apartments/similar', [ApartmentController::class, 'getSimilarApartments']);

// Tin tức & Bài viết chuyên mục
Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/{slug}', [PostController::class, 'show']);
Route::post('/posts/public/{id}/view', [PostController::class, 'incrementView']);

// Cấu hình Hệ thống & Banner Slider trang chủ Client
Route::get('/settings', [SystemController::class, 'getSettings']);
Route::get('/hero-slides', [HeroSlideController::class, 'index']);


// Thay vì viết /apartments/similar, ông đổi thành path riêng biệt này:
Route::get('/similar-apartments', [ApartmentController::class, 'getSimilarApartments']);

/*
|--------------------------------------------------------------------------
| 🔑 2. PUBLIC ADMIN AUTH ROUTES (Đăng nhập quản trị)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AuthController::class, 'login']);


/*
|--------------------------------------------------------------------------
| 🔒 3. SECURE ADMIN PORTAL API ROUTES (Nhóm Quản Trị Bảo Mật Cao)
|--------------------------------------------------------------------------
| Gom toàn bộ phân hệ Admin vào một khối Middleware bảo mật duy nhất,
| sử dụng prefix 'admin' tự động để tối ưu mã nguồn sạch sẽ, tường minh.
*/
Route::middleware([\App\Http\Middleware\AdminAuthMiddleware::class])->prefix('admin')->group(function () {

    // 📊 PHÂN HỆ 0: BẢNG ĐIỀU KHIỂN & SỐ LIỆU THỐNG KÊ (DASHBOARD)
    // Đã bọc an toàn vào group tránh lỗi 404 / 401 khi Frontend bốc lịch sử hoạt động
    Route::get('/stats', [DashboardController::class, 'getStats']);


    // 🖼️ PHÂN HỆ 1: QUẢN LÝ BANNER HERO SLIDES TRANG CHỦ
    Route::get('/hero-slides', [HeroSlideController::class, 'index']);
    Route::post('/hero-slides', [HeroSlideController::class, 'store']);
    Route::get('/hero-slides/{id}', [HeroSlideController::class, 'show']);
    Route::match(['POST', 'PUT'], '/hero-slides/{id}', [HeroSlideController::class, 'update']);
    Route::delete('/hero-slides/{id}', [HeroSlideController::class, 'destroy']);


    // 📁 PHÂN HỆ 2: DANH MỤC DỰ ÁN BCONS (PROJECTS)
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);
    Route::match(['POST', 'PUT'], '/projects/{id}', [ProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);


    // 🏢 PHÂN HỆ 3: GIỎ HÀNG & THÔNG TIN CĂN HỘ (APARTMENTS)
    Route::get('/apartments', [ApartmentController::class, 'index']);
    Route::post('/apartments', [ApartmentController::class, 'store']);
    Route::get('/apartments/{id}', [ApartmentController::class, 'show']);
    Route::match(['POST', 'PUT'], '/apartments/{id}', [ApartmentController::class, 'update']);
    Route::delete('/apartments/{id}', [ApartmentController::class, 'destroy']);


    // ✍️ PHÂN HỆ 4: BÀI VIẾT & TIN TỨC ĐỊA ỐC (POSTS)
    Route::get('/posts', [PostController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::get('/posts/{id}', [PostController::class, 'show']);
    Route::match(['POST', 'PUT'], '/posts/{id}', [PostController::class, 'update']);
    Route::delete('/posts/{id}', [PostController::class, 'destroy']);


    // 👥 PHÂN HỆ 5: TÀI KHOẢN NHÂN VIÊN & MÔI GIỚI (USERS & BROKERS)
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::match(['POST', 'PUT'], '/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);


    // 🏦 PHÂN HỆ 6: NGÂN HÀNG LIÊN KẾT BẢO LÃNH VAY VỐN (BANKS)
    Route::get('/banks', [BankController::class, 'index']);
    Route::post('/banks', [BankController::class, 'store']);
    Route::get('/banks/{id}', [BankController::class, 'show']);
    Route::match(['POST', 'PUT'], '/banks/{id}', [BankController::class, 'update']);
    Route::delete('/banks/{id}', [BankController::class, 'destroy']);


    // ⚙️ PHÂN HỆ 7: CẤU HÌNH WEBSITE & SEO META FLAT SYSTEM (SETTINGS)
    Route::get('/settings', [SettingController::class, 'index']);
    Route::post('/settings', [SettingController::class, 'update']);

});

Route::prefix('notifications')->group(function () {
    Route::get('/', [NotificationController::class, 'index']);               // Khớp URL: /api/notifications
    Route::get('/unread-count', [NotificationController::class, 'unreadCount']); // Khớp URL: /api/notifications/unread-count
    Route::post('/mark-all-read', [NotificationController::class, 'markAllRead']); // Khớp URL: /api/notifications/mark-all-read
});

// --- 🔥 LUỒNG QUẢN TRỊ TRANG ADMIN (LEADS FORM MANAGEMENT) ---
Route::prefix('admin')->group(function () {
    // Lấy danh sách khách hàng điền form (Có phân trang & bộ lọc)
    Route::get('/leads', [LeadController::class, 'index']);

    // Cập nhật nhanh trạng thái cuộc gọi tư vấn của khách theo ID
    Route::put('/leads/{id}/status', [LeadController::class, 'updateStatus']);
});

// Route quản trị nội bộ trong cụm prefix admin của ông
Route::prefix('admin')->group(function () {
    // Luồng quản lý ký gửi
    Route::get('/consignments', [ConsignmentController::class, 'index']);
    Route::put('/consignments/{id}/status', [ConsignmentController::class, 'updateStatus']); // Tuyến mới
    Route::delete('/consignments/{id}', [ConsignmentController::class, 'destroy']);          // Tuyến mới
});
