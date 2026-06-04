<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('settings', function (Blueprint $table) {
            $table->integer('id')->default(1)->primary();
            $table->string('site_title', 255)->nullable();
            $table->text('site_description')->nullable();
            $table->string('favicon', 255)->nullable();
            $table->string('og_image', 255)->nullable();
            $table->string('logo', 255)->nullable();
            $table->string('logo_footer', 255)->nullable();
            $table->string('hotline', 20)->nullable();
            $table->string('email', 255)->nullable();
            $table->text('address')->nullable();
            $table->string('copyright', 255)->nullable();
            $table->string('facebook_url', 255)->nullable();
            $table->string('zalo_url', 255)->nullable();
            $table->string('youtube_url', 255)->nullable();
            $table->string('google_analytics', 50)->nullable();
            $table->text('custom_scripts')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->integer('user_id');
            $table->text('action');
            $table->text('target');
            $table->text('description')->nullable();
            $table->integer('is_read')->default(0);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('hero_slides', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->string('title', 255);
            $table->text('subtitle')->nullable();
            $table->string('image_url', 500);
            $table->string('link_url', 500)->nullable();
            $table->string('button_text', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        Schema::create('banks', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->string('name', 255);
            $table->text('logo')->nullable();
            $table->decimal('preferential_rate', 4, 2);
            $table->integer('preferential_term');
            $table->decimal('floating_rate', 4, 2);
            $table->integer('max_term');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void {
        Schema::dropIfExists('banks');
        Schema::dropIfExists('hero_slides');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('settings');
    }
};
