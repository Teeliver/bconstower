// backend/src/services/apartments.service.ts
import { db } from '../db';
import { apartments as apartmentsTable, projects, users, activityLogs, brokerProfiles } from '../db/schema';
import { eq, desc, and, ne, sql, like } from 'drizzle-orm';
import fs from 'fs-extra';
import path from 'path';

export class ApartmentService {
  // 1. LẤY CHI TIẾT CĂN THEO ID (Phục vụ đổ dữ liệu form Sửa)
  static async getApartmentById(id: number) {
    const data = await db.select().from(apartmentsTable).where(eq(apartmentsTable.id, id)).limit(1);
    return data[0] || null;
  }

  // 2. LẤY DANH SÁCH CHO ADMIN (Phân trang)
  static async getAdminList(page: number, limit: number = 10) {
    const offset = (page - 1) * limit;
    return await db
      .select({
        id: apartmentsTable.id,
        name: apartmentsTable.name,
        price: apartmentsTable.price,
        area: apartmentsTable.area,
        image: apartmentsTable.image,
        slug: apartmentsTable.slug,
        approvalStatus: apartmentsTable.approvalStatus,
        status: apartmentsTable.status,
        directionMain: apartmentsTable.directionMain,
        directionBalcony: apartmentsTable.directionBalcony,
        block: apartmentsTable.block,
        floor: apartmentsTable.floor,
        bedrooms: apartmentsTable.bedrooms,
        bathrooms: apartmentsTable.bathrooms,
        projectId: apartmentsTable.projectId,
        projectName: projects.title, 
        createdBy: users.fullname,
        createdAt: apartmentsTable.createdAt,
      })
      .from(apartmentsTable)
      .leftJoin(users, eq(apartmentsTable.userId, users.id))
      .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
      .orderBy(desc(apartmentsTable.id))
      .limit(limit)
      .offset(offset);
  }

  // 3. LẤY DANH SÁCH PUBLIC (Hiện trang chủ Frontend)
  static async getPublicList(limit: number = 9) {
    return await db
      .select({
        id: apartmentsTable.id,
        name: apartmentsTable.name,
        price: apartmentsTable.price,
        area: apartmentsTable.area,
        image: apartmentsTable.image,
        slug: apartmentsTable.slug,
        bedrooms: apartmentsTable.bedrooms,
        bathrooms: apartmentsTable.bathrooms,
        projectName: projects.title,
        projectSlug: projects.slug,
        address: projects.address,
        createdAt: apartmentsTable.createdAt,
      })
      .from(apartmentsTable)
      .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
      .where(eq(apartmentsTable.approvalStatus, 'approved'))
      .orderBy(desc(apartmentsTable.id))
      .limit(limit);
  }

  // 4. LẤY CHI TIẾT PUBLIC (Kèm Profile Nhân viên & Thông tin dự án Bcons)
  static async getPublicDetail(projectSlug: string, apartmentSlug: string) {
    const data = await db
      .select({
        id: apartmentsTable.id,
        projectId: apartmentsTable.projectId,
        name: apartmentsTable.name,
        slug: apartmentsTable.slug,
        price: apartmentsTable.price,
        area: apartmentsTable.area,
        floor: apartmentsTable.floor,
        block: apartmentsTable.block,
        image: apartmentsTable.image,
        description: apartmentsTable.description,
        bedrooms: apartmentsTable.bedrooms,
        bathrooms: apartmentsTable.bathrooms,
        direction_main: apartmentsTable.directionMain,
        direction_balcony: apartmentsTable.directionBalcony,
        furniture: apartmentsTable.furniture,
        projectAddress: projects.address,
        projectName: projects.title,
        projectSlug: projects.slug,
        projectStatus: projects.status,
        projectLegal: projects.legal,
        user_name: users.fullname,     
        user_phone: users.phone,   
        user_avatar: users.avatar, 
        companyName: brokerProfiles.companyName,
        licenseNumber: brokerProfiles.licenseNumber,
        areaFocus: brokerProfiles.areaFocus,
        experienceYears: brokerProfiles.experienceYears,
        verified: brokerProfiles.verified,
        bio: brokerProfiles.bio,
        lat: projects.lat, 
        lng: projects.lng,
      })
      .from(apartmentsTable)
      .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
      .leftJoin(users, eq(apartmentsTable.userId, users.id))
      .leftJoin(brokerProfiles, eq(users.id, brokerProfiles.userId))
      .where(
        and(
          eq(projects.slug, projectSlug),
          eq(apartmentsTable.slug, apartmentSlug)
        )
      )
      .limit(1);

    return data[0] || null;
  }

  // 5. LẤY CĂN HỘ TƯƠNG TỰ TRONG CÙNG DỰ ÁN
  static async getSimilarApartments(projectId: number, excludeId: number, limit: number = 4) {
    if (!projectId) return [];
    return await db
      .select({
        id: apartmentsTable.id,
        name: apartmentsTable.name,
        slug: apartmentsTable.slug,
        price: apartmentsTable.price,
        area: apartmentsTable.area,
        image: apartmentsTable.image,
        bedrooms: apartmentsTable.bedrooms,
        bathrooms: apartmentsTable.bathrooms, 
        projectId: apartmentsTable.projectId, 
        projectName: projects.title,
        projectSlug: projects.slug,
        projectAddress: projects.address,
        user_name: users.fullname,     
        user_phone: users.phone,   
        user_avatar: users.avatar, 
      })
      .from(apartmentsTable)
      .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
      .leftJoin(users, eq(apartmentsTable.userId, users.id))
      .where(
        and(
          eq(apartmentsTable.projectId, projectId), 
          ne(apartmentsTable.id, excludeId)         
        )
      )
      .orderBy(desc(apartmentsTable.id)) 
      .limit(limit);
  }

  // 6. THÊM CĂN HỘ MỚI (Xử lý upload mảng nhiều ảnh)
  static async createApartment(body: any, user: { id: number; role: string }) {
    const apartmentName = String(body.name || "").trim();
    const projectId = Number(body.projectId);

    if (!projectId || !apartmentName || !body.price) {
      throw new Error("Thiếu thông tin bắt buộc.");
    }

    // Kiểm tra trùng tên căn hộ trong cùng một dự án Bcons
    const [existingApartment] = await db.select()
      .from(apartmentsTable)
      .where(and(eq(apartmentsTable.name, apartmentName), eq(apartmentsTable.projectId, projectId)))
      .limit(1);

    if (existingApartment) {
      throw new Error(`Căn hộ "${apartmentName}" đã tồn tại trong dự án này. Vui lòng kiểm tra lại!`);
    }

    // Xử lý logic băm nhỏ mảng ảnh lưu vào ổ đĩa cứng Server
    const folderName = String(body.slug || body.name).replace(/[^a-zA-Z0-9-]/g, '').toLowerCase(); 
    const relativePath = `/uploads/apartments/${folderName}`;
    const absolutePath = path.join(process.cwd(), 'public', relativePath);
    await fs.ensureDir(absolutePath);

    const imageFiles = body['images'];
    let filesArray: File[] = [];
    if (imageFiles) {
      if (Array.isArray(imageFiles)) filesArray = imageFiles.filter(f => f instanceof File) as File[];
      else if (imageFiles instanceof File) filesArray = [imageFiles];
    }

    const savedPaths: string[] = [];
    for (const file of filesArray) {
      if (file.size > 0) {
        const uniqueSuffix = Math.floor(Math.random() * 100000);
        const fileName = `${Date.now()}-${uniqueSuffix}-${file.name.replace(/\s+/g, '-')}`;
        await fs.writeFile(path.join(absolutePath, fileName), Buffer.from(await file.arrayBuffer()));
        savedPaths.push(`${relativePath}/${fileName}`);
      }
    }

    // Ghi Database thông tin căn hộ mới qua Drizzle
    await db.insert(apartmentsTable).values({
      projectId: projectId,
      userId: user.id,
      name: apartmentName,
      slug: String(body.slug).trim(),
      block: body.block ? String(body.block) : null,
      floor: body.floor ? Number(body.floor) : null,
      area: String(body.area || "0"),
      bedrooms: Number(body.bedrooms || 0),
      bathrooms: Number(body.bathrooms || 0),
      directionMain: String(body.directionMain || ""),
      directionBalcony: String(body.directionBalcony || ""),
      furniture: String(body.furniture || ""),
      description: String(body.description || ""),
      price: Number(body.price),
      approvalStatus: (body.approvalStatus as 'pending' | 'approved' | 'rejected') || 'pending',
      image: JSON.stringify(savedPaths),
      folderPath: folderName,
    } as any);

    // Ghi Log hoạt động đăng tin
    await db.insert(activityLogs).values({
      userId: user.id,
      action: "Đăng tin",
      target: apartmentName,
      description: `Vừa đăng tin căn hộ mới: ${apartmentName}`,
    });

    return { success: true, message: "Đăng tin thành công!" };
  }

  // 7. DUYỆT NHANH TIN ĐĂNG CĂN HỘ
  static async approveApartment(id: number, status: 'pending' | 'approved' | 'rejected', userId: number) {
    const [oldData] = await db.select().from(apartmentsTable).where(eq(apartmentsTable.id, id)).limit(1);
    if (!oldData) throw new Error("Không tìm thấy căn hộ cần duyệt");

    // Ép kiểu trực tiếp ở đây để Drizzle MySQL Core thông qua hoàn toàn
    await db.update(apartmentsTable)
      .set({ 
        approvalStatus: status as 'pending' | 'approved' | 'rejected' 
      })
      .where(eq(apartmentsTable.id, id));

    await db.insert(activityLogs).values({
      userId,
      action: status === 'approved' ? "Duyệt tin" : "Từ chối",
      target: oldData.name || `ID: ${id}`,
      description: `Trạng thái duyệt: ${status}`,
    });

    return { success: true, message: 'Cập nhật trạng thái duyệt thành công' };
  }

  // 8. CẬP NHẬT THÔNG TIN CĂN HỘ (SỬA)
  static async updateApartment(id: number, body: any, userId: number) {
    const [oldData] = await db.select().from(apartmentsTable).where(eq(apartmentsTable.id, id)).limit(1);
    if (!oldData) throw new Error("Không tìm thấy dữ liệu căn hộ cần chỉnh sửa");

    await db.update(apartmentsTable).set({
      name: String(body.name),
      slug: String(body.slug),
      projectId: Number(body.projectId),
      price: Number(body.price),
      area: String(body.area),
      directionMain: String(body.directionMain),
      directionBalcony: String(body.directionBalcony),
      furniture: String(body.furniture),
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      description: String(body.description || ""),
      block: body.block ? String(body.block) : null,
      floor: body.floor ? Number(body.floor) : null,
      approvalStatus: (body.approvalStatus || 'pending') as 'pending' | 'approved' | 'rejected',
      status: (body.status as any) || 'trong',
    }).where(eq(apartmentsTable.id, id));

    await db.insert(activityLogs).values({
      userId,
      action: "Cập nhật",
      target: String(body.name || oldData.name),
      description: `Trạng thái: ${body.status}, Duyệt: ${body.approvalStatus}`,
    });

    return { success: true, message: "Cập nhật căn hộ thành công!" };
  }

  // 9. XÓA CĂN HỘ KHỎI HỆ THỐNG
  static async deleteApartment(id: number, userId: number) {
    const [oldData] = await db.select().from(apartmentsTable).where(eq(apartmentsTable.id, id)).limit(1);
    if (!oldData) throw new Error("Căn hộ không tồn tại hoặc đã bị xóa trước đó");

    await db.delete(apartmentsTable).where(eq(apartmentsTable.id, id));

    await db.insert(activityLogs).values({
      userId,
      action: "Xóa căn hộ",
      target: oldData.name || `ID: ${id}`,
      description: `Đã gỡ căn hộ khỏi hệ thống`,
    });

    return { success: true, message: 'Xóa căn hộ thành công' };
  }

  static async getApartmentsByProjectSlug(projectSlug: string) {
    try {
      // 1. Tìm thông tin chi tiết của dự án dựa trên slug truyền vào
      const [projectInfo] = await db
        .select()
        .from(projects)
        .where(eq(projects.slug, projectSlug))
        .limit(1);

      // Nếu không tìm thấy dự án, trả về mảng rỗng an toàn cho Front-end đọc, không quăng lỗi sập mạng
      if (!projectInfo) {
        return { apartments: [], projectInfo: null };
      }

      // 2. Tìm tất cả căn hộ thuộc dự án này, đẩy căn hộ mới ký gửi lên đầu
      const apartments = await db
        .select()
        .from(apartmentsTable)
        .where(eq(apartmentsTable.projectId, projectInfo.id))
        .orderBy(desc(apartmentsTable.id));

      // Trả về object sạch sẽ dữ liệu thực tế
      return { apartments, projectInfo };

    } catch (error: any) {
      console.error("❌ Lỗi truy vấn Database tại ApartmentService:", error);
      throw new Error(error.message || "Lỗi xử lý giỏ hàng căn hộ tại tầng nghiệp vụ");
    }
  }

  /**
   * 🎯 TÍNH TOÁN KHOẢNG GIÁ PHỔ BIẾN THEO MỖI M2 (TR/M2)
   * @param apartmentId ID của căn hộ khách đang xem
   */
  static async getPricePerMeterStats(apartmentId: number) {
    try {
      // 1. TRUY VẤN CHI TIẾT CĂN HỘ HIỆN TẠI (Lấy giá, diện tích, block, hướng ban công, nội thất)
      const [currentApartment] = await db
        .select({
          id: apartmentsTable.id,
          price: apartmentsTable.price,
          area: apartmentsTable.area,
          bedrooms: apartmentsTable.bedrooms,
          bathrooms: apartmentsTable.bathrooms,
          furniture: apartmentsTable.furniture,
          direction_balcony: apartmentsTable.directionBalcony,
          projectId: apartmentsTable.projectId,
          projectAddress: projects.address
        })
        .from(apartmentsTable)
        .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
        .where(eq(apartmentsTable.id, apartmentId))
        .limit(1);

      if (!currentApartment) {
        throw new Error("Không tìm thấy căn hộ yêu cầu trên hệ thống");
      }

      const currentPrice = Number(currentApartment.price);
      // TỐI ƯU: Quét sạch ký tự chữ như "m2" dính trong trường văn bản để ép kiểu số chuẩn xác
      const currentArea = parseFloat(String(currentApartment.area).replace(/[^0-9.]/g, '')) || 0;
      
      if (!currentPrice || !currentArea) {
        throw new Error("Dữ liệu giá bán hoặc diện tích của căn hộ hiện tại không hợp lệ");
      }
      
      // Tính đơn giá tr/m2 thực tế của căn hộ hiện tại (Lấy đến 2 chữ số thập phân)
      const currentPricePerMeter = parseFloat(((currentPrice / currentArea) / 1000000).toFixed(2));

      // 2. PHÂN TÍCH ĐỊA LÝ ĐỂ GOM KHU VỰC THỊ TRƯỜNG (Quét chuỗi tìm 19 dự án Bcons lân cận)
      const addressStr = currentApartment.projectAddress || "";
      let districtKeyword = "Dĩ An";
      if (addressStr.includes("Thuận An")) districtKeyword = "Thuận An";
      if (addressStr.includes("Thủ Đức") || addressStr.includes("Quận 9")) districtKeyword = "Thủ Đức";

      // 3. TRUY VẤN TOÀN BỘ GIỎ HÀNG THỰC TẾ TRONG KHU VỰC ĐỂ TÍNH BIÊN ĐỘ GIÁ ĐỘNG
      const allApartmentsInArea = await db
        .select({
          price: apartmentsTable.price,
          area: apartmentsTable.area
        })
        .from(apartmentsTable)
        .leftJoin(projects, eq(apartmentsTable.projectId, projects.id))
        .where(
          and(
            like(projects.address, `%${districtKeyword}%`)
          )
        );

      // 4. CHẠY VÒNG LẶP QUY ĐỔI GIÁ/M2 REAL-TIME KHÔNG LO DÍNH LỖI NULL TRÊN SERVER
      const listPricesPerMeter: number[] = [];

      allApartmentsInArea.forEach(apt => {
        const p = Number(apt.price);
        const a = parseFloat(String(apt.area).replace(/[^0-9.]/g, '')) || 0;
        if (p > 0 && a > 0) {
          const m2Price = Math.round((p / a) / 1000000);
          listPricesPerMeter.push(m2Price);
        }
      });

      // Thiết lập khoảng giá an toàn (vùng phổ biến) mặc định ăn theo căn hộ hiện tại nếu DB khu vực trống
      let minPricePerMeter = currentPricePerMeter - 4;
      let maxPricePerMeter = currentPricePerMeter + 4;

      if (listPricesPerMeter.length > 0) {
        const realMin = Math.min(...listPricesPerMeter);
        const realMax = Math.max(...listPricesPerMeter);
        
        // Gán mốc thực tế bốc từ Database lên nếu khoảng giá hợp lệ
        if (realMax > realMin) {
          minPricePerMeter = realMin;
          maxPricePerMeter = realMax;
        }
      }

      // ĐIỀU CHỈNH CHỐNG SAI LỆCH UI: Đảm bảo mốc Min/Max bọc ngoài giá hiện tại để slider không văng ra rìa
      if (currentPricePerMeter < minPricePerMeter) minPricePerMeter = Math.floor(currentPricePerMeter) - 2;
      if (currentPricePerMeter > maxPricePerMeter) maxPricePerMeter = Math.ceil(currentPricePerMeter) + 2;

      // =========================================================================
      // 🔥 5. THÊM MỚI LOGIC: TỰ ĐỘNG PHÂN TÍCH CÁC YẾU TỐ ẢNH HƯỞNG & ĐIỀU KIỆN GIÁ
      // =========================================================================
      const marketNotes: string[] = [];

      // Phân tích vị trí giá so với đáy/đỉnh phân khúc
      if (currentPricePerMeter <= minPricePerMeter + 2) {
        marketNotes.push("Căn hộ đang có mức giá thuộc vùng đáy phân khúc khu vực " + districtKeyword + ", tính thanh khoản cực kỳ cao.");
      } else if (currentPricePerMeter >= maxPricePerMeter - 2) {
        marketNotes.push("Mức giá tiệm cận trần phân khúc khu vực do sở hữu các đặc tính ưu việt vượt trội hơn mặt bằng chung.");
      } else {
        marketNotes.push("Mức giá giao dịch ổn định, nằm đúng vùng lõi của khoảng giá phổ biến đối với dòng căn hộ Bcons.");
      }

      // Phân tích điều kiện dựa trên Hiện trạng Nội thất (furniture)
      const furnitureStr = String(currentApartment.furniture || "").toLowerCase();
      if (furnitureStr.includes("đầy đủ") || furnitureStr.includes("full")) {
        marketNotes.push("Giá bán đã bao gồm trọn bộ gói nội thất cao cấp nâng cấp riêng, khách mua dọn vào ở ngay không phát sinh chi phí.");
      } else {
        marketNotes.push("Giá bán áp dụng cho tiêu chuẩn bàn giao cơ bản từ chủ đầu tư Bcons, tối ưu chi phí gốc và dễ dàng tự thiết kế setup decor.");
      }

      // Phân tích hướng nắng/gió dựa trên Hướng ban công (direction_balcony)
      const balconyStr = String(currentApartment.direction_balcony || "").toLowerCase();
      if (balconyStr.includes("đông") || balconyStr.includes("nam")) {
        marketNotes.push("Sở hữu hướng ban công Đông/Nam mát mẻ đón tài lộc, không bị nắng chiều chiếu trực diện, thường có giá trị chênh lệch chênh cao từ 3% - 5% trên thị trường.");
      } else if (balconyStr.includes("tây")) {
        marketNotes.push("Ban công hướng Tây đón trọn view hoàng hôn, mức giá thường được chủ nhà chiết khấu sâu hơn so với các hướng khác.");
      }

      // Note điều kiện cố định bổ trợ nghiệp vụ kinh doanh bất động sản
      marketNotes.push("Biên độ giá m² có sự tịnh tiến dao động tùy thuộc vào vị trí số tầng (phân khúc tầng trung từ tầng 8 - 18 luôn có giá chênh lệch cao hơn các tầng áp mái hoặc tầng thấp).");

      // Trả về gói dữ liệu JSON hoàn chỉnh, sạch sẽ
      return {
        success: true,
        khuVuc: districtKeyword,
        minPricePerMeter: Math.round(minPricePerMeter),
        maxPricePerMeter: Math.round(maxPricePerMeter),
        currentPricePerMeter,
        marketNotes // Mảng chuỗi phân tích lưu ý động để Frontend gán DOM ID
      };

    } catch (error: any) {
      console.error("❌ Lỗi hệ thống tại hàm getPricePerMeterStats:", error);
      throw new Error(error.message || "Không thể thực hiện tính toán khoảng giá m2 phổ biến");
    }
  }
}