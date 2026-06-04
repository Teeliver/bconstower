// backend/src/routes/settings.ts
import { Hono } from 'hono';
import { SettingService } from '../services/settings.service';
import { authMiddleware } from '../middlewares/auth';

type Bindings = {}
type Variables = {
  userId: number;
  userRole: string;
}

const settingApp = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// 1. API LẤY THÔNG TIN CÀI ĐẶT (Public - Phục vụ Layout web hiển thị Hotline, Logo công khai)
settingApp.get('/', async (c) => {
  try {
    const settings = await SettingService.getSystemSettings();
    // Nếu chưa có dữ liệu cấu hình nào, trả về object rỗng {} thay vì báo lỗi sập luồng
    return c.json(settings || {});
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi lấy cấu hình hệ thống' }, 500);
  }
});

// 2. API CẬP NHẬT HOẶC KHỞI TẠO CẤU HÌNH (Yêu cầu Admin Auth bảo mật cao)
settingApp.post('/update', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    
    // Gọi trực tiếp tầng nghiệp vụ Service để xử lý nén file và Upsert
    const result = await SettingService.updateSystemSettings(body);
    
    return c.json(result, 200);
  } catch (error: any) {
    console.error("❌ Cập nhật Settings thất bại:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default settingApp;