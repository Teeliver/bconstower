<?php

// routes/api.php
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB; // 🔥 ĐÃ THÊM: Import Facade DB để chạy Closure Route mượt màng
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
use App\Http\Controllers\BannerController;

/*
|--------------------------------------------------------------------------
| 🌐 1. PUBLIC CLIENT API ROUTES (Không cần đăng nhập)
|--------------------------------------------------------------------------
| Cụm API công khai phục vụ hiển thị dữ liệu ngoài Frontend Astro & SEO Google
*/

// Phân hệ 🏢 Căn Hộ & Giỏ Hàng Dự Án
Route::prefix('apartments')->group(function () {
    Route::get('/', [ApartmentController::class, 'index']);
    Route::get('/hot-transfers', [ApartmentController::class, 'getHotTransfers']);
    Route::get('/new-posts', [ApartmentController::class, 'getNewPostList']);
    Route::get('/public-list', [ApartmentController::class, 'getPublicApartmentList']);
    Route::get('/by-project', [ApartmentController::class, 'getApartmentsByProject']);
    Route::get('/public-detail', [ApartmentController::class, 'getPublicDetail']);
    Route::get('/public-paths', [ApartmentController::class, 'getPublicPaths']);
    Route::get('/similar', [ApartmentController::class, 'getSimilarApartments']);
    Route::get('/{slug}', [ApartmentController::class, 'show'])->where('slug', '[a-zA-Z0-9_-]+');
    Route::get('/{id}/price-range-m2', [ApartmentController::class, 'getPriceRangeStats'])->where('id', '[0-9]+');
});
Route::get('/similar-apartments', [ApartmentController::class, 'getSimilarApartments']); // Route độc lập dự phòng cho Astro

// Phân hệ 📁 Danh Mục Dự Án Bcons
Route::prefix('projects')->group(function () {
    Route::get('/', [ProjectController::class, 'index']);
    Route::get('/public', [ProjectController::class, 'getPublicProjects']);
    Route::get('/{slug}', [ProjectController::class, 'show']);
});
Route::get('/projects-list', function() {
    try {
        $projects = DB::table('projects')->select('id', 'title', 'slug')->orderBy('id', 'desc')->get();
        return response()->json(['success' => true, 'data' => $projects], 200);
    } catch (\Exception $e) {
        return response()->json(['success' => false, 'data' => [], 'message' => 'Lỗi tải quỹ dự án: ' . $e->getMessage()], 500);
    }
});

// Phân hệ ✍️ Tin Tức & Bài Viết SEO
Route::prefix('posts')->group(function () {
    Route::get('/', [PostController::class, 'index']);
    Route::get('/public', [PostController::class, 'getPublicPosts']);
    Route::get('/public/detail', [PostController::class, 'getPostDetail']);
    Route::get('/public/new-section', [PostController::class, 'getNewsSection']);
    Route::post('/public/{id}/view', [PostController::class, 'incrementView'])->where('id', '[0-9]+'); // API Chống spam F5
    Route::get('/{slug}', [PostController::class, 'show']);
});

// Phân hệ 📲 Tiếp Nhận Form Khách Hàng (Leads & Ký Gửi)
Route::post('/leads', [LeadController::class, 'store']);
Route::post('/consignments', [ConsignmentController::class, 'store']);

// Phân hệ ⚙️ Tiện Ích Hệ Thống & Cấu Hình Trang Chủ
Route::get('/banks', [BankController::class, 'index']);
Route::get('/hero-slides', [HeroSlideController::class, 'index']);
Route::get('/settings', [SettingController::class, 'getSettings']);
Route::get('/settings/info', [SettingController::class, 'getSettings']);


/*
|--------------------------------------------------------------------------
| 🔑 2. PUBLIC ADMIN AUTH ROUTES (Đăng nhập hệ thống)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AuthController::class, 'login']);


/*
|--------------------------------------------------------------------------
| 🔒 3. SECURE ADMIN PORTAL API ROUTES (Bảo mật nghiêm ngặt phân quyền)
|--------------------------------------------------------------------------
| Toàn bộ phân hệ quản trị nội bộ kế thừa mã xác thực AdminAuthMiddleware.
| Được chia nhỏ thành các tầng quyền Admin, Manager, Broker động dựa vào phân phối của Trung Tín.
*/
Route::middleware([\App\Http\Middleware\AdminAuthMiddleware::class])->prefix('admin')->group(function () {

    /*
    |----------------------------------------------------------------------
    | 👑 CẤP ĐỘ 1: CHỈ ADMIN TỐI CAO (role:admin) CAN THIỆP
    |----------------------------------------------------------------------
    | Những tính năng then chốt liên quan đến bảo mật hệ thống và nhân sự cấp phòng.
    */
    Route::middleware(['role:admin'])->group(function () {

        // 🖼️ Phân hệ 1: Quản lý Banner Hero Slides trang chủ
        Route::prefix('hero-slides')->group(function () {
            Route::get('/', [HeroSlideController::class, 'index']);
            Route::post('/', [HeroSlideController::class, 'store']);
            Route::get('/{id}', [HeroSlideController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [HeroSlideController::class, 'update']);
            Route::delete('/{id}', [HeroSlideController::class, 'destroy']);
        });

        // 📁 Phân hệ 2: Quản lý danh mục Dự Án tổng thể
        Route::middleware(['auth:sanctum', 'check_role:admin'])->prefix('projects')->group(function () {
            Route::get('/', [ProjectController::class, 'index']); // Quản lý vào được danh sách
            Route::post('/add', [ProjectController::class, 'store']); // Quản lý vào được hàm lưu
            Route::get('/{id}', [ProjectController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [ProjectController::class, 'update']);
            Route::delete('/{id}', [ProjectController::class, 'destroy']);
        });

        // 👥 Phân hệ 5: Quản lý toàn bộ Tài Khoản Nhân Viên, Trưởng phòng & Môi Giới
        Route::prefix('users')->group(function () {
            Route::get('/', [UserController::class, 'index']);
            Route::post('/', [UserController::class, 'store']);
            Route::get('/{id}', [UserController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [UserController::class, 'update']);
            Route::delete('/{id}', [UserController::class, 'destroy']);
        });

        // Khóa cứng quyền can thiệp Banner Ads cho Admin và Manager, cấm Broker
        Route::middleware(['role:admin,manager'])->group(function () {
            Route::prefix('banners')->group(function () {
                Route::get('/', [BannerController::class, 'index']);
                Route::post('/', [BannerController::class, 'store']);
                Route::delete('/{id}', [BannerController::class, 'destroy']);
            });
        });

        // ⚙️ Phân hệ 9: Cấu hình cốt lõi Hệ thống Website & SEO Meta Flat toàn trang
        Route::get('/settings', [SettingController::class, 'index']);
        Route::post('/settings', [SettingController::class, 'update']);
    });


    /*
    |----------------------------------------------------------------------
    | 👔 CẤP ĐỘ 2: QUYỀN TRUY CẬP CỦA MANAGER (role:admin,manager)
    |----------------------------------------------------------------------
    | Chỉ mở đúng 5 phân hệ tương ứng 100% với các mục hiển thị trên ảnh ảnh của ông.
    */
    Route::middleware(['role:admin,manager'])->group(function () {



        // 🏢 [Mục 2 trên ảnh]: Quản lý căn hộ (Apartments Inventory)
        Route::prefix('apartments')->group(function () {
            Route::get('/', [ApartmentController::class, 'index']);
            Route::post('/', [ApartmentController::class, 'store']);
            Route::get('/{id}', [ApartmentController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [ApartmentController::class, 'update']);
            Route::delete('/{id}', [ApartmentController::class, 'destroy']);
        });

        // ✍️ [Mục 3 trên ảnh]: Quản lý bài viết (Posts News)
        Route::prefix('posts')->group(function () {
            Route::get('/', [PostController::class, 'index']);
            Route::post('/', [PostController::class, 'store']);
            Route::get('/{id}', [PostController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [PostController::class, 'update']);
            Route::delete('/{id}', [PostController::class, 'destroy']);
        });

        // 📞 [Mục 4 trên ảnh]: Khách Hàng (Leads Form thu thập thông tin)
        Route::prefix('leads')->group(function () {
            Route::get('/', [LeadController::class, 'index']);
            Route::put('/{id}/status', [LeadController::class, 'updateStatus']);
        });

        // 🤝 [Mục 5 trên ảnh]: Quản lý ký gửi (Consignments từ chủ nhà)
        Route::prefix('consignments')->group(function () {
            Route::get('/', [ConsignmentController::class, 'index']);
            Route::put('/{id}/status', [ConsignmentController::class, 'updateStatus']);
            Route::delete('/{id}', [ConsignmentController::class, 'destroy']);
        });

        // 🏦 Phân hệ 6: Quản lý liên kết danh sách Ngân Hàng Bảo Lãnh
        Route::prefix('banks')->group(function () {
            Route::get('/', [BankController::class, 'index']);
            Route::post('/', [BankController::class, 'store']);
            Route::get('/{id}', [BankController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [BankController::class, 'update']);
            Route::delete('/{id}', [BankController::class, 'destroy']);
        });

        /* 💡 Ghi chú hệ thống:
           Mục số 6 trên ảnh "Tính Thuế Phí" chạy bằng logic thuần của Client-side
           ngay trên giao diện Frontend Astro nên không cần mở API route riêng ở đây.
        */
    });


    /*
    |----------------------------------------------------------------------
    | 💼 CẤP ĐỘ 3: PHÂN QUYỀN MỞ CHO CẢ BROKER (role:admin,manager,broker)
    |----------------------------------------------------------------------
    | Cho phép Nhân viên môi giới vào đăng tin căn hộ ký gửi, sửa giỏ hàng và viết bài SEO.
    */
    Route::middleware(['role:admin,manager,broker'])->group(function () {

        // 📊 [Mục 1 trên ảnh]: Tổng quan (Dashboard Statistics)
        Route::get('/stats', [DashboardController::class, 'getStats']);

        // 🏢 Phân hệ 3: Quản lý và cập nhật trạng thái Giỏ Hàng Căn Hộ
        Route::prefix('apartments')->group(function () {
            Route::get('/', [ApartmentController::class, 'index']);
            Route::post('/', [ApartmentController::class, 'store']);
            Route::get('/{id}', [ApartmentController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [ApartmentController::class, 'update']);
            Route::delete('/{id}', [ApartmentController::class, 'destroy']);
        });

        // ✍️ Phân hệ 4: Cho phép cả 3 cấp viết/chỉnh sửa Bài Viết Tin Tức Bcons
        Route::prefix('posts')->group(function () {
            Route::get('/', [PostController::class, 'index']);
            Route::post('/', [PostController::class, 'store']);
            Route::get('/{id}', [PostController::class, 'show']);
            Route::match(['POST', 'PUT'], '/{id}', [PostController::class, 'update']);
            Route::delete('/{id}', [PostController::class, 'destroy']);
        });
    });

});


/*
|--------------------------------------------------------------------------
| 🔔 4. MISCELLANEOUS UTILITIES ROUTES
|--------------------------------------------------------------------------
*/
Route::prefix('notifications')->group(function () {
    Route::get('/', [NotificationController::class, 'index']);
    Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/mark-all-read', [NotificationController::class, 'markAllRead']);
});


// CỤM 1: PUBLIC CLIENT ROUTES (Không cần đăng nhập, Astro gọi trực tiếp)
Route::get('/public/banners', [BannerController::class, 'getBannersByPosition']);

