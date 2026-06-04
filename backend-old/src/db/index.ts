import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './schema';

// Thông số này lấy từ trang quản lý Hosting của bạn
const connection = mysql.createPool({
  host: '14.225.231.70', // Hoặc IP của hosting
  user: 'bconstow_saoviet',
  password: 'Betee92@',
  database: 'bconstow_saoviet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const db = drizzle(connection, { schema, mode: 'default' });