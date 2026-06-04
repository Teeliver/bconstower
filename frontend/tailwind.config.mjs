/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bh: {
          'primary': '#005043',     // Xanh lá chủ đạo [cite: 6]
          'secondary': '#114232',   // Xanh lá phụ [cite: 7]
          'accent': '#F48223',      // Vàng cam Accent [cite: 8]
          'gold': '#FFC94A',        // Vàng Soft Gold [cite: 9]
          'off-white': '#F8F8F6',   // Nền Off White [cite: 10]
          'light-gray': '#E1E7E7',  // Xám nhạt bo viền [cite: 11]
          'text-main': '#1E1E1E',   // Chữ chính [cite: 12]
          'text-sub': '#686B6B',    // Chữ phụ [cite: 13]
        }
      },
      fontFamily: {
        'heading': ['"Be Vietnam Pro"', 'sans-serif'], // Cho Titles/Headings [cite: 57]
        'body': ['Inter', 'sans-serif'],               // Cho nội dung văn bản [cite: 63, 65]
      }
    },
  },
  plugins: [],
}