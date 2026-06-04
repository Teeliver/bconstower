<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

// Khai báo đồng bộ các Model thực thể tương ứng với danh sách table thực tế
use App\Models\User;
use App\Models\Bank;
use App\Models\Setting;
use App\Models\Apartment;
use App\Models\Project;
use App\Models\Post;
use App\Models\HeroSlide;
use App\Observers\ActivityObserver;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // 🚀 ĐỒNG BỘ 100%: Ra lệnh tự động ghi nhận lịch sử cho từng phân mục hệ thống Bcons
        User::observe(ActivityObserver::class);
        Bank::observe(ActivityObserver::class);
        Setting::observe(ActivityObserver::class);
        Apartment::observe(ActivityObserver::class);
        Project::observe(ActivityObserver::class);
        Post::observe(ActivityObserver::class);

        if (class_exists(HeroSlide::class)) {
            HeroSlide::observe(ActivityObserver::class);
        }
    }
}
