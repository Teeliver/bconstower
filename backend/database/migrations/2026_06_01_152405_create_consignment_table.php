<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consignments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();             // Tên chủ nhà
            $table->string('phone');                        // SĐT / Zalo chủ nhà
            $table->string('type')->default('ban');         // ban (Cần bán) hoặc cho_thue (Cho thuê)
            $table->string('project');                      // Dự án (Bcons City, Polaris...)
            $table->string('apartment_code')->nullable();   // Mã căn (Ví dụ: A-12.05)
            $table->string('price')->nullable();            // Giá mong muốn (Ví dụ: 1.8 Tỷ)
            $table->text('notes')->nullable();              // Ghi chú thêm (Tình trạng nội thất, view...)
            $table->string('status')->default('moi');       // moi, dang_ra_hang, da_chot, huy
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consignments');
    }
};
