<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver; // Dùng driver GD có sẵn trên VPS CloudPanel

class Controller
{
    /**
     * 🔥 SIÊU VŨ KHÍ NÉN ẢNH: Tự động Resize, Ép đuôi .webp, Nén chất lượng 75%
     * @param \Illuminate\Http\UploadedFile $file File ảnh thô từ Request
     * @param string $folder Thư mục muốn lưu (Ví dụ: 'apartments', 'projects')
     * @return string Đường dẫn file sau khi lưu để ghi vào Database
     */
    protected function compressAndUploadImage($file, $folder = 'uploads')
    {
        try {
            // 1. Khởi tạo Image Manager của Intervention v3
            $manager = new ImageManager(new Driver());
            $image = $manager->read($file);

            // 2. Tự động scale ảnh về độ rộng tối đa 1400px (giữ nguyên tỷ lệ chiều cao)
            // Tránh việc ảnh gốc có độ phân giải 4K/8K quá thừa thãi cho giao diện web
            if ($image->width() > 1400) {
                $image->scale(width: 1400);
            }

            // 3. Mã hóa toàn bộ sang định dạng .webp, đặt chất lượng nén là 75% (Tỷ lệ vàng giữa dung lượng và độ nét)
            $encodedWebp = $image->toWebp(75);

            // 4. Tự sinh tên file ngẫu nhiên chống trùng lặp dữ liệu
            $fileName = Str::random(20) . '_' . time() . '.webp';
            $storagePath = $folder . '/' . $fileName;

            // 5. Đẩy file đã nén vào ổ đĩa public công khai của Laravel
            Storage::disk('public')->put($storagePath, (string) $encodedWebp);

            // Trả về đường dẫn chuẩn để lưu vào Database (Ví dụ: uploads/apartments/abc_123.webp)
            return 'storage/' . $storagePath;

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Lỗi nghiêm trọng khi nén ảnh: " . $e->getMessage());

            // Bọc lót kịch bản lỗi: Nếu lỗi bộ nén, lưu file gốc để hệ thống không bị crash
            $rawPath = $file->store($folder, 'public');
            return 'storage/' . $rawPath;
        }
    }
}
