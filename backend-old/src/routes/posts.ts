// backend/src/routes/posts.ts
import { Hono } from 'hono';
import { PostService } from '../services/posts.service';
import { authMiddleware } from '../middlewares/auth';

type Bindings = {}
type Variables = {
  userRole: string;
  userId: number;
  jwtPayload: { id: number; email: string; role: string; };
}

const postApp = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// 1. API LẤY DANH SÁCH (Admin)
postApp.get('/admin-list', authMiddleware, async (c) => {
  try {
    const data = await PostService.getAdminList();
    return c.json(data);
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi lấy danh sách' }, 500);
  }
});

// 2. API LẤY TIN TỨC CÔNG KHAI CHO TRANG CHỦ (Không dùng auth)
postApp.get('/public', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = Number(c.req.query('limit')) || 10;

    const data = await PostService.getPublicList(category, limit);
    return c.json(data);
  } catch (error) {
    console.error("Lỗi Public News:", error);
    return c.json([], 500);
  }
});

// 🔥 ĐỒNG BỘ HỆ THỐNG: API LẤY CHI TIẾT BÀI VIẾT QUA SLUG CHO FRONT-END (Không dùng auth)
// Lưu ý: Phải đặt TRƯỚC route /:id để Hono không nhận nhầm chuỗi "detail" thành tham số ID
postApp.get('/public/detail', async (c) => {
  try {
    const slug = c.req.query('slug');
    if (!slug) {
      return c.json({ success: false, message: 'Thiếu tham số slug' }, 400);
    }

    const post = await PostService.getPostBySlug(slug);
    if (!post) {
      return c.json({ success: false, message: 'Bài viết không tồn tại hoặc chưa được xuất bản' }, 404);
    }

    return c.json({ success: true, post });
  } catch (error: any) {
    console.error("Lỗi Public Detail Slug:", error);
    return c.json({ success: false, message: 'Lỗi máy chủ hệ thống' }, 500);
  }
});

// 3. API LẤY CHI TIẾT BÀI VIẾT (Đổ data vào Form Edit của Admin dựa trên ID số)
postApp.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const post = await PostService.getPostById(id);
    
    if (!post) return c.json({ success: false, message: "Không tìm thấy bài viết" }, 404);
    return c.json(post);
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi máy chủ' }, 500);
  }
});

// 4. API TẠO BÀI VIẾT MỚI
postApp.post('/create', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const body = await c.req.parseBody();

    const result = await PostService.createPost(body, payload.id);
    return c.json(result, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 5. API CẬP NHẬT BÀI VIẾT (PUT)
postApp.put('/update/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const body = await c.req.parseBody();

    const result = await PostService.updatePost(id, body, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    console.error("Lỗi Edit:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 6. API XÓA BÀI VIẾT KHỎI HỆ THỐNG
postApp.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');

    const result = await PostService.deletePost(id, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default postApp;