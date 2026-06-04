// Hàm lấy IP Server động: Ưu tiên lấy trong cấu hình Admin, nếu chưa có thì lấy mặc định
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const customIp = localStorage.getItem('BCONS_SERVER_IP');
    if (customIp) return customIp;
  }
  return 'http://localhost:3000'; // IP mặc định của Trung Tín
}