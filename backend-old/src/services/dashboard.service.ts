// backend/src/services/dashboard.service.ts
import { db } from '../db';
import { apartments as apartmentsTable, activityLogs, users, projects } from '../db/schema';
import { eq, desc, count, and, or, gte, sum } from 'drizzle-orm';

export class DashboardService {
  /**
   * Tổng hợp toàn bộ số liệu thống kê cho trang Dashboard Admin
   * @param page Trang hiện tại của nhật ký hoạt động
   * @param limit Số lượng dòng nhật ký trên một trang
   */
  static async getAdminStats(page: number = 1, limit: number = 10) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    // 1. Thống kê Card cơ bản (Đang bán, Đã bán, Doanh thu tháng/năm)
    const [selling] = await db.select({ value: count() }).from(apartmentsTable)
      .where(and(eq(apartmentsTable.approvalStatus, 'approved'), eq(apartmentsTable.status, 'trong')));

    const [sold] = await db.select({ value: count() }).from(apartmentsTable)
      .where(or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')));

    const [monthlyRev] = await db.select({ total: sum(apartmentsTable.price) }).from(apartmentsTable)
      .where(and(
        or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')),
        gte(apartmentsTable.createdAt, firstDayOfMonth)
      ));

    const [yearlyRev] = await db.select({ total: sum(apartmentsTable.price) }).from(apartmentsTable)
      .where(and(
        or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')),
        gte(apartmentsTable.createdAt, firstDayOfYear)
      ));

    // 2. HIỆU SUẤT DỰ ÁN: Báo cáo tỷ lệ bán chạy của các dự án Bcons
    const projectStats = await db
      .select({
        name: projects.title,
        value: count(apartmentsTable.id),
      })
      .from(apartmentsTable)
      .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
      .where(or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')))
      .groupBy(projects.title)
      .orderBy(desc(count(apartmentsTable.id)));

    // 3. CHIẾN THẦN NHÂN VIÊN: Xếp hạng doanh số của phòng kinh doanh Bcons
    const topSellers = await db
      .select({
        staffName: users.fullname,
        totalDeals: count(apartmentsTable.id),
        totalRevenue: sum(apartmentsTable.price),
      })
      .from(apartmentsTable)
      .leftJoin(users, eq(apartmentsTable.userId, users.id))
      .where(or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')))
      .groupBy(users.fullname)
      .orderBy(desc(count(apartmentsTable.id)))
      .limit(5);

    // 4. XỬ LÝ BIỂU ĐỒ XU HƯỚNG DOANH THU (6 tháng gần nhất)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const recentApartments = await db.select().from(apartmentsTable)
      .where(and(or(eq(apartmentsTable.status, 'da_coc'), eq(apartmentsTable.status, 'da_ban')), gte(apartmentsTable.createdAt, sixMonthsAgo)));

    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
      monthlyMap[label] = 0;
    }

    recentApartments.forEach(a => {
      const d = new Date(a.createdAt as any);
      const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
      if (monthlyMap[label] !== undefined) {
        monthlyMap[label] += Number(a.price || 0);
      }
    });

    const chartData = Object.keys(monthlyMap).map(key => ({
      month: key,
      revenue: monthlyMap[key]
    }));

    // 5. NHẬT KÝ HOẠT ĐỘNG PHÂN TRANG (Hệ thống Audit trail hành vi nhân viên)
    const offset = (page - 1) * limit;
    const [totalLogs] = await db.select({ value: count() }).from(activityLogs);

    const logs = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        target: activityLogs.target,
        createdAt: activityLogs.createdAt,
        userName: users.fullname,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.id))
      .limit(limit)
      .offset(offset);

    // Trả về chuẩn cấu trúc Object cũ để Frontend không lỗi kết xuất
    return {
      totalSelling: Number(selling.value) || 0,
      totalSold: Number(sold.value) || 0,
      monthlyRevenue: Number(monthlyRev.total) || 0,
      yearlyRevenue: Number(yearlyRev.total) || 0,
      chartData,
      projectStats,
      topSellers,
      history: logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(Number(totalLogs.value) / limit)
      }
    };
  }
}