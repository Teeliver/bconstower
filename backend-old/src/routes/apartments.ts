// backend/src/routes/apartments.ts
import { Hono } from 'hono';
import { ApartmentService } from '../services/apartments.service';
import { authMiddleware } from '../middlewares/auth';

type Bindings = {}
type Variables = {
  userRole: string;
  userId: number;
  jwtPayload: { id: number; email: string; role: string; };
}

const apartmentApp = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// 1. API LẤY CHI TIẾT 1 CĂN THEO ID (Sửa căn hộ)
apartmentApp.get('/by-id/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const apartment = await ApartmentService.getApartmentById(id);
    return c.json(apartment);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 2. API LẤY DANH SÁCH CHO ADMIN (Có phân trang)
apartmentApp.get('/admin-list', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const data = await ApartmentService.getAdminList(page);
    return c.json(data);
  } catch (error) {
    return c.json({ success: false, message: 'Lỗi lấy danh sách admin' }, 500);
  }
});

// 3. API LẤY DANH SÁCH PUBLIC CHO FRONTEND TRANG CHỦ
apartmentApp.get('/public-list', async (c) => {
  try {
    const data = await ApartmentService.getPublicList();
    return c.json(data);
  } catch (error) {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// 4. API CHI TIẾT CĂN HỘ PUBLIC (Trang xem căn hộ chi tiết của khách)
apartmentApp.get('/public-detail', async (c) => {
  try {
    const projectSlug = c.req.query('project');
    const apartmentSlug = c.req.query('slug');

    if (!projectSlug || !apartmentSlug) {
      return c.json({ success: false, message: 'Thiếu thông tin tra cứu' }, 400);
    }

    const data = await ApartmentService.getPublicDetail(projectSlug, apartmentSlug);
    if (!data) return c.json({ success: false, message: 'Không tìm thấy căn hộ' }, 404);

    return c.json(data);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 5. API DANH SÁCH CĂN HỘ TƯƠNG TỰ
apartmentApp.get('/similar', async (c) => {
  try {
    const projectId = Number(c.req.query('projectId'));
    const excludeId = Number(c.req.query('excludeId'));
    const data = await ApartmentService.getSimilarApartments(projectId, excludeId);
    return c.json(data);
  } catch (error) {
    return c.json([], 500);
  }
});

// 6. API THÊM CĂN HỘ MỚI (Xử lý thông qua Service kèm chuỗi xác thực quyền)
apartmentApp.post('/add', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const body = await c.req.parseBody({ all: true });
    
    const result = await ApartmentService.createApartment(body, { id: payload.id, role: payload.role });
    return c.json(result, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

// 7. API DUYỆT TIN ĐĂNG NHANH
apartmentApp.post('/:id/approve', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const { status } = await c.req.json();

    const result = await ApartmentService.approveApartment(id, status, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 8. API SỬA/CẬP NHẬT CĂN HỘ
apartmentApp.put('/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const body = await c.req.parseBody();

    const result = await ApartmentService.updateApartment(id, body, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 9. API XÓA CĂN HỘ
apartmentApp.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');

    const result = await ApartmentService.deleteApartment(id, payload.id);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

apartmentApp.get('/:id/price-range-m2', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const stats = await ApartmentService.getPricePerMeterStats(id);
    return c.json(stats, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});


apartmentApp.get('/by-project', async (c) => {
  try {
    // Lấy query dạng: /api/apartments/by-project?slug=bcons-center-city
    const projectSlug = c.req.query('slug');
    
    if (!projectSlug) {
      return c.json({ success: false, message: "Thiếu tham số slug dự án trên đường dẫn" }, 400);
    }

    // Thực hiện lệnh gọi Service an toàn
    const result = await ApartmentService.getApartmentsByProjectSlug(projectSlug);
    
    // Trả về kết quả 200 thông mạng
    return c.json(result, 200);

  } catch (error: any) {
    console.error("❌ Sập luồng Endpoint /by-project:", error);
    return c.json({ success: false, message: error.message || "Lỗi kết nối nội bộ Server" }, 500);
  }
});

export default apartmentApp;