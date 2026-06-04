<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('apartments', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->integer('project_id');
            $table->string('name', 100);
            $table->string('slug', 255)->unique();
            $table->string('block', 50)->nullable();
            $table->integer('floor')->nullable();
            $table->decimal('area', 10, 2)->nullable();
            $table->integer('bedrooms')->nullable();
            $table->integer('bathrooms')->nullable();
            $table->string('direction_main', 50)->nullable();
            $table->string('direction_balcony', 50)->nullable();
            $table->string('furniture', 100)->nullable();
            $table->text('description')->nullable();
            $table->bigInteger('price')->nullable();
            $table->enum('status', ['trong', 'da_coc', 'da_ban'])->default('trong');
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('image');
            $table->text('folder_path')->nullable();
            $table->integer('user_id')->nullable();
            $table->integer('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
        });
    }
    public function down(): void { Schema::dropIfExists('apartments'); }
};
