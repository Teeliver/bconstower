const API_BASE = "http://localhost:3000/api";

// Helper để lấy token nhanh
const getAuthHeader = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("admin_token") : null;
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

export const ApartmentService = {
  // --- DÀNH CHO NGƯỜI DÙNG ---
  getAllApproved: async () => {
    try {
      const res = await fetch(`${API_BASE}/apartments`);
      if (!res.ok) throw new Error("Lỗi fetch danh sách căn hộ");
      return await res.json();
    } catch (error) {
      console.error("ApartmentService.getAllApproved:", error);
      return [];
    }
  },

  getBySlug: async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/apartments/detail/${slug}`);
      if (!res.ok) throw new Error("Không tìm thấy căn hộ");
      return await res.json();
    } catch (error) {
      console.error("ApartmentService.getBySlug:", error);
      return null;
    }
  },

  // --- DÀNH CHO ADMIN (CẦN TOKEN ĐỂ HIỆN DANH SÁCH & GHI LOG) ---

  getAdminList: async () => {
    try {
      const res = await fetch(`${API_BASE}/apartments/admin-list`, {
        headers: { ...getAuthHeader() } // THÊM TOKEN VÀO ĐÂY ĐỂ HIỆN DANH SÁCH
      });
      if (!res.ok) throw new Error("Lỗi fetch danh sách Admin");
      const result = await res.json();
      
      // Bóc tách dữ liệu linh hoạt (Hỗ trợ cả mảng trực tiếp hoặc object {data: []})
      return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
      console.error("ApartmentService.getAdminList:", error);
      return [];
    }
  },

  getById: async (id: string | number) => {
    try {
      const res = await fetch(`${API_BASE}/apartments/by-id/${id}`);
      if (!res.ok) throw new Error("Không tìm thấy dữ liệu căn hộ");
      return await res.json();
    } catch (error) {
      console.error("ApartmentService.getById:", error);
      return null;
    }
  },

  create: async (formData: FormData) => {
    try {
      const res = await fetch(`${API_BASE}/apartments/add`, {
        method: "POST",
        headers: { ...getAuthHeader() },
        body: formData,
      });

      const result = await res.json();
      return {
        success: res.ok,
        message: result.message || (res.ok ? "Thêm thành công" : "Thêm thất bại"),
        data: result,
      };
    } catch (error) {
      return { success: false, message: "Lỗi kết nối Server" };
    }
  },

  update: async (id: string | number, formData: FormData) => {
    try {
      const res = await fetch(`${API_BASE}/apartments/${id}`, {
        method: "PUT",
        headers: { ...getAuthHeader() }, // THÊM TOKEN ĐỂ GHI LOG NGƯỜI SỬA
        body: formData,
      });
      const result = await res.json();
      return {
        success: res.ok,
        message: result.message || (res.ok ? "Cập nhật thành công" : "Cập nhật thất bại"),
      };
    } catch (error) {
      return { success: false, message: "Lỗi kết nối Server" };
    }
  },

  delete: async (id: string | number) => {
    try {
      const res = await fetch(`${API_BASE}/apartments/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() } // THÊM TOKEN ĐỂ GHI LOG NGƯỜI XÓA
      });
      const result = await res.json();
      return {
        success: res.ok,
        message: result.message || (res.ok ? "Xóa thành công" : "Xóa thất bại"),
      };
    } catch (error) {
      return { success: false, message: "Không thể kết nối đến server" };
    }
  },

  approve: async (id: string | number, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`${API_BASE}/apartments/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader() // THÊM TOKEN ĐỂ GHI LOG NGƯỜI DUYỆT
        },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      return {
        success: res.ok,
        message: result.message || (res.ok ? "Thao tác thành công" : "Thao tác thất bại"),
      };
    } catch (error) {
      return { success: false, message: "Lỗi kết nối server" };
    }
  },
};

/** Dịch vụ quản lý Dự án */
export const ProjectService = {
  getAll: async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/list-all`, {
        method: 'GET',
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) throw new Error("Lỗi lấy danh sách dự án");
      const result = await res.json();
      return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
      console.error("ProjectService.getAll Error:", error);
      return [];
    }
  },

  delete: async (id: string | number) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() } // THÊM TOKEN ĐỂ GHI LOG NGƯỜI XÓA DỰ ÁN
      });
      const result = await res.json();
      return {
        success: res.ok,
        message: result.message || (res.ok ? "Xóa thành công" : "Xóa thất bại")
      };
    } catch (error) {
      return { success: false, message: "Không thể kết nối đến server" };
    }
  },
};