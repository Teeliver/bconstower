# MU Web Client

Client MU chạy trong trình duyệt, dùng **React + Babylon.js** và gateway Node.js để kết nối tới server [pafa7a/mu-online-js](https://github.com/pafa7a/mu-online-js) đang chạy trên máy của bạn.

Bản này hỗ trợ đăng nhập thật, lấy danh sách nhân vật, tạo nhân vật và lấy dữ liệu khi vào map. Cảnh 3D và nhân vật được dựng riêng bằng mã; chưa sử dụng model, texture hoặc bản đồ của MuMain. WASD/click giúp di chuyển trong cảnh local; chưa đồng bộ vị trí với server, chưa có nhiều người chơi hoặc chiến đấu. HP, MP, Zen và thuộc tính trong chế độ đăng nhập được hiển thị theo dữ liệu server, kể cả khi dữ liệu mẫu có giá trị `0`.

Nút **Khám phá cảnh mẫu** mở một cảnh độc lập với nhân vật và chỉ số mẫu, không đăng nhập vào server. Có thể dùng nút này để thử phần 3D trước khi khởi động các dịch vụ MU.

## 1. Đặt WebClient vào đúng chỗ

Giải nén gói client và đặt thư mục `WebClient` trong repository MU của bạn. Cấu trúc phải như sau:

```text
~/Projects/mu-online-js/
├── Client/
├── ConnectServer/
├── GameServer/
├── JoinServer/
├── WebClient/
│   ├── package.json
│   ├── package-lock.json
│   ├── server/
│   └── src/
├── WebServer/
└── ssl/
    ├── cert.pem
    └── key.pem
```

Không đặt `WebClient` bên trong thư mục `Client` cũ. `Client` cũ là công cụ Terminal; `WebClient` là giao diện trình duyệt mới.

## 2. Kiểm tra Node.js

Mở Terminal và chạy:

```bash
node --version
```

Dự án cần Node.js **22 trở lên**; phiên bản được kiểm tra là Node.js **24 trên Linux**. Chưa xác minh chạy trực tiếp trên macOS. Nếu muốn dùng cùng phiên bản trên Mac:

```bash
brew install node@24
```

Trong chính tab Terminal sẽ chạy client:

```bash
export PATH="$(brew --prefix node@24)/bin:$PATH"
```

Kiểm tra lại:

```bash
node --version
npm --version
```

Không cần cài Babylon.js hoặc React riêng; bước tiếp theo sẽ cài đúng phiên bản trong lockfile.

## 3. Cài thư viện cho client web

Chạy trong một tab Terminal mới:

```bash
cd ~/Projects/mu-online-js/WebClient
```

```bash
npm ci
```

Giữ nguyên `package-lock.json`. Dùng `npm ci` thay vì cài từng package.

## 4. Giữ MySQL và bốn dịch vụ MU hoạt động

Nếu MySQL của bạn đang hoạt động và đăng nhập được thì giữ cấu hình hiện tại. Nếu dùng container theo hướng dẫn trước và container đang dừng:

```bash
docker start mujs-mysql
```

Mỗi dịch vụ dưới đây chạy trong **một tab Terminal riêng**. Nếu chúng đang chạy rồi, không mở thêm bản thứ hai.

**Tab Socket server:**

```bash
cd ~/Projects/mu-online-js/WebServer/mu-socket-server
yarn start
```

**Tab ConnectServer:**

```bash
cd ~/Projects/mu-online-js/ConnectServer
yarn start
```

**Tab JoinServer:**

```bash
cd ~/Projects/mu-online-js/JoinServer
yarn start
```

**Tab GameServer:**

```bash
cd ~/Projects/mu-online-js/GameServer
yarn start
```

Chờ GameServer kết nối được JoinServer và đăng ký với ConnectServer. Nếu mới cài source và chưa có `dist/index.js`, build ConnectServer và JoinServer theo hướng dẫn của repository trước khi chạy.

Gateway web dùng chứng chỉ `~/Projects/mu-online-js/ssl/cert.pem` mà bạn đã tạo mới. Chứng chỉ cần còn hạn và có SAN cho `localhost`, `127.0.0.1`; ConnectServer và GameServer phải được khởi động lại sau khi thay chứng chỉ. Gateway giữ xác minh TLS hoạt động.

## 5. Chạy client web

Trong tab ở thư mục `WebClient`, chạy:

```bash
npm run dev
```

Lệnh này khởi động cả gateway Node.js ở cổng `3001` và Vite ở cổng `5173`. Giữ tab này mở.

Mở Chrome hoặc Safari rồi nhập **`http://127.0.0.1:5173`** vào thanh địa chỉ.

1. Đợi nhãn **Gateway sẵn sàng**.
2. Nhập tài khoản đang có trong database MU. Nút **Dùng tài khoản mẫu của repository** điền `pafa7a` / `123`; chỉ dùng được nếu database của bạn có tài khoản mẫu đó.
3. Bấm **Đăng nhập**.
4. Chọn một nhân vật rồi bấm **Bước vào thế giới**.
5. Nếu chưa có nhân vật, bấm **Tạo nhân vật**, đặt tên 3–10 ký tự chữ không dấu, số hoặc dấu `_`, chọn lớp rồi xác nhận. Thao tác này tạo nhân vật thật trong database của server.

**Điều khiển trong cảnh:** WASD hoặc phím mũi tên để đi, click nền đất để chọn điểm đến, cuộn chuột/trackpad để zoom. Vị trí hiển thị là vị trí trong cảnh trình duyệt, chưa được lưu hoặc gửi sang GameServer.

Đóng client Terminal cũ nếu nó đang đăng nhập cùng tài khoản. Server có thể từ chối đăng nhập đồng thời. Dùng nút **Đăng xuất** hoặc nút thoát trên client web khi kết thúc.

Nhãn **Gateway sẵn sàng** chỉ xác nhận gateway web đang chạy; kết nối và đăng nhập MU được kiểm tra khi bạn bấm Đăng nhập.

## Nếu đăng nhập được nhưng không lấy được nhân vật

Database cần các bảng `MEMB_INFO`, `MEMB_STAT`, `AccountCharacter`, `Character`, `Guild`, `GuildMember`. File `.docker-files/mysql/init.sql` của repository chỉ tạo các bảng tài khoản; chưa đủ cho luồng nhân vật.

Nếu log GameServer báo thiếu bảng, dùng trình khởi tạo database có sẵn. Từ thư mục gốc repository:

```bash
cd ~/Projects/mu-online-js
```

```bash
yarn --cwd libs/mu-db install --frozen-lockfile --non-interactive
```

```bash
yarn --cwd libs/mu-db install-db
```

Script dùng cấu hình trong `libs/mu-db/config/db.js`, mặc định kết nối `127.0.0.1` với tài khoản `root` và database `muonline`. Chỉ chạy khi cấu hình đó khớp MySQL của bạn. Script tạo database/bảng bằng `IF NOT EXISTS`, không xóa hoặc nạp lại dữ liệu đã có.

Sau khi hoàn tất, khởi động lại GameServer, JoinServer và thử đăng nhập web lại. Không cần chạy `install-dummy-data`, nạp lại `init.sql`, xóa volume hoặc reset database hiện có.

Nếu log nói thiếu `memb_info` trong khi `MEMB_INFO` đã tồn tại, server đang gặp khác biệt tên bảng hoa/thường của MySQL, thường thấy với container Linux. Đây là vấn đề phía server/database; tạo lại client hoặc thay mật khẩu không giải quyết nó. Giữ dữ liệu hiện có và xử lý cấu hình MySQL hoặc truy vấn trong một thay đổi server riêng.

## Các lỗi thường gặp

| Thông báo hoặc biểu hiện | Việc cần kiểm tra |
| --- | --- |
| `Gateway offline` | Tab `npm run dev` có đang chạy và có lỗi không; giữ gateway ở cổng `3001` khi dùng Vite mặc định. |
| Không kết nối được ConnectServer/GameServer | Giữ các tab server mở; xem log đăng ký GameServer và kiểm tra cổng `44405`, `55901`. |
| Chứng chỉ hết hạn | Tạo lại chứng chỉ localhost trong `ssl`, khởi động lại ConnectServer và GameServer. |
| Không xác minh được chứng chỉ | `MU_CA_FILE` phải trỏ tới chứng chỉ mà server hiện dùng, không phải bản sao cũ. |
| Chứng chỉ không hợp lệ cho địa chỉ | Chứng chỉ cần SAN tương ứng với `127.0.0.1`/`localhost`, hoặc hostname bạn đã cấu hình. |
| `Access denied for user ...` trong JoinServer | Xem cấu hình database của server và MySQL đang giữ cổng `3306`; client web không kết nối database trực tiếp. |
| Tài khoản đang đăng nhập ở nơi khác | Đăng xuất client cũ, đợi vài giây rồi thử lại; xem log GameServer nếu phiên cũ chưa được giải phóng. |
| Không có nhân vật | Tạo nhân vật qua nút trên web; tài khoản mẫu không đảm bảo đã có nhân vật. |
| `EADDRINUSE` / cổng đang được sử dụng | Có bản client hoặc dịch vụ khác đang chạy. Kiểm tra tiến trình trước khi dừng nó. |
| Không khởi tạo được WebGL | Bật tăng tốc đồ họa của trình duyệt, thử Chrome mới; giao diện đăng nhập vẫn có thể hoạt động. |

Kiểm tra tiến trình giữ hai cổng web trên Mac:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Khi cần hỗ trợ, gửi lỗi của tab `npm run dev` cùng log liên quan từ JoinServer/GameServer. Không gửi mật khẩu database hoặc khóa riêng TLS.

## Kiểm tra và chạy bản build

Kiểm tra gateway và giao thức bằng bộ test tự động:

```bash
cd ~/Projects/mu-online-js/WebClient
npm test
```

Test này dùng fixture, không cần các dịch vụ MU thật. Báo cáo kiểm tra của lần bàn giao nằm trong `VALIDATION.md` nếu được kèm theo gói.

Muốn thử đầy đủ luồng đăng nhập, danh sách nhân vật và vào map trên server đang chạy, mở tab mới:

```bash
cd ~/Projects/mu-online-js/WebClient
npm run smoke
```

Smoke mặc định dùng gateway `3001` và tài khoản mẫu `pafa7a` / `123`. Tài khoản cần có ít nhất một nhân vật và không đang đăng nhập trên web/client khác. Script không tạo nhân vật hoặc nạp dữ liệu mẫu; server vẫn xử lý phiên đăng nhập thông thường. Kết quả thành công có `authenticated: true` và `enteredWorld: true`.

Để chạy bản đã build, dừng `npm run dev` bằng `Ctrl+C`, rồi chạy:

```bash
npm run build
```

```bash
npm start
```

Mở trình duyệt tại **`http://127.0.0.1:3001`**. `npm start` phục vụ các file trong `dist` và gateway trên cùng cổng; các server MU và MySQL vẫn cần hoạt động. Đây là cách chạy local, chưa phải cấu hình triển khai website công khai.

## Cấu hình tùy chọn

Mặc định phù hợp repository chạy cùng máy. Gateway đọc biến môi trường của tiến trình; **không tự đọc file `.env`**.

| Biến | Mặc định / ý nghĩa |
| --- | --- |
| `MU_CONNECT_HOST` | `127.0.0.1` — địa chỉ ConnectServer |
| `MU_CONNECT_PORT` | `44405` — cổng TLS ConnectServer |
| `MU_GAME_HOST` | `127.0.0.1` — địa chỉ GameServer; cổng được lấy từ ConnectServer |
| `MU_SERVER_ID` | `0` — ID server trong danh sách ConnectServer |
| `MU_CA_FILE` | File `ssl/cert.pem` tại thư mục gốc repository |
| `MU_VERSION` | Đọc `version` từ `GameServer/config/common.json` |
| `MU_SERIAL` | Đọc `serial` từ `GameServer/config/common.json` |
| `WEB_HOST` | `127.0.0.1` — chỉ lắng nghe local |
| `WEB_PORT` | `3001` — cổng gateway và bản build |
| `MU_TIMEOUT_MS` | `15000` — thời gian chờ phản hồi gói tin |
| `MU_SERVER_WAIT_MS` | `30000` — thời gian chờ GameServer xuất hiện |

Ví dụ dùng một file chứng chỉ khác cho gateway:

```bash
MU_CA_FILE="$HOME/Projects/mu-online-js/ssl/cert.pem" npm run dev
```

Ví dụ chạy bản build trên cổng khác:

```bash
WEB_PORT=3002 npm start
```

Khi dùng lệnh trên, nhập `http://127.0.0.1:3002` trong trình duyệt. Trong chế độ phát triển, proxy Vite hiện cố định tới gateway cổng `3001`; giữ mặc định khi chạy `npm run dev`.

## Nguồn và bản quyền

Giao thức MU và package `@mu-online-js/mu-packet-manager` được sử dụng từ dự án [pafa7a/mu-online-js](https://github.com/pafa7a/mu-online-js), có giấy phép MIT, © 2023 Pavel Tsandev. Bản sao giấy phép gốc được kèm trong `LICENSE` của gói client; giữ thông báo bản quyền và giấy phép khi phân phối mã liên quan.

Cảnh, model và giao diện của bản thử này được dựng riêng. Gói không chứa dữ liệu game MU gốc hoặc tài nguyên của [MuMain](https://github.com/pafa7a/MuMain).
