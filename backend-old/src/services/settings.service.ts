// backend/src/services/settings.service.ts
import { db } from '../db';
import { settings as settingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs-extra';
import path from 'path';

export class SettingService {
  
  // 1. ĐỒNG BỘ ROUTER: Lấy thông tin cấu hình hệ thống (ID CỐ ĐỊNH = 1)
  static async getSystemSettings() {
    try {
      const data = await db.select().from(settingsTable).where(eq(settingsTable.id, 1)).limit(1);
      
      if (data && data[0]) {
        return data[0];
      }

      // 🔥 NÂNG CẤP AN TOÀN: Nếu DB trống trơn chưa cấu hình, trả về data mặc định ngay để web luôn có Logo & Hotline chạy ổn định
      return {
        id: 1,
        siteTitle: "Bcons Tower - Căn hộ Bcons chính thức từ Chủ đầu tư",
        siteDescription: "Cập nhật thông tin dự án, tiến độ, giá bán căn hộ Bcons mới nhất từ chủ đầu tư.",
        favicon: "/favicon.ico",
        ogImage: "/uploads/system/og-default.jpg",
        logo: "/uploads/system/logo-default.png",
        logoFooter: "/uploads/system/logo-footer-white.png",
        hotline: "0911 502 603",
        email: "contact@bconstower.vn",
        address: "Số 176/1-176/3 Đường Nguyễn Văn Thương, Phường 25, Quận Bình Thạnh, TP.Hồ Chí Minh",
        copyright: "© 2026 bconstower.vn. All rights reserved.",
        facebookUrl: "https://www.facebook.com/HouseNowVN",
        zaloUrl: "https://zalo.me/0911502603",
        youtubeUrl: "",
        googleAnalytics: "",
        customScripts: ""
      };
    } catch (error) {
      console.error("❌ Lỗi truy vấn bảng settings dưới DB:", error);
      return null;
    }
  }

  // 2. ĐỒNG BỘ ROUTER: Cập nhật hoặc tạo mới toàn bộ cấu hình (UPSERT LOGIC)
  static async updateSystemSettings(body: any) {
    // Khởi tạo object dữ liệu từ form text gửi lên
    const updateData: any = {
      siteTitle: body.siteTitle !== undefined ? String(body.siteTitle) : "",
      siteDescription: body.siteDescription !== undefined ? String(body.siteDescription) : "",
      hotline: body.hotline !== undefined ? String(body.hotline) : "",
      email: body.email !== undefined ? String(body.email) : "",
      address: body.address !== undefined ? String(body.address) : "",
      copyright: body.copyright !== undefined ? String(body.copyright) : "",
      facebookUrl: body.facebookUrl !== undefined ? String(body.facebookUrl) : "",
      zaloUrl: body.zaloUrl !== undefined ? String(body.zaloUrl) : "",
      youtubeUrl: body.youtubeUrl !== undefined ? String(body.youtubeUrl) : "",
      googleAnalytics: body.googleAnalytics !== undefined ? String(body.googleAnalytics) : "",
      customScripts: body.customScripts !== undefined ? String(body.customScripts) : "",
      updatedAt: new Date(),
    };

    // Mảng chứa các trường upload file đặc thù của hệ thống
    const uploadFields = ['logo', 'logoFooter', 'favicon', 'ogImage'];
    const relativeDir = `/uploads/system`;
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir);
    
    // Đảm bảo thư mục lưu trữ assets vật lý luôn tồn tại
    await fs.ensureDir(absoluteDir);

    // Vòng lặp xử lý quét file từ multipart form data gửi lên
    for (const field of uploadFields) {
      const file = body[field];
      
      if (file instanceof File && file.size > 0) {
        // Tạo tên file định dạng chuẩn hóa: field-timestamp.extension
        const ext = path.extname(file.name) || '.png';
        const fileName = `${field}-${Date.now()}${ext}`;
        const filePath = path.join(absoluteDir, fileName);
        
        // Ghi dữ liệu file nhị phân xuống đĩa cứng Server
        const buffer = await file.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        // Gán đường dẫn URL asset tĩnh mới vào object dữ liệu để lưu vào MySQL
        updateData[field] = `${relativeDir}/${fileName}`;

        // TIẾN HÀNH DỌN RÁC: Xóa file cũ vật lý trên ổ đĩa để giải phóng dung lượng hosting
        const oldPath = body[`current_${field}`];
        if (oldPath && typeof oldPath === 'string' && oldPath.startsWith('/uploads')) {
            const oldFullPath = path.join(process.cwd(), 'public', oldPath);
            if (await fs.pathExists(oldFullPath)) {
              await fs.remove(oldFullPath);
            }
        }
      } else {
        // Nếu không upload file mới, giữ nguyên giá trị cũ bốc từ hidden input tương ứng của Frontend
        updateData[field] = body[`current_${field}`] || null;
      }
    }

    // --- LOGIC UPSERT THỰC TẾ TRÊN DATABASE MYSQL ---
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.id, 1)).limit(1);

    if (existing.length > 0) {
      // Nếu đã tồn tại dòng ID = 1, tiến hành cập nhật đè dữ liệu mới
      await db.update(settingsTable).set(updateData).where(eq(settingsTable.id, 1));
    } else {
      // Chèn mới bản ghi cấu hình đầu tiên với ID cứng là 1 cho hệ thống
      await db.insert(settingsTable).values({ id: 1, ...updateData });
    }

    return { 
      success: true, 
      message: 'Cấu hình hệ thống đã được cập nhật thành công!',
      data: updateData 
    };
  }
}