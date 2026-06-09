// src/middleware.ts
import { defineMiddleware } from "astro:middleware";

const PROTECTED_ROUTES: Record<string, string[]> = {
  "/admin/projects": ["admin"],

  
  "/admin/dashboard": ["admin", "manager", "broker"], 
  
  // 🟢 SỬA TẠI ĐÂY: Mở khóa vùng /admin chung cho cả Manager và Broker vào các trang con
  "/admin": ["admin", "manager", "broker"],                               
  
  "/manager": ["admin", "manager"],                  
  "/dashboard": ["admin", "manager", "broker"],       
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  const pathname = url.pathname;

  if (
    pathname.includes("/login") ||           
    pathname.includes("/403") ||  
    pathname.startsWith("/api") ||           
    pathname.includes(".")                   
  ) {
    return next(); 
  }

  const matchedPath = Object.keys(PROTECTED_ROUTES)
    .sort((a, b) => b.length - a.length)
    .find(route => pathname.startsWith(route));

  if (matchedPath) {
    const rawToken = cookies.get("auth_token")?.value;
    const rawRole = cookies.get("user_role")?.value;

    // 🔥 BƯỚC VÁ CHÍ MẠNG: Giải mã URL Cookie để khôi phục chữ "MÔI GIỚI", "NHÂN VIÊN" nguyên vẹn
    const cleanToken = rawToken ? decodeURIComponent(rawToken) : null;
    const cleanRole = rawRole ? decodeURIComponent(rawRole).replace(/^"|"$/g, '').trim().toLowerCase() : null;

    const token = (cleanToken && cleanToken !== "undefined" && cleanToken !== "null") ? cleanToken : null;
    const userRole = cleanRole;

    // Quy đổi nhóm quyền chuẩn hóa sau khi đã giải mã thành công
    let userGroup = userRole;
    if (userRole) {
      if (["quan_ly", "quản lý", "manager", "editor"].includes(userRole)) {
        userGroup = "manager";
      } else if (["moi_gioi", "môi giới", "broker", "nhan_vien", "nhân viên"].includes(userRole)) {
        userGroup = "broker";
      } else if (["admin", "administrator"].includes(userRole)) {
        userGroup = "admin";
      }
    }

    // In log ra Terminal để ông giám sát dòng chữ Tiếng Việt đổ về chuẩn chưa
    console.log(`[Bcons Cookie Decode] Path: ${pathname} | Role gốc: [${userRole}] -> Nhóm: [${userGroup}]`);

    if (!token || !userGroup) {
      const targetLogin = pathname.startsWith("/admin") ? "/admin/login" : "/login";
      return redirect(`${targetLogin}?redirect=${encodeURIComponent(pathname)}`);
    }

    const allowedRoles = PROTECTED_ROUTES[matchedPath];
    if (!allowedRoles.includes(userGroup)) {
      return redirect("/403"); 
    }
  }

  return next();
});