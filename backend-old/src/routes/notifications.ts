import { Hono } from 'hono';
import { db } from '../db';
import { activityLogs, users } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth';

const notifyApp = new Hono();

// 1. Lấy danh sách thông báo mới nhất (ví dụ 5 cái gần nhất)
notifyApp.get('/', authMiddleware, async (c) => {
  const list = await db.select({
    id: activityLogs.id,
    action: activityLogs.action,
    target: activityLogs.target,
    createdAt: activityLogs.createdAt,
    isRead: activityLogs.isRead, // Cần thêm cột này vào schema
    userName: users.fullname
  })
  .from(activityLogs)
  .leftJoin(users, eq(activityLogs.userId, users.id))
  .orderBy(desc(activityLogs.id))
  .limit(5);

  return c.json(list);
});

notifyApp.get('/unread-count', authMiddleware, async (c) => {
  try {
    // Đếm tất cả logs có isRead = 0
    const [result] = await db
      .select({ 
        count: sql<number>`count(*)` 
      })
      .from(activityLogs)
      .where(eq(activityLogs.isRead, 0)); 

    return c.json({ unreadCount: Number(result.count) || 0 });
  } catch (error) {
    return c.json({ unreadCount: 0 });
  }
});

// 2. Đánh dấu tất cả là đã đọc
notifyApp.post('/read-all', authMiddleware, async (c) => {
  await db.update(activityLogs).set({ isRead: 1 });
  return c.json({ success: true });
});

export default notifyApp;