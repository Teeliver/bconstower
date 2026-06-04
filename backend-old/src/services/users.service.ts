// backend/src/services/users.service.ts
import { db } from '../db';
import { users as usersTable, brokerProfiles, activityLogs } from '../db/schema';
import { eq, or, and } from 'drizzle-orm';
import fs from 'fs-extra';
import path from 'path';
import bcrypt from 'bcryptjs';

export class UserService {
  // 1. LẤY TOÀN BỘ DANH SÁCH USER (CƠ BẢN)
  static async getAllUsers() {
    return await db
      .select({
        id: usersTable.id,
        fullname: usersTable.fullname,
        email: usersTable.email,
        role: usersTable.role,
        avatar: usersTable.avatar,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
  }

  // 2. LẤY DANH SÁCH CHI TIẾT KÈM PROFILE MÔI GIỚI (CHO ADMIN)
  static async getAdminList() {
    return await db
      .select({
        id: usersTable.id,
        fullname: usersTable.fullname,
        email: usersTable.email,
        role: usersTable.role,
        avatar: usersTable.avatar,
        createdAt: usersTable.createdAt,
        brokerInfo: {
          licenseNumber: brokerProfiles.licenseNumber,
          companyName: brokerProfiles.companyName,
          experienceYears: brokerProfiles.experienceYears,
          areaFocus: brokerProfiles.areaFocus,
          bio: brokerProfiles.bio,
          verified: brokerProfiles.verified,
        }
      })
      .from(usersTable)
      .leftJoin(brokerProfiles, eq(usersTable.id, brokerProfiles.userId))
      .orderBy(usersTable.createdAt);
  }

  // 3. LẤY CHI TIẾT 1 THÀNH VIÊN THEO ID (ĐỔ FORM SỬA)
  static async getUserById(id: number) {
    const data = await db
      .select()
      .from(usersTable)
      .leftJoin(brokerProfiles, eq(usersTable.id, brokerProfiles.userId))
      .where(eq(usersTable.id, id))
      .limit(1);

    if (data.length === 0) return null;

    // Giữ nguyên logic ánh xạ object động cũ của bạn để Frontend load mượt mà
    const userData = data[0].users;
    const profileData = data[0].broker_profiles || (data[0] as any).brokerProfiles;
    return { ...userData, brokerProfiles: profileData };
  }

  // 4. TẠO TÀI KHOẢN MỚI CHO THÀNH VIÊN HOẶC QUẢN TRỊ VIÊN
  static async createAdminUser(body: any, executorId: number) {
    const { 
      email, password, fullname, role, phone, address, 
      companyName, licenseNumber, areaFocus, experienceYears, bio, verified 
    } = body;

    // Kiểm tra trùng lặp Email hoặc Số điện thoại trong hệ thống Bcons
    const existingUser = await db.select()
      .from(usersTable)
      .where(or(eq(usersTable.email, String(email)), phone ? eq(usersTable.phone, String(phone)) : undefined))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Email hoặc Số điện thoại đã tồn tại trên hệ thống.');
    }

    // Mã hóa mật khẩu bảo mật bằng bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    // Lưu thông tin người dùng cơ bản
    const [result] = await db.insert(usersTable).values({
      fullname: String(fullname),
      email: String(email),
      password: hashedPassword, 
      role: String(role || "USER"),
      phone: phone ? String(phone) : null,
      address: address ? String(address) : null,
      createdAt: new Date(),
    });

    const newUserId = (result as any).insertId;

    // Nếu phân quyền là Admin hoặc Môi giới, tiến hành khởi tạo bảng Profile bổ trợ
    if (newUserId && (role === 'BROKER' || role === 'ADMIN')) {
      await db.insert(brokerProfiles).values({
        userId: newUserId,
        companyName: companyName ? String(companyName) : null,
        licenseNumber: licenseNumber ? String(licenseNumber) : null,
        areaFocus: areaFocus ? String(areaFocus) : null,
        experienceYears: experienceYears ? Number(experienceYears) : 0,
        bio: bio ? String(bio) : null,
        verified: verified === '1' ? 1 : 0,
      });
    }

    // Ghi nhận lịch sử thao tác hệ thống công ty
    await db.insert(activityLogs).values({
      userId: executorId,
      action: "Tạo tài khoản",
      target: String(fullname),
      description: `Đã tạo tài khoản mới với vai trò: ${role}`,
    });

    return { success: true, message: 'Tạo tài khoản người dùng thành công!' };
  }

  // 5. CẬP NHẬT THÔNG TIN HỒ SƠ THÀNH VIÊN (KÈM TRANSACTION AN TOÀN)
  static async updateUserProfile(id: number, body: any, executorId: number) {
    const role = String(body.role || "USER");
    const fullname = String(body.fullname || "");
    let avatarPath = body.currentAvatar as string;
    const avatarFile = body['avatar'] as File;

    // Xử lý upload tập tin hình ảnh đại diện cá nhân mới nếu có thay đổi
    if (avatarFile && avatarFile.size > 0 && avatarFile.name) {
      const relativePath = `/uploads/avatars`;
      const absolutePath = path.join(process.cwd(), 'public', relativePath);
      await fs.ensureDir(absolutePath);
      const fileName = `${Date.now()}-${avatarFile.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(absolutePath, fileName);
      
      const buffer = await avatarFile.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));
      avatarPath = `${relativePath}/${fileName}`;
    }

    // Thực hiện khối Transaction bao bọc cập nhật đồng thời 2 bảng liên quan
    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({
        fullname: fullname,
        phone: String(body.phone || ""),
        address: String(body.address || ""),
        role: role,
        avatar: avatarPath
      }).where(eq(usersTable.id, id));

      if (role === 'BROKER' || role === 'ADMIN') {
        const checkProfile = await tx.select().from(brokerProfiles).where(eq(brokerProfiles.userId, id)).limit(1);
        const profileData = {
          licenseNumber: String(body.licenseNumber || ""),
          companyName: String(body.companyName || ""),
          areaFocus: String(body.areaFocus || ""),
          experienceYears: body.experienceYears ? Number(body.experienceYears) : 0,
          bio: String(body.bio || ""),
          verified: (body.verified === '1' || body.verified === 'true') ? 1 : 0
        };
        
        if (checkProfile.length > 0) {
          await tx.update(brokerProfiles).set(profileData).where(eq(brokerProfiles.userId, id));
        } else {
          await tx.insert(brokerProfiles).values({ userId: id, ...profileData });
        }
      }
    });

    // Ghi nhận vết Audit log chỉnh sửa hồ sơ nhân viên
    await db.insert(activityLogs).values({
      userId: executorId,
      action: "Cập nhật thành viên",
      target: fullname,
      description: `Thay đổi thông tin hồ sơ của ID: ${id}`,
    });

    return { success: true, message: "Cập nhật thành công!" };
  }

  // 6. XÁC MINH NHANH DANH TÍNH MÔI GIỚI KINH DOANH
  static async verifyBrokerStatus(id: number, status: boolean, executorId: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) throw new Error("Thành viên không tồn tại trên hệ thống");

    await db.update(brokerProfiles)
      .set({ verified: status ? 1 : 0 })
      .where(eq(brokerProfiles.userId, id));

    await db.insert(activityLogs).values({
      userId: executorId,
      action: "Xác minh môi giới",
      target: user.fullname || `ID: ${id}`,
      description: status ? "Đã phê duyệt xác minh" : "Đã hủy xác minh",
    });

    return { success: true, message: 'Trạng thái xác minh đã cập nhật' };
  }

  // 7. XÓA TÀI KHOẢN VÀ DỌN SẠCH TẬP TIN ẢNH ĐẠI DIỆN VẬT LÝ KHỎI Ổ ĐĨA
  static async deleteUserAccount(id: number, executorId: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) throw new Error('Tài khoản thành viên không tồn tại hoặc đã bị gỡ bỏ trước đó');

    // Quét dọn file ảnh đại diện cũ trên phân vùng đĩa Server tránh rác ổ cứng
    if (user.avatar && !user.avatar.startsWith('http')) {
      const fullPath = path.join(process.cwd(), 'public', user.avatar);
      if (await fs.pathExists(fullPath)) await fs.remove(fullPath);
    }

    // Xóa liên hoàn dữ liệu bảng profile phụ trước rồi gỡ tài khoản chính sau
    await db.delete(brokerProfiles).where(eq(brokerProfiles.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));

    await db.insert(activityLogs).values({
      userId: executorId,
      action: "Xóa tài khoản",
      target: user.fullname,
      description: `Đã xóa vĩnh viễn người dùng khỏi hệ thống`,
    });

    return { success: true, message: 'Đã xóa người dùng thành công' };
  }
}