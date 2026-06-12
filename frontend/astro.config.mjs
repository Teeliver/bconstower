// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 🔥 BẮT BUỘC: Điền domain production của Frontend để sitemap sinh link tuyệt đối chính xác
  site: 'https://bconstower.vn', 

  adapter: node({
    mode: 'standalone',
  }),
  
  integrations: [
    sitemap({
      // Cấu hình tùy chọn (nếu cần thiết)
      changefreq: 'daily', // Tần suất quét dự kiến báo cho Google Bot
      priority: 0.7,       // Độ ưu tiên mặc định cho các trang thành phần
      lastmod: new Date(), // Ngày cập nhật cuối cùng (lấy thời gian build)
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Ép Vite tối ưu hóa các thư viện này ngay từ đầu để tránh lỗi 504
      include: ['sweetalert2', 'canvas-confetti'] 
    },
  },
});

// export default defineConfig({
//   // site: 'https://bconstower.vn',
//   output: 'server',

//   adapter: node({
//     mode: 'standalone',
//   }),

//   vite: {
//     plugins: [tailwindcss()],
//     optimizeDeps: {
//       // Ép Vite tối ưu hóa các thư viện này ngay từ đầu để tránh lỗi 504
//       include: ['sweetalert2', 'canvas-confetti'] 
//     },
//   },

//   integrations: [sitemap()]
// });

// @ts-check
// import { defineConfig } from 'astro/config';
// import tailwindcss from '@tailwindcss/vite';

// // https://astro.build/config
// export default defineConfig({
//   site: 'https://bconstower.vn',

//   // 🔥 THAY ĐỔI CHÍ MẠNG: Chuyển sang 'static' và loại bỏ hoàn toàn bộ chuyển đổi adapter Node
//   // Khi chạy build, hệ thống sẽ xuất ra thư mục dist/ chứa toàn bộ file HTML/JS tĩnh sạch sẽ
//   output: 'static',

//   vite: {
//     plugins: [tailwindcss()],
//     optimizeDeps: {
//       // Ép Vite tối ưu hóa các thư viện này ngay từ đầu để tránh lỗi 504 khi chạy local
//       include: ['sweetalert2', 'canvas-confetti'] 
//     },
//   }
// });