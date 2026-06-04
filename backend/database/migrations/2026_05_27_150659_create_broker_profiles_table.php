<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('broker_profiles', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->integer('user_id');
            $table->string('license_number', 50)->nullable();
            $table->string('company_name', 255)->nullable();
            $table->integer('experience_years')->nullable();
            $table->text('area_focus')->nullable();
            $table->text('bio')->nullable();
            $table->integer('verified')->default(0);
            $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();

            // Khóa ngoại ràng buộc xóa tài khoản gốc tự động mất profile
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
    public function down(): void { Schema::dropIfExists('broker_profiles'); }
};
