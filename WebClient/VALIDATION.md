# Kiểm tra bản bàn giao

## Môi trường đã dùng

- Node.js 24.19.0 trên Linux; Chromium với WebGL qua SwiftShader.
- Server `pafa7a/mu-online-js`, commit `4f838d21e039d7db45b47c1896a4c41efce83cbe`.
- MySQL 8.0 riêng cho kiểm tra, database mới có đầy đủ bảng từ `libs/mu-db/install/index.js` và dữ liệu mẫu từ `install/dummy.js`.
- MySQL test được khởi tạo với `lower_case_table_names=1` vì server có truy vấn `memb_info` trong khi schema dùng `MEMB_INFO`. Đây là cấu hình của database test mới; không thay đổi database hiện có của người dùng.
- ConnectServer, JoinServer, GameServer và socket server chạy bằng source gốc cùng các dependency theo lockfile. Chứng chỉ TLS mới nằm trong bản runtime riêng cho kiểm tra.

## Kết quả

- `npm ci`: cài dependency từ lockfile.
- `npm test`: **27 test đạt**, không có test bỏ qua. Kiểm tra framing TCP phân mảnh/gộp, codec MU, xác minh TLS, timeout, quyền thao tác nhân vật, cleanup kết nối, HTTP/WebSocket và tạo/animate/dispose model của cả bảy hệ nhân vật.
- `npm run build`: tạo bản build Vite thành công.
- `npm run dev`: khởi động gateway ở cổng `3001` và Vite ở cổng `5173`; kiểm tra trình duyệt bên dưới cũng đạt trên địa chỉ Vite qua proxy WebSocket.
- `npm run smoke`: đăng nhập thật qua ConnectServer → GameServer → JoinServer → MySQL, nhận danh sách nhân vật và thông tin khi vào map. Không dùng mock thay thế các dịch vụ trong lần smoke này.
- Chromium: đăng nhập bằng dữ liệu mẫu, nhận ba nhân vật ban đầu; tạo `WebKnight` trên database test, chọn nhân vật và vào map. HP/MP và thuộc tính được hiển thị theo dữ liệu server.
- Chromium: điều khiển bàn phím trong cảnh local làm vị trí thay đổi; nút cảnh mẫu, hướng dẫn và thoát hoạt động. Không có lỗi JavaScript trên trang trong lần kiểm tra cuối.
- Giao diện desktop 1440×1000 và mobile 390×844; không tràn ngang ở viewport mobile đã kiểm tra.

## Giới hạn

- Chưa chạy trực tiếp trên Mac hoặc Safari. Hướng dẫn Mac sử dụng cùng Node.js và các lệnh đa nền tảng.
- Model và bản đồ là nội dung dựng riêng cho prototype; không có asset MuMain.
- Di chuyển chỉ thay đổi cảnh trong trình duyệt, không gửi hoặc lưu vị trí lên GameServer. Chưa có đồng bộ nhiều người chơi, quái, chiến đấu hay gameplay hoàn chỉnh.
- Package packet manager của server có quirk alignment và trả thiếu một phần đuôi gói thông tin map. Gateway đã kiểm tra và đọc được vị trí, HP/MP, thuộc tính và Zen; các trường đuôi không đủ dữ liệu không được suy đoán thành chỉ số thật.
- `Gateway sẵn sàng` chỉ báo HTTP gateway đang hoạt động. Kết nối MU và database được kiểm tra khi đăng nhập hoặc chạy smoke.

Không có thay đổi vào source, lockfile, chứng chỉ hoặc database của server trên Mac người dùng. Các thay đổi mã nằm trong thư mục `WebClient` mới.
