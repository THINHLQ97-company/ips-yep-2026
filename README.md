# IPS Year End Party 2026 — The Other Way | Mở lối đi riêng

Trang check-in, bình chọn văn nghệ, bốc thăm may mắn và dashboard BTC cho YEP 2026 của IPS.
Cấu trúc giống repo MDF 2027: Node.js thuần, không framework. Dữ liệu lưu trong **PostgreSQL** khi có `DATABASE_URL`
(dùng khi deploy, ví dụ Vibe Host), hoặc trong file JSON khi chạy thử trên máy. Thư viện duy nhất: `pg`.

| Đường dẫn | Dành cho | Nội dung |
|---|---|---|
| `/` | Nhân sự (quét QR) | Check-in nhận mã số may mắn 001–999, vé 3D, lịch sử truy cập, bình chọn, xem giải thưởng |
| `/#checkin` | Link in trên mã QR check-in | Mở thẳng vào phần check-in |
| `/vote/` | Nhân sự (QR bình chọn) | Trang bình chọn văn nghệ riêng. Các nút dẫn tới trang này chỉ sáng khi BTC mở cổng bình chọn trong dashboard |
| `/screen/` | Màn hình LED (không cần đăng nhập) | Tòa tháp 3D bình chọn realtime + QR bình chọn |
| `/admin/` | BTC (mật khẩu) | Tổng quan, danh sách check-in, check-in hộ, tiết mục, giải thưởng, bốc thăm 3D, giao diện, dữ liệu |

## Chạy

Cần Node.js 18 trở lên.

```bash
cp .env.example .env    # điền ADMIN_PASSWORD, PUBLIC_URL, DATABASE_URL
npm install
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
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL `postgres://user:pass@host:5432/db` (cũng nhận `POSTGRES_URL` hoặc các biến `PGHOST`, `PGUSER`...). Có biến này thì toàn bộ dữ liệu và ảnh tải lên lưu trong database: bảng `yep_state` (một dòng JSONB) và `yep_uploads`. Bảng tự tạo khi khởi động. |
| `DATABASE_SSL` | Đặt `true` nếu database bắt buộc SSL (hoặc thêm `?sslmode=require` vào URL) |
| `DATA_DIR` | Chỉ dùng khi không có `DATABASE_URL`: thư mục chứa `db.json` + `uploads/` (mặc định `data/`) |

**Quan trọng khi deploy:** luôn gắn PostgreSQL (`DATABASE_URL`). Không có database, dữ liệu nằm trong ổ đĩa container và sẽ mất khi deploy lại.
Lần đầu chạy với PostgreSQL, nếu còn file `data/db.json` cũ thì dữ liệu trong đó được chuyển sang database. App chạy **một instance** (không scale nhiều bản cùng lúc).

## Luồng sự kiện

1. **Check-in**: quét QR tại bàn đăng ký → điền Họ tên, Số điện thoại, Chức vụ (tự viết hoa chữ cái đầu), Đơn vị (IPS / FIFA), Khối/Phòng ban/Dự án (chỉ khi chọn IPS) → nhận mã số ngẫu nhiên 001–999 (không trùng).
   Trình duyệt được ghi nhớ 30 ngày; mở lại trang là thấy vé, mã số, lịch sử các lần truy cập. Đổi máy: "Đã check-in trên máy khác?" → nhập họ tên + số điện thoại hoặc mã số (BTC cũng tra được trong dashboard).
   Mỗi số điện thoại chỉ check-in một lần (SĐT là trường dò trùng; nhập +84/84 cũng được quy về 0…). BTC có thể check-in hộ trong dashboard; trùng họ tên nhưng khác SĐT thì dashboard chỉ cảnh báo.
   Dashboard danh sách check-in có bộ lọc **Đơn vị** và **Khối/Phòng ban/Dự án**, kết hợp đồng thời với ô tìm kiếm. Bộ lọc phòng ban áp dụng cho IPS; chọn FIFA hoặc đơn vị cũ sẽ xoá và vô hiệu hoá bộ lọc phòng ban. Dữ liệu Sakura cũ vẫn được giữ và có thể lọc/xem; không nhận check-in Sakura mới. Xuất CSV vẫn gồm toàn bộ danh sách.
2. **Bình chọn**: BTC bật "Cổng bình chọn" trong dashboard. Người đã check-in chọn 1 tiết mục (đổi ý được khi cổng còn mở).
   `/screen/` hiển thị mỗi tiết mục là một tòa nhà 3D, **mỗi 10 phiếu thêm một tầng** (chỉnh ở tab Bình chọn); tòa cao nhất được thắp biểu tượng IPS.
3. **Bốc thăm** (tab Bốc thăm, phím F toàn màn hình), **2 lần bấm** (Space, nút hoặc bấm vào sân khấu):
   - Lần 1: máy chủ chọn ngẫu nhiên người thắng (crypto) trong toàn bộ người đã check-in và chưa có tên trong danh sách trúng giải; màn hình chạy **vòng loại** (bức tường mã số) rồi **dừng** ở các mã vào chung kết.
   - Lần 2: đếm ngược 3-2-1 và **đường đua** tới biểu tượng IPS ở cuối đường. Thời gian đua mặc định 20 giây, chỉnh ngay trên tab Bốc thăm.
   - Có âm thanh (tổng hợp bằng Web Audio, không dùng file nhạc) và nút bật/tắt ở góc sân khấu.
   - Bấm "Trao giải" hoặc "Vắng mặt, bốc lại" để ghi nhận. Chỉ sau bước này kết quả mới hiện trên điện thoại người trúng và các màn hình khác.
   - Tab **Người trúng giải** liệt kê ai trúng giải gì, liên hệ, trạng thái; người đã có tên (kể cả vắng mặt) bị loại khỏi mọi lượt sau.
4. **Sau sự kiện**: Dữ liệu → Xuất Excel (CSV) gồm mã, thông tin, giờ check-in, số lần mở trang, tiết mục đã bình chọn, giải thưởng.

## Chỉnh nội dung

- **Tiết mục, giải thưởng, ảnh giải, thông tin sự kiện, ảnh nền**: chỉnh trực tiếp trong dashboard, không cần deploy lại.
- Ảnh nền mặc định trong `images/`: `bg-desktop.webp` (16:9), `bg-mobile.webp` (9:16), `bg-stage.webp` (LED 16:9), `og.jpg` (ảnh chia sẻ link).
- Danh sách khối/phòng ban/dự án: `DEPTS` trong `server/server.js` và `js/yep-common.js` (sửa cả hai).
- Prompt tạo ảnh bằng ChatGPT: xem `PROMPTS.md`.

## Tập dượt

Dashboard → Dữ liệu → "Tạo 30 khách mẫu" để thử màn hình bình chọn và bốc thăm; "Xoá khách mẫu" trước giờ G.

## Files

- `index.html`, `css/yep.css`, `js/yep.js`, `js/fx.js` – trang người tham dự (giao diện kính mờ theo MDF 2027, hiệu ứng chủ đề)
- `screen/index.html`, `css/stage.css`, `js/stage.js` – sân khấu 3D (tòa tháp bình chọn, bục giải, đường đua)
- `admin/index.html`, `admin/admin.js` – dashboard BTC
- `js/yep-common.js` – hàm dùng chung; `js/qrcode.js` – thư viện QR (MIT)
- `server/server.js` (HTTP + API + SSE realtime), `server/store.js` (lưu PostgreSQL hoặc file JSON)
- `fonts/` – Poppins, Barlow, Unbounded (có bộ chữ tiếng Việt), tự host

### Official IPS YEP key visual

Ảnh thay thế là **nền không chữ, không logo**: desktop và sân khấu 1920×1080 (16:9), điện thoại 1080×1920 (9:16). Giữ ảnh hiện tại đến khi có ảnh mới. HTML dùng font Poppins/Barlow tự host (không khẳng định là font gốc của artwork), tiêu đề cyan với OTHER nhấn mạnh, slogan và thông tin sự kiện trắng; logo gốc giữ nguyên trên chip trắng.

Desktop dành vùng giữa x15–85%, y12–48% cho logo/tiêu đề/thông tin và y50–62% cho CTA. Mobile dành x8–92%, y8–40% cho nội dung, y42–60% cho CTA/số check-in; người chạy ở y70–92%. Sân khấu dành x3–70%, y4–25% cho tiêu đề runtime, x72–97% cho QR và x12–88%, y28–85% cho nội dung trò chơi; ảnh sân khấu không có người chạy. Ribbon chỉ nằm ở rìa ảnh.

Ngày/địa điểm trống hiển thị `26.12.2026` và `METROPOLE, HCMC`; giá trị tùy chỉnh được giữ nguyên. Đây là fallback hiển thị và mặc định cho store mới, không phải migration dữ liệu đã lưu.


### Chuyển giao diện cũ / nhận diện Marketing mới

Dashboard → **Giao diện & sự kiện** → chọn **Giao diện cũ** (tiêu đề trái trên desktop, OTHER nhiều màu, slogan vàng, bố cục mobile cũ) hoặc **Nhận diện Marketing mới** (cyan/trắng, thông tin căn giữa) → **Lưu & áp dụng**. Lựa chọn cùng thông tin sự kiện chỉ được áp dụng sau khi lưu thành công. Chỉ BTC có quyền đổi; đây là cài đặt chung của sự kiện, không phải tùy chọn trình duyệt. Landing, vote và screen nhận qua SSE; bốc thăm nhận khi đang nghỉ, giữ nguyên lượt đua đang chạy. Chữ tùy chỉnh không bị thay đổi; vệt chéo O chỉ hiện trong preset Marketing với chủ đề THE OTHER WAY.

`settings.visualPreset` nhận đúng `legacy|official`, mặc định `official` để giữ giao diện HEAD khi nâng cấp. `appearanceBackgrounds` chứa hai bộ độc lập `{legacy: {bg,bgM,bgStage}, official: {bg,bgM,bgStage}}`; chuỗi rỗng dùng các asset mặc định hiện có. **Chưa có artwork Marketing mới được cung cấp; không có ảnh mới được tạo hoặc thay thế.** Khi nâng cấp dữ liệu chưa có `appearanceBackgrounds`, cả hai bộ được khởi tạo một lần từ ba URL đang lưu (kể cả rỗng). Không thể xác định ảnh từng tải thuộc bộ cũ hay mới, nên giữ lại ở cả hai bộ, không tự đoán hoặc loại bỏ. Khi trường versioned đã tồn tại, normalize chỉ làm sạch cấu trúc/URL không hợp lệ; không lấy lại URL cũ để lấp slot đã reset. Các bộ không chia sẻ object tham chiếu.

Mục **Ảnh nền · Đang áp dụng** luôn sửa bộ đã áp dụng, kể cả khi selector đang có lựa chọn chưa lưu. Upload/reset chỉ đổi đúng slot của bộ đó; upload đang chạy giữ preset đích ban đầu khi đổi giao diện giữa chừng. Thay đổi thông tin chưa lưu được bảo vệ khỏi refresh dữ liệu khi upload hoàn tất. Chuyển qua lại giữ ảnh của mỗi bộ, reset một slot không ảnh hưởng bộ còn lại. API admin hiện có nhận `visualPreset` để chuyển; gửi thêm `backgroundPreset` để nhắm đích upload/reset, không chuyển giao diện đang áp dụng. URL nền chỉ nhận `/uploads/[\w.-]+`; URL ngoài/data không được dùng. API public chỉ trả `visualPreset` và bộ `bg/bgM/bgStage` hiệu lực; admin nhận cả hai bộ. Ba trường nền cũ luôn được đồng bộ theo preset áp dụng để tương thích client cũ. JSON và PostgreSQL JSONB dùng chung normalize/lưu dữ liệu.

Kiểm tra local: `npm test` (node:test, server tích hợp dùng DATA_DIR tạm và vô hiệu hóa cấu hình DB; PostgreSQL dùng mock Pool, không kết nối DB thật). Chưa có bằng chứng visual bằng browser do môi trường thiếu libglib2; cần kiểm tra thủ công desktop/mobile và sân khấu 1600×900 khi có trình duyệt phù hợp.
