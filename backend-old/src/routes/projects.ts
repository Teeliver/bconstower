// backend/src/routes/projects.ts
import { Hono } from 'hono';
import { ProjectService } from '../services/project.service';
import { authMiddleware } from '../middlewares/auth'; // Chỉnh lại đường dẫn chuẩn của bạn nhé

const projectApp = new Hono();

// 1. API LẤY DANH SÁCH DỰ ÁN
projectApp.get('/list', async (c) => {
  try {
    const projects = await ProjectService.getAllProjects();
    return c.json(projects, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 2. API LẤY CHI TIẾT DỰ ÁN (Phục vụ đổ data vào Form Edit)
projectApp.get('/detail', async (c) => {
  try {
    const slug = c.req.query('slug');
    if (!slug) return c.json({ success: false, message: 'Thiếu tham số slug' }, 400);

    const project = await ProjectService.getProjectBySlug(slug);
    if (!project) return c.json({ success: false, message: 'Không tìm thấy dự án' }, 404);

    return c.json(project, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 3. API THÊM DỰ ÁN MỚI
projectApp.post('/add', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload') as any; 
    const body = await c.req.parseBody();
    const userId = payload?.id ? Number(payload.id) : null;

    const result = await ProjectService.createProject(body, userId);
    return c.json(result, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 4. API SỬA DỰ ÁN
projectApp.put('/update', authMiddleware, async (c) => {
  try {
    const slug = c.req.query('slug');
    if (!slug) return c.json({ success: false, message: 'Thiếu tham see slug' }, 400);

    const payload = c.get('jwtPayload') as any;
    const body = await c.req.parseBody();
    const userId = payload?.id ? Number(payload.id) : null;

    const result = await ProjectService.updateProject(slug, body, userId);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 5. API XOÁ DỰ ÁN
projectApp.delete('/delete', authMiddleware, async (c) => {
  try {
    const slug = c.req.query('slug');
    if (!slug) return c.json({ success: false, message: 'Thiếu tham số slug' }, 400);

    const payload = c.get('jwtPayload') as any;
    const userId = payload?.id ? Number(payload.id) : null;

    const result = await ProjectService.deleteProject(slug, userId);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

projectApp.get('/public', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 20;

    // 🔥 ĐẢM BẢO PHẢI CÓ 'await' VÀ TRUYỀN BIẾN 'limit' VÀO TRONG HÀM SERVICE
    const projects = await ProjectService.getFeaturedProjects(limit);
    
    // Trả về mảng JSON sạch
    return c.json(projects, 200);
  } catch (error: any) {
    console.error("❌ Lỗi Endpoint /public:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default projectApp;