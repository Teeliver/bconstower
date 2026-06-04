// backend/src/routes/admin.ts
import { Hono } from 'hono';
import { DashboardService } from '../services/dashboard.service';
import { authMiddleware } from '../middlewares/auth';

const adminStatsApp = new Hono();

// API lấy toàn bộ số liệu Dashboard tổng quan
adminStatsApp.get('/stats', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = 10;

    // Gọi trực tiếp tầng nghiệp vụ Service để xử lý số liệu nặng
    const statsData = await DashboardService.getAdminStats(page, limit);

    return c.json(statsData, 200);
  } catch (error: any) {
    console.error("❌ Lỗi Admin Stats Route:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default adminStatsApp;