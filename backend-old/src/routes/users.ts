// backend/src/routes/users.ts
import { Hono } from 'hono';
import { UserService } from '../services/users.service';
import { authMiddleware } from '../middlewares/auth';

type Bindings = {}
type Variables = {
  userRole: string;
  userId: number;
  jwtPayload: { id: number; email: string; role: string; };
}

const userApp = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Helper trả kết quả JSON đồng bộ định dạng của Trung Tín
const errorResponse = (c: any, message: string, status: number = 500) => {
  return c.json({ success: false, message }, status);
};

// 1. API LẤY TOÀN BỘ DANH SÁCH USER (CƠ BẢN)
userApp.get('/', authMiddleware, async (c) => {
  try {
    const data = await UserService.getAllUsers();
    return c.json(data, 200);
  } catch (error) {
    return errorResponse(c, 'Lỗi lấy danh sách user');
  }
});

// 2. API LẤY DANH SÁCH USER CHI TIẾT KÈM PROFILE CHO ADMIN
userApp.get('/admin-list', authMiddleware, async (c) => {
  try {
    const data = await UserService.getAdminList();
    return c.json(data, 200);
  } catch (error) {
    return errorResponse(c, 'Lỗi lấy danh sách admin');
  }
});

// 3. API KHỞI TẠO TÀI KHOẢN ADMIN/USER MỚI VÀ GHI LOG AUDIT TRAIL
userApp.post('/register-admin', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const body = await c.req.parseBody();

    const result = await UserService.createAdminUser(body, payload.id);
    return c.json(result, 201);
  } catch (error: any) {
    const status = error.message.includes('tồn tại') ? 400 : 500;
    return c.json({ success: false, message: error.message }, status);
  }
});

// 4. API CHỈNH SỬA / CẬP NHẬT HỒ SƠ THÀNH VIÊN
userApp.put('/:id', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  const payload = c.get('jwtPayload');
  if (isNaN(id)) return c.json({ success: false, message: 'ID không hợp lệ' }, 400);

  try {
    const body = await c.req.parseBody();
    const result = await UserService.updateUserProfile(id, body, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 5. API PHÊ DUYỆT XÁC MINH NHANH THÀNH VIÊN MÔI GIỚI
userApp.post('/:id/verify', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const { status } = await c.req.json();

    const result = await UserService.verifyBrokerStatus(id, !!status, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 6. API GỠ BỎ / XÓA VĨNH VIỄN TÀI KHOẢN THÀNH VIÊN KHỎI HỆ THỐNG
userApp.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');

    const result = await UserService.deleteUserAccount(id, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    const status = error.message.includes('tại') ? 404 : 500;
    return c.json({ success: false, message: error.message }, status);
  }
});

// 7. API LẤY CHI TIẾT 1 THÀNH VIÊN THEO ID (PHỤC VỤ LOAD FORM SỬA)
userApp.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const user = await UserService.getUserById(id);
    
    if (!user) return c.json({ message: "Không tìm thấy người dùng" }, 404);
    return c.json(user, 200);
  } catch (error) {
    return c.json({ message: 'Lỗi server' }, 500);
  }
});

export default userApp;