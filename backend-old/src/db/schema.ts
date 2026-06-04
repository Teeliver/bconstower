import { mysqlTable, mysqlEnum, decimal, bigint, text, varchar, timestamp, int, boolean, } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  fullname: varchar('fullname', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  avatar: text('avatar'), 
  role: varchar('role', { length: 20 }).default('EDITOR').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Bảng Broker Profiles (Thông tin đặc thù cho môi giới)
export const brokerProfiles = mysqlTable('broker_profiles', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  licenseNumber: varchar('license_number', { length: 50 }), // Số chứng chỉ hành nghề
  companyName: varchar('company_name', { length: 255 }),   // Công ty/Sàn giao dịch
  experienceYears: int('experience_years'),               // Năm kinh nghiệm
  areaFocus: text('area_focus'),                          // Khu vực tập trung (Vd: Dĩ An, Thuận An)
  bio: text('bio'),                                       // Giới thiệu bản thân
  verified: int('verified').default(0),                   // 0: Chưa duyệt, 1: Đã xác minh
  updatedAt: timestamp('updated_at').onUpdateNow(),
});

export const posts = mysqlTable("posts", {
  id: int('id').autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  summary: text("summary"),
  content: text("content").notNull(),
  thumbnail: varchar("thumbnail", { length: 255 }),
  category: varchar("category", { length: 100 }).default("news"),  // Sửa 'Tin tức' thành 'news'
  authorId: int("author_id"),
  status: varchar("status", { length: 50 }).default("draft"), // Sửa 'draft' thành 'draft' (giữ nguyên vì không có dấu)
  views: int("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(), // Thêm cột này cho SEO
  address: varchar('address', { length: 255 }).notNull(),
  image: text('image'),
  status: mysqlEnum('status', ['dang_xay_dung', 'da_ban_giao', 'dang_mo_ban', 'sap_mo_ban']).default('dang_xay_dung'),
  legal: mysqlEnum('legal', ['so_hong', 'hdmb', 'booking']).default('hdmb'),
  createdAt: timestamp('created_at').defaultNow(),
  lat: decimal('lat', { precision: 10, scale: 7 }), // Vĩ độ (Ví dụ: 10.9023410)
  lng: decimal('lng', { precision: 10, scale: 7 }), // Kinh độ (Ví dụ: 106.7765120)
});

export const settings = mysqlTable('settings', {
  id: int('id').primaryKey().default(1),
  siteTitle: varchar('site_title', { length: 255 }),
  siteDescription: text('site_description'),
  favicon: varchar('favicon', { length: 255 }),
  ogImage: varchar('og_image', { length: 255 }),
  logo: varchar('logo', { length: 255 }),
  logoFooter: varchar('logo_footer', { length: 255 }), // Đôi khi footer dùng logo trắng
  hotline: varchar('hotline', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  copyright: varchar('copyright', { length: 255 }), // Ví dụ: "© 2024 TenCongTy. All rights reserved."
  facebookUrl: varchar('facebook_url', { length: 255 }),
  zaloUrl: varchar('zalo_url', { length: 255 }),
  youtubeUrl: varchar('youtube_url', { length: 255 }),
  googleAnalytics: varchar('google_analytics', { length: 50 }),
  customScripts: text('custom_scripts'), // Mã nhúng chatbot, pixel...
  updatedAt: timestamp('updated_at').onUpdateNow().defaultNow(),
});

export const apartments = mysqlTable('apartments', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').notNull(), // Liên kết với bảng projects
  name: varchar('name', { length: 100 }).notNull(), // Ví dụ: Căn A1-05
  slug: varchar('slug', { length: 255 }).notNull().unique(), // Phục vụ SEO link
  block: varchar('block', { length: 50 }), // Tháp (Block) A, B...
  floor: int('floor'), // Tầng
  area: decimal('area', { precision: 10, scale: 2 }), // Diện tích
  bedrooms: int('bedrooms'), // Số phòng ngủ
  bathrooms: int('bathrooms'), // Số phòng vệ sinh
  directionMain: varchar('direction_main', { length: 50 }), // Hướng cửa chính
  directionBalcony: varchar('direction_balcony', { length: 50 }), // Hướng bancol
  furniture: varchar('furniture', { length: 100 }), // Tình trạng nội thất (Thô, Cơ bản, Full...)
  description: text('description'), // mô tả căn hộ
  price: bigint('price', { mode: 'number' }), // Giá bán
  status: mysqlEnum('status', ['trong', 'da_coc', 'da_ban']).default('trong'),
  approvalStatus: mysqlEnum('approval_status', ['pending', 'approved', 'rejected']).default('pending'),
  image: text('image').notNull(),
  folderPath: text('folder_path'), // Lưu tên folder để xoá
  userId: int('user_id').references(() => users.id),
  createdBy: int('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  action: text('action').notNull(), // VD: "Thêm mới", "Cập nhật trạng thái", "Xóa"
  target: text('target').notNull(), // VD: "Căn hộ Bcons Sapphire"
  description: text('description'), // VD: "Đổi trạng thái từ Trống sang Đã bán"
  isRead: int('is_read').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const heroSlides = mysqlTable('hero_slides', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: text('subtitle'),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  linkUrl: varchar('link_url', { length: 500 }), // Bỏ default
  buttonText: varchar('button_text', { length: 100 }), // Bỏ default
  isActive: boolean('is_active').default(true),
  displayOrder: int('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 🔥 BẢNG BANKS BỔ SUNG CHUẨN ĐÉT ĐỒNG BỘ THEO HỆ MYSQL CỦA TRUNG TÍN
export const banks = mysqlTable('banks', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  preferentialRate: decimal('preferential_rate', { precision: 4, scale: 2 }).notNull(),
  preferentialTerm: int('preferential_term').notNull(),
  floatingRate: decimal('floating_rate', { precision: 4, scale: 2 }).notNull(),
  maxTerm: int('max_term').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});