// backend/src/utils/upload.ts
import fs from 'fs/promises';
import path from 'path';

/**
 * Hàm tiện ích xử lý lưu file upload từ client lên Server
 * @param file Đối tượng File nhận từ c.req.parseBody()
 * @param folder Thư mục muốn lưu (ví dụ: 'projects', 'apartments', 'avatars')
 * @param slug Chuỗi slug của dự án/căn hộ để đặt tên file cho đẹp chuẩn SEO
 * @returns Đường dẫn URL của file sau khi lưu để ghi vào Database
 */
export async function saveUploadFile(file: File, folder: string, slug: string): Promise<string | null> {
  try {
    if (!file || !file.name || file.size === 0) {
      return null;
    }

    // 1. Định nghĩa thư mục lưu trữ (ví dụ: public/uploads/projects)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    
    // Tạo thư mục nếu chưa tồn tại đĩa cứng
    await fs.mkdir(uploadDir, { recursive: true });

    // 2. Xử lý đuôi mở rộng của file (.jpg, .png, .webp)
    const ext = path.extname(file.name) || '.jpg';
    
    // Đặt tên file theo slug + timestamp để không bao giờ bị trùng lặp ghi đè
    const fileName = `${slug}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // 3. Chuyển đổi dữ liệu File thành Buffer để ghi xuống ổ đĩa bằng Node.js
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await fs.writeFile(filePath, buffer);

    // 4. Trả về đường dẫn URL tĩnh để lưu vào Database (để Frontend Astro gọi hiển thị công khai)
    return `/uploads/${folder}/${fileName}`;

  } catch (error) {
    console.error("Lỗi xử lý file upload:", error);
    throw new Error("Không thể tải tập tin lên hệ thống");
  }
}