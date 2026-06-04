import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcript from 'bcrypt';
import { setCookie, deleteCookie } from 'hono/cookie'; // 1. Import thêm helper cookie

const auth = new Hono();
const JWT_SECRET = 'bcons2026';

auth.post('/init-admin', async (c) => {
  const hashedPassword = await bcript.hash('tintin', 10); // Mật khẩu mặc định
  await db.insert(users).values({
    fullname: 'Lê Bá Trung Tín',
    email: 'lebatrungtin92@gmail.com',
    password: hashedPassword,
    role: 'ADMIN',
  });
  return c.json({ message: 'Đã tạo tài khoản Admin!' });
});


auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const email = body.email?.trim();
    const password = body.password;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json({ message: 'Email không tồn tại' }, 401);
    }

    const isMatch = await bcript.compare(password, user.password);
    if (!isMatch) {
      return c.json({ message: 'Mật khẩu không chính xác' }, 401);
    }

    // 3. Tạo Token
    const token = await sign({
      id: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24h
    }, JWT_SECRET);

    // 4. THÊM DÒNG NÀY: Lưu token vào Cookie
    setCookie(c, 'auth_token', token, {
      path: '/',
      httpOnly: false, // Để FALSE để phía Frontend Astro có thể đọc được qua document.cookie
      secure: false,   // Để FALSE nếu bạn đang dùng http://localhost (không có https)
      maxAge: 60 * 60 * 24, // 24 giờ
      sameSite: 'Lax',
    });

    // 5. Trả về JSON
    return c.json({
      success: true,
      token, // Trả thêm ở body để đề phòng
      user: {
        id: user.id,
        name: user.fullname,
        role: user.role,
      }
    });

  } catch (error: any) {
    return c.json({ message: 'Lỗi server: ' + error.message }, 500);
  }
});

auth.post('/signout', (c) => {
  // Xóa cookie khi đăng xuất
  deleteCookie(c, 'auth_token'); 

  return c.json({ 
    success: true, 
    message: 'Đã đăng xuất thành công' 
  });
});

export default auth;