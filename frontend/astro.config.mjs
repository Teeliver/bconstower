// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://bconstower.vn',
  output: 'static',

  adapter: node({
    mode: 'standalone',
  }),

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Ép Vite tối ưu hóa các thư viện này ngay từ đầu để tránh lỗi 504
      include: ['sweetalert2', 'canvas-confetti'] 
    },
  },

  integrations: [sitemap()]
});

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