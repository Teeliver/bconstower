<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('projects', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->string('address', 255)->nullable(); // 🛠️ Đổi sang nullable để tránh lỗi SQL nghiêm trọng nếu form không truyền địa chỉ phẳng
            $table->text('image')->nullable();

            // Giữ nguyên hệ thống ENUM phân loại dự án của ông
            $table->enum('status', ['dang_xay_dung', 'da_ban_giao', 'dang_mo_ban', 'sap_mo_ban'])->default('dang_xay_dung');
            $table->enum('legal', ['so_hong', 'hdmb', 'booking'])->default('hdmb');

            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();

            // 🔥 TÍCH HỢP CỐT LÕI: Cột lưu trọn vẹn 11 Section Landing Page dạng JSON nguyên khối
            $table->json('landing_data')->nullable()->comment('Cấu trúc toàn diện của Landing Page Dự Án');

            // 🛡️ LỚP BẢO VỆ: Cột liên kết người tạo để thông suốt đoạn check Schema::hasColumn trong Controller
            $table->integer('user_id')->nullable()->index();

            // Timestamps xử lý native của Laravel
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate(); // 🛠️ BỔ SUNG: Ngăn chặn hàm $project->save() ném lỗi sập hệ thống do thiếu trường cập nhật
        });
    }

    public function down(): void {
        Schema::dropIfExists('projects');
    }
};
