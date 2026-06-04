// backend/src/routes/heroslide.ts
import { Hono } from 'hono';
import { HeroSlideService } from '../services/heroslide.service';

const heroslideApp = new Hono();

// 1. API CHO TRANG CHỦ PUBLIC (Chỉ lấy banner đang hoạt động)
heroslideApp.get('/public-list', async (c) => {
  try {
    const data = await HeroSlideService.getPublicList();
    return c.json(data);
  } catch (error) {
    return c.json({ message: 'Lỗi máy chủ' }, 500);
  }
});

// 2. API CHO ADMIN (Lấy tất cả các banner)
heroslideApp.get('/admin-list', async (c) => {
  try {
    const data = await HeroSlideService.getAdminList();
    return c.json(data);
  } catch (error) {
    return c.json({ message: 'Lỗi máy chủ' }, 500);
  }
});

// 3. API THÊM MỚI BANNER SLIDE
heroslideApp.post('/add', async (c) => {
  try {
    const body = await c.req.parseBody();
    const result = await HeroSlideService.createSlide(body);
    return c.json(result, 201);
  } catch (error: any) {
    console.error("❌ Lỗi thêm Banner:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 4. API LẤY CHI TIẾT 1 BANNER THEO ID (Phục vụ form sửa)
heroslideApp.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const slide = await HeroSlideService.getSlideById(id);
    
    if (!slide) return c.json({ success: false, message: 'Không tìm thấy slide banner này' }, 404);
    return c.json(slide);
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi máy chủ' }, 500);
  }
});

// 5. API CẬP NHẬT THÔNG TIN BANNER (PUT)
heroslideApp.put('/update/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.parseBody();

    const result = await HeroSlideService.updateSlide(id, body);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 6. API XÓA BANNER KHỎI HỆ THỐNG
heroslideApp.delete('/delete/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const result = await HeroSlideService.deleteSlide(id);
    return c.json(result, 200);
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi khi xóa banner' }, 500);
  }
});

export default heroslideApp;