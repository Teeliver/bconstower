// backend/src/services/heroslide.service.ts
import { db } from '../db';
import { heroSlides } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export class HeroSlideService {
  // 1. LẤY DANH SÁCH BANNER PUBLIC (Hiện ngoài trang chủ khách xem)
  static async getPublicList() {
    return await db
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.isActive, true))
      .orderBy(asc(heroSlides.displayOrder));
  }

  // 2. LẤY TẤT CẢ BANNER CHO ADMIN (Trang quản trị cấu hình)
  static async getAdminList() {
    return await db
      .select()
      .from(heroSlides)
      .orderBy(asc(heroSlides.displayOrder));
  }

  // 3. LẤY CHI TIẾT 1 SLIDE THEO ID (Đổ data vào form sửa banner)
  static async getSlideById(id: number) {
    const data = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1);
    return data[0] || null;
  }

  // 4. THÊM MỚI BANNER BANNER
  static async createSlide(body: any) {
    const imageFile = body.image as File;
    if (!imageFile || imageFile.size === 0) {
      throw new Error('Thiếu tập tin hình ảnh banner');
    }

    // Logic xử lý lưu file banner tĩnh công khai
    const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'banners');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    
    const arrayBuffer = await imageFile.arrayBuffer();
    writeFileSync(join(uploadDir, fileName), Buffer.from(arrayBuffer));

    // Thực hiện Insert dữ liệu qua Drizzle
    await db.insert(heroSlides).values({
      title: String(body.title),
      subtitle: String(body.subtitle || ''),
      imageUrl: `/uploads/banners/${fileName}`,
      linkUrl: String(body.linkUrl || '#'),
      buttonText: String(body.buttonText || 'Tìm kiếm ngay'),
      isActive: body.isActive === '1' || body.isActive === true, 
      displayOrder: Number(body.displayOrder) || 0,
    });

    return { success: true, message: 'Thêm banner thành công' };
  }

  // 5. CẬP NHẬT THÔNG TIN BANNER (SỬA)
  static async updateSlide(id: number, body: any) {
    const [existing] = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1);
    if (!existing) throw new Error('Không tìm thấy banner cần chỉnh sửa');

    let dbImageUrl = existing.imageUrl;
    const imageFile = body.image as File;

    // Nếu có truyền file ảnh mới thì ghi đè file, không thì giữ đường dẫn cũ
    if (imageFile && imageFile.size > 0) {
      const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'banners');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      
      const arrayBuffer = await imageFile.arrayBuffer();
      writeFileSync(join(uploadDir, fileName), Buffer.from(arrayBuffer));
      dbImageUrl = `/uploads/banners/${fileName}`;
    }

    // Cập nhật Database
    await db.update(heroSlides)
      .set({
        title: String(body.title),
        subtitle: String(body.subtitle || ''),
        imageUrl: dbImageUrl,
        linkUrl: String(body.linkUrl || '#'),
        buttonText: String(body.buttonText || 'Tìm kiếm ngay'),
        isActive: body.isActive === '1' || body.isActive === true,
        displayOrder: Number(body.displayOrder) || 0,
      })
      .where(eq(heroSlides.id, id));

    return { success: true, message: 'Cập nhật banner thành công' };
  }

  // 6. XÓA BANNER KHỎI HỆ THỐNG
  static async deleteSlide(id: number) {
    await db.delete(heroSlides).where(eq(heroSlides.id, id));
    return { success: true, message: 'Đã xóa banner khỏi hệ thống thành công' };
  }
}