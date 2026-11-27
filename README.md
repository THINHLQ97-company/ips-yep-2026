# IPS Year End Party 2026 — The Other Way | Mở lối đi riêng

Trang check-in, bình chọn văn nghệ, bốc thăm may mắn và dashboard BTC cho YEP 2026 của IPS.
Cấu trúc giống repo MDF 2027: Node.js thuần, không framework, không database, **không cần `npm install`**.

| Đường dẫn | Dành cho | Nội dung |
|---|---|---|
| `/` | Nhân sự (quét QR) | Check-in nhận mã số may mắn 001–999, vé 3D, lịch sử truy cập, bình chọn, xem giải thưởng |
| `/#checkin`, `/#vote` | Link in trên mã QR | Mở thẳng vào phần check-in / bình chọn |
| `/screen/` | Màn hình LED (không cần đăng nhập) | Tòa tháp 3D bình chọn realtime + QR bình chọn |
| `/admin/` | BTC (mật khẩu) | Tổng quan, danh sách check-in, check-in hộ, tiết mục, giải thưởng, bốc thăm 3D, giao diện, dữ liệu |

## Chạy

Cần Node.js 18 trở lên.

```bash
cp .env.example .env    # điền ADMIN_PASSWORD và PUBLIC_URL
npm start               # http://localhost:8000 · dashboard /admin/ · màn hình /screen/
```

Hoặc Docker:

```bash
docker build -t ips-yep .
docker run -d -p 8000:3000 -e ADMIN_PASSWORD=... -e PUBLIC_URL=https://yep.ipscorp.vn -v ips-yep-data:/app/data ips-yep
```

## Cấu hình (`.env`)

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng chạy (mặc định 8000; Docker dùng 3000) |
| `PUBLIC_URL` | Link công khai, dùng để tạo mã QR (vd `https://yep.ipscorp.vn`). Có thể đổi trong dashboard. |
| `ADMIN_PASSWORD` | Mật khẩu chung của BTC cho `/admin/`. Bỏ trống = dashboard khoá. Đổi mật khẩu sẽ đăng xuất mọi phiên. |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên ký phiên đăng nhập (bỏ trống thì tự sinh và lưu trong `data/`) |
| `TRUST_PROXY=1` | Bật khi chạy sau Nginx/Cloudflare để giới hạn tần suất theo đúng IP người dùng |
| `DATA_DIR` | Thư mục dữ liệu (mặc định `data/`): `db.json` + ảnh tải lên trong `uploads/` |

**Quan trọng khi deploy:** thư mục `data/` phải được giữ lại giữa các lần deploy (volume Docker hoặc thư mục cố định trên host),
nếu không danh sách check-in sẽ mất. `data/` đã nằm trong `.gitignore`, không bao giờ lên Git.

## Luồng sự kiện

1. **Check-in**: quét QR tại bàn đăng ký → điền Họ tên, Loại hình (Dự án / Hội sở), Phòng ban, Email, SĐT → nhận mã số ngẫu nhiên 001–999 (không trùng).
   Trình duyệt được ghi nhớ 30 ngày; mở lại trang là thấy vé, mã số, lịch sử các lần truy cập. Đổi máy: "Đã check-in trên máy khác?" → nhập SĐT + email.
   Mỗi số điện thoại chỉ check-in một lần. BTC có thể check-in hộ trong dashboard.
2. **Bình chọn**: BTC bật "Cổng bình chọn" trong dashboard. Người đã check-in chọn 1 tiết mục (đổi ý được khi cổng còn mở).
   `/screen/` hiển thị mỗi tiết mục là một tòa nhà 3D, mỗi phiếu thêm một tầng; tòa cao nhất được thắp biểu tượng IPS.
3. **Bốc thăm**: tab Bốc thăm trong dashboard (phím F toàn màn hình, Space bắt đầu). Người thắng được **máy chủ chọn ngẫu nhiên (crypto)** trong toàn bộ người đã check-in và chưa trúng giải,
   sau đó 8 mã số chạy trên "Đường đua Lối Riêng" và mã thắng chạm cổng IPS đầu tiên. "Vắng mặt, bốc lại" đánh dấu vắng và loại người đó khỏi các lượt sau.
   Kết quả chỉ hiện trên điện thoại người trúng sau khi đường đua kết thúc.
4. **Sau sự kiện**: Dữ liệu → Xuất Excel (CSV) gồm mã, thông tin, giờ check-in, số lần mở trang, tiết mục đã bình chọn, giải thưởng.

## Chỉnh nội dung

- **Tiết mục, giải thưởng, ảnh giải, thông tin sự kiện, ảnh nền**: chỉnh trực tiếp trong dashboard, không cần deploy lại.
- Ảnh nền mặc định trong `images/`: `bg-desktop.jpg` (16:9), `bg-mobile.jpg` (9:16), `bg-stage.jpg` (LED 16:9), `og.jpg` (ảnh chia sẻ link).
- Danh sách phòng ban: `DEPTS` trong `server/server.js` và `js/yep-common.js` (sửa cả hai).
- Prompt tạo ảnh bằng ChatGPT: xem `PROMPTS.md`.

## Tập dượt

Dashboard → Dữ liệu → "Tạo 30 khách mẫu" để thử màn hình bình chọn và bốc thăm; "Xoá khách mẫu" trước giờ G.

## Files

- `index.html`, `css/yep.css`, `js/yep.js`, `js/fx.js` – trang người tham dự (giao diện kính mờ theo MDF 2027, hiệu ứng chủ đề)
- `screen/index.html`, `css/stage.css`, `js/stage.js` – sân khấu 3D (tòa tháp bình chọn, bục giải, đường đua)
- `admin/index.html`, `admin/admin.js` – dashboard BTC
- `js/yep-common.js` – hàm dùng chung; `js/qrcode.js` – thư viện QR (MIT)
- `server/server.js` (HTTP + API + SSE realtime), `server/store.js` (JSON store ghi nguyên tử)
- `fonts/` – Poppins, Barlow, Unbounded (có bộ chữ tiếng Việt), tự host
