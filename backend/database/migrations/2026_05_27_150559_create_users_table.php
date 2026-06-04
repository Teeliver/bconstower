<?php
// database/migrations/2026_01_01_000001_create_users_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('users', function (Blueprint $table) {
            $table->integer('id')->autoIncrement()->primary();
            $table->string('fullname', 255);
            $table->string('email', 255)->unique();
            $table->text('password');
            $table->string('phone', 20)->nullable();
            $table->text('address')->nullable();
            $table->text('avatar')->nullable();
            $table->string('role', 20)->default('EDITOR');
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('users'); }
};
