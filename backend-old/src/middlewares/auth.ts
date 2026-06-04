import { jwt } from 'hono/jwt';

const JWT_SECRET = 'bcons2026'; // Nên để trong file .env

export const authMiddleware = jwt({
  secret: JWT_SECRET,
  alg: 'HS256', // <--- THÊM DÒNG NÀY ĐỂ HẾT LỖI
});