<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('posts', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->text('summary')->nullable();
            $table->text('content');
            $table->string('thumbnail', 255)->nullable();
            $table->string('category', 100)->default('news');
            $table->integer('author_id')->nullable();
            $table->string('status', 50)->default('draft');
            $table->integer('views')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }
    public function down(): void { Schema::dropIfExists('posts'); }
};
