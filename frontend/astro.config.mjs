// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 🟢 1. Điền domain production của Frontend để sitemap sinh link tuyệt đối chính xác
  site: 'https://bconstower.vn', 

  // 🟢 2. ÉP CẤU HÌNH STATIC: Trả Astro về đúng bản ngã đóng gói tĩnh phẳng
  output: 'static',
  
  integrations: [
    sitemap({
      changefreq: 'daily', // Tần suất quét dự kiến báo cho Google Bot
      priority: 0.7,       // Độ ưu tiên mặc định cho các trang thành phần
      // 🟢 3. XỬ LÝ DỨT ĐIỂM LỖI TS: Tự động lấy ngày giờ của phiên build làm lastmod toàn cục.
      // Cứ mỗi 15-30 phút Cron job chạy lại, mốc này sẽ tự làm mới, Google Bot quét cực kỳ thích.
      lastmod: new Date(), 
    }),
  ],

  vite: {
    // Giữ nguyên vẹn 100% các plugin giao diện UI/UX v4 của ông
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['sweetalert2', 'canvas-confetti'] 
    },
  },
});