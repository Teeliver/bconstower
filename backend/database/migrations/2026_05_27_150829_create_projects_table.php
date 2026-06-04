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
            $table->string('address', 255);
            $table->text('image')->nullable();
            $table->enum('status', ['dang_xay_dung', 'da_ban_giao', 'dang_mo_ban', 'sap_mo_ban'])->default('dang_xay_dung');
            $table->enum('legal', ['so_hong', 'hdmb', 'booking'])->default('hdmb');
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('projects'); }
};
