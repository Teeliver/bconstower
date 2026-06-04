// backend/src/services/project.service.ts
import { db } from '../db';
import { projects, activityLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import slugify from 'slugify';
import { saveUploadFile } from '../utils/upload';

export class ProjectService {
  // 1. LẤY DANH SÁCH DỰ ÁN (Phục vụ trang quản lý của Admin)
  static async getAllProjects() {
    return await db
      .select()
      .from(projects)
      .orderBy(desc(projects.id)); // Dự án mới tạo xếp lên đầu
  }

  // 2. LẤY CHI TIẾT DỰ ÁN THEO SLUG
  static async getProjectBySlug(slug: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    return project || null;
  }

  /**
   * 🔥 ĐÃ ĐỒNG BỘ TÊN HÀM: Bốc danh sách dự án nổi bật hiển thị ra trang chủ công cộng
   * @param limitNumber Số lượng dự án tối đa muốn lấy (ví dụ: 20)
   */
  static async getFeaturedProjects(limitNumber: number) {
    try {
      // Truy vấn Drizzle ORM lấy danh sách dự án, sắp xếp theo ID mới nhất
      const allProjects = await db
        .select({
          id: projects.id,
          title: projects.title,
          slug: projects.slug,
          image: projects.image,
          address: projects.address,
          status: projects.status
        })
        .from(projects)
        .orderBy(desc(projects.id))
        .limit(limitNumber);

      // 🎯 QUAN TRỌNG: Phải return mảng dữ liệu này về để tầng Route (Controller) hứng được
      return allProjects;

    } catch (error: any) {
      console.error("❌ Lỗi xử lý tại tầng ProjectService.getFeaturedProjects:", error);
      throw new Error(error.message || "Không thể truy vấn danh sách dự án nổi bật từ Database");
    }
  }

  // 3. THÊM DỰ ÁN MỚI (Đã gộp phần Lat, Lng của Trung Tín)
  static async createProject(body: any, userId: number | null) {
    const title = body.title as string;
    if (!title) throw new Error('Tiêu đề dự án không được để trống');

    const projectSlug = slugify(title, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g });
    const imageFile = body.image as File;
    const imageUrl = imageFile && imageFile.size > 0 ? await saveUploadFile(imageFile, 'projects', projectSlug) : null;

    await db.insert(projects).values({
      title: title,
      slug: projectSlug,
      address: body.address as string,
      image: imageUrl,
      status: body.status as any,
      legal: body.legal as any,
      lat: body.lat && String(body.lat).trim() !== '' ? String(body.lat) : null,
      lng: body.lng && String(body.lng).trim() !== '' ? String(body.lng) : null,
    });

    if (userId) {
      await db.insert(activityLogs).values({
        userId,
        action: "Thêm dự án mới",
        target: title,
        description: `Vừa tạo dự án "${title}" trên hệ thống kèm tọa độ vị trí.`,
      });
    }
    return { success: true, message: 'Thêm dự án thành công' };
  }

  // 4. SỬA/CẬP NHẬT DỰ ÁN (Đổ dữ liệu Lat, Lng cũ lên để cập nhật)
  static async updateProject(slug: string, body: any, userId: number | null) {
    // Tìm xem dự án cũ có tồn tại không
    const [existing] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!existing) throw new Error('Không tìm thấy dự án cần cập nhật');

    const title = body.title as string || existing.title;
    const newSlug = body.title ? slugify(title, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g }) : existing.slug;
    
    // Xử lý nếu có upload ảnh mới, không thì giữ ảnh cũ
    const imageFile = body.image as File;
    let imageUrl = existing.image;
    if (imageFile && imageFile.size > 0) {
      imageUrl = await saveUploadFile(imageFile, 'projects', newSlug);
    }

    await db.update(projects)
      .set({
        title,
        slug: newSlug,
        address: body.address as string ?? existing.address,
        image: imageUrl,
        status: body.status as any ?? existing.status,
        legal: body.legal as any ?? existing.legal,
        lat: body.lat && String(body.lat).trim() !== '' ? String(body.lat) : null,
        lng: body.lng && String(body.lng).trim() !== '' ? String(body.lng) : null,
      })
      .where(eq(projects.slug, slug));

    if (userId) {
      await db.insert(activityLogs).values({
        userId,
        action: "Cập nhật dự án",
        target: title,
        description: `Đã chỉnh sửa thông tin dự án "${title}"`,
      });
    }
    return { success: true, message: 'Cập nhật dự án thành công' };
  }

  // 5. XOÁ DỰ ÁN
  static async deleteProject(slug: string, userId: number | null) {
    const [existing] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!existing) throw new Error('Không tìm thấy dự án cần xoá');

    await db.delete(projects).where(eq(projects.slug, slug));

    if (userId) {
      await db.insert(activityLogs).values({
        userId,
        action: "Xoá dự án",
        target: existing.title,
        description: `Đã xoá dự án "${existing.title}" khỏi hệ thống`,
      });
    }
    return { success: true, message: 'Xoá dự án thành công' };
  }
}