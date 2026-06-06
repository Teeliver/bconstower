<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title')->index(); // Tên chiến dịch, đánh index để tìm kiếm nhanh
            $table->string('image_path');      // Đường dẫn lưu file ảnh an toàn trên server
            $table->string('link_url')->nullable(); // Link sự kiện chuyển hướng khi click

            // Ép cứng danh sách các vị trí hợp lệ bằng kiểu ENUM để bảo mật tầng DB
            $table->enum('position', ['news_sidebar', 'apartment_sidebar', 'project_horizontal'])->default('news_sidebar');

            $table->integer('sort_order')->default(0); // Số nhỏ xếp trên, phục vụ logic nối tiếp nhau đổ xuống
            $table->boolean('is_active')->default(true)->index(); // Trạng thái bật/tắt nhanh chiến dịch
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
