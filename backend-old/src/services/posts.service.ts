// backend/src/services/posts.service.ts
import { db } from '../db';
// 🔥 ĐỒNG BỘ: Import thêm bảng users từ schema để làm phép JOIN lấy fullname người đăng
import { posts as postsTable, activityLogs, users as usersTable } from '../db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import fs from 'fs-extra';
import path from 'path';

export class PostService {
  // 1. LẤY DANH SÁCH CHO ADMIN
  static async getAdminList() {
    return await db.select().from(postsTable).orderBy(desc(postsTable.id));
  }

  // 2. LẤY TIN TỨC PUBLIC CHO FRONTEND TRANG CHỦ (Đã sửa limit mặc định lên 100 để Front-end tự phân trang)
  static async getPublicList(category: string | undefined, limit: number = 100) {
    const filters = [eq(postsTable.status, 'published')];

    if (category && category !== 'all' && category !== 'undefined') {
      filters.push(eq(postsTable.category, category));
    }

    return await db
      .select()
      .from(postsTable)
      .where(and(...filters))
      .orderBy(desc(postsTable.createdAt))
      .limit(limit);
  }

  // 3. LẤY CHI TIẾT 1 BÀI VIẾT (Đổ data vào form Sửa qua ID)
  static async getPostById(id: number) {
    const data = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    return data[0] || null;
  }

  // 🔥 4. LẤY CHI TIẾT QUA SLUG + LEFT JOIN BẢNG USERS ĐỂ LẤY FULLNAME NGƯỜI ĐĂNG
  static async getPostBySlug(slug: string) {
    const data = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        slug: postsTable.slug,
        summary: postsTable.summary,
        content: postsTable.content,
        thumbnail: postsTable.thumbnail,
        category: postsTable.category,
        status: postsTable.status,
        views: postsTable.views,
        createdAt: postsTable.createdAt,
        // Bốc trường fullname từ bảng users liên kết sang
        authorName: usersTable.fullname 
      })
      .from(postsTable)
      // Liên kết chuẩn xác qua cột authorId (Khớp với cột author_id dưới DB của bạn)
      // 💡 Mẹo nhỏ: Nếu file schema.ts của bạn định nghĩa dạng snake_case thì bạn đổi .authorId thành .author_id nhé
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id)) 
      .where(and(eq(postsTable.slug, slug), eq(postsTable.status, 'published')))
      .limit(1);
    
    // Ép kiểu sang any để tùy biến gán thêm thuộc tính mà không bị TypeScript chặn
    const post = data[0] ? (data[0] as any) : null;

    if (post) {
      // Tự động tăng 1 lượt xem atomically dưới database khi click vào xem bài viết
      await db
        .update(postsTable)
        .set({
          views: sql`${postsTable.views} + 1`
        })
        .where(eq(postsTable.id, post.id));
      
      // Đồng bộ bộ đếm cục bộ trả về lập tức cho Front-end hiển thị số mới nhất
      post.views = (Number(post.views) || 0) + 1;

      // Thuật toán xử lý dữ liệu cũ: Bài mới có JOIN -> Hiện fullname. Bài cũ đang NULL -> Hiện mặc định "Trung Tín"
      post.author = post.authorName || "Trung Tín";
    }

    return post;
  }

  // 🔥 5. TẠO BÀI VIẾT MỚI KÈM XỬ LÝ UPLOAD ẢNH (Đã sửa từ userId thành authorId khớp khít DB)
  static async createPost(body: any, userId: number) {
    let thumbnailUrl = null;
    const thumbnailFile = body['image'] || body['thumbnail'];

    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      const fileName = `${Date.now()}-${thumbnailFile.name.replace(/\s+/g, '-')}`;
      const relativePath = `/uploads/posts/${fileName}`;
      const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'posts');
      await fs.ensureDir(absolutePath);
      
      const buffer = await thumbnailFile.arrayBuffer();
      await fs.writeFile(path.join(absolutePath, fileName), Buffer.from(buffer));
      thumbnailUrl = relativePath;
    }

    const title = String(body.title || "");

    await db.insert(postsTable).values({
      title: title,
      slug: String(body.slug || ""),
      summary: String(body.summary || ""),
      content: String(body.content || ""),
      thumbnail: thumbnailUrl,
      category: String(body.category || "news"),
      status: String(body.status || "published"),
      // Lưu đúng ID tài khoản admin/nhân viên đăng bài vào cột liên kết
      // 💡 Mẹo nhỏ: Nếu file schema.ts định nghĩa dạng snake_case thì đổi thành author_id: userId nhé
      authorId: userId, 
    });

    // Ghi log Audit trail hành vi nhân viên
    await db.insert(activityLogs).values({
      userId,
      action: "Đăng tin tức",
      target: title,
      description: `Xuất bản bài viết mới: ${body.category}`,
    });

    return { success: true, message: 'Tạo bài viết thành công!' };
  }

  // 6. CẬP NHẬT BÀI VIẾT (SỬA)
  static async updatePost(id: number, body: any, userId: number) {
    const oldPost = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (oldPost.length === 0) throw new Error('Không tìm thấy bài viết cần cập nhật');

    let dbThumbnail = oldPost[0].thumbnail;
    const thumbnailFile = body['image'] || body['thumbnail'];

    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      const fileName = `${Date.now()}-${thumbnailFile.name.replace(/\s+/g, '-')}`;
      const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'posts');
      await fs.ensureDir(absolutePath);
      
      const buffer = await thumbnailFile.arrayBuffer();
      await fs.writeFile(path.join(absolutePath, fileName), Buffer.from(buffer));
      dbThumbnail = `/uploads/posts/${fileName}`;
    }

    const newTitle = String(body.title);

    await db.update(postsTable).set({
      title: newTitle,
      summary: String(body.summary || ""),
      content: String(body.content || ""),
      category: String(body.category || ""),
      status: String(body.status || "published"),
      thumbnail: dbThumbnail,
    }).where(eq(postsTable.id, id));

    await db.insert(activityLogs).values({
      userId,
      action: "Cập nhật bài viết",
      target: newTitle,
      description: `Sửa bài viết ID: ${id}`,
    });

    return { success: true, message: "Cập nhật thành công!" };
  }

  // 7. XÓA BÀI VIẾT VÀ GỠ FILE ẢNH VẬT LÝ KHỎI Ổ ĐĨA
  static async deletePost(id: number, userId: number) {
    const postData = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (postData.length === 0) throw new Error('Bài viết không tồn tại hoặc đã bị xóa trước đó');

    if (postData[0].thumbnail) {
      const fullPath = path.join(process.cwd(), 'public', postData[0].thumbnail);
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
      }
    }

    await db.delete(postsTable).where(eq(postsTable.id, id));

    await db.insert(activityLogs).values({
      userId,
      action: "Xóa bài viết",
      target: postData[0].title || "N/A",
      description: `Đã xóa bài viết vĩnh viễn`,
    });

    return { success: true, message: 'Đã xóa bài viết thành công' };
  }
}