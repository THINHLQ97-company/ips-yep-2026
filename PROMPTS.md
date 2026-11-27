# Resize bộ nhận diện chính thức — IPS YEP 2026

## Cách dùng và nguyên tắc chung

Đính kèm **ảnh key visual chính thức do Marketing cung cấp** cho từng prompt bên dưới. Đây là yêu cầu **chỉnh sửa / tái bố cục / mở rộng ảnh tham chiếu**, không phải sáng tạo bộ nhận diện mới.

Ba vị trí tải ảnh tại **Dashboard → Giao diện & sự kiện → Ảnh nền**:

| Vị trí | Kích thước xuất | Tỷ lệ | File mặc định tương ứng |
|---|---|---|---|
| Nền trang check-in — máy tính | 1920 × 1080 px | 16:9 | `images/bg-desktop.webp` |
| Nền điện thoại | 1080 × 1920 px | 9:16 | `images/bg-mobile.webp` |
| Nền màn hình sân khấu | 1920 × 1080 px | 16:9 | `images/bg-stage.webp` |

**Không kéo giãn, không chỉ crop ảnh ngang thành ảnh dọc.** Khi đổi tỷ lệ, cần mở rộng nền (outpaint) và bố trí lại các lớp hình. Các tọa độ phần trăm bên dưới tính từ mép trái và mép trên của ảnh đầu ra.

### Quan trọng: xuất bản nền, không xuất nguyên poster

Website đã có logo, tiêu đề, slogan, ngày/địa điểm và các nút tương tác bằng HTML. Vì vậy **cả ba ảnh phải không chứa chữ, logo và watermark**. Nếu giữ chữ từ poster trong ảnh, website sẽ bị lặp chữ và có thể cắt mất logo khi hiển thị trên màn hình khác tỷ lệ.

Giữ phong cách của ảnh chính thức: xanh midnight navy / xanh điện, dải lụa đỏ-hồng magenta, đường sáng cyan phối cảnh, đô thị trừu tượng và nhóm người chạy. Không đổi thành phong cách hoạt hình, không thêm pháo hoa, đèn lồng hay biểu tượng mới. Việc loại bỏ chữ/logo chỉ áp dụng cho **bản nền web dẫn xuất**, không sửa file nhận diện gốc của Marketing.

Chữ được code hiển thị:
- `THE OTHER WAY`: cyan, nhấn mạnh `OTHER`.
- `MỞ LỐI ĐI RIÊNG`: trắng.
- `26.12.2026` và `METROPOLE, HCMC`: trắng; vẫn sửa được trong Dashboard.
- Logo: dùng file logo hiện có, không yêu cầu AI vẽ lại. Font HTML là bản phối phù hợp với KV, không khẳng định trùng font gốc. Nếu cần khớp tuyệt đối, Marketing cung cấp font được phép dùng và logo vector/PNG trong suốt.

## 1. Nền máy tính — 1920 × 1080 px

Copy toàn bộ prompt và đính kèm ảnh chính thức:

```text
Hãy CHỈNH SỬA ảnh key visual IPS Year End Party 2026 tôi đính kèm thành một bản NỀN WEBSITE ngang, kích thước chính xác 1920 × 1080 px, tỷ lệ 16:9.

Đây là tái bố cục nhận diện đã được Marketing duyệt, KHÔNG phải thiết kế concept mới. Giữ sát màu sắc, ánh sáng, chất liệu và ngôn ngữ đồ họa của ảnh tham chiếu: nền midnight navy/xanh điện, các dải lụa đỏ và hồng magenta mềm ở mép, mặt đường phối cảnh cyan sáng, cụm kiến trúc tương lai và nhóm 5 bóng người đang chạy. Không đổi sang 3D hoạt hình, không thêm pháo hoa/đèn lồng/confetti.

XÓA sạch toàn bộ chữ và logo trong ảnh tham chiếu, gồm logo IPS, tagline dưới logo, THE OTHER WAY, MỞ LỐI ĐI RIÊNG, ngày và địa điểm. Phục hồi nền phía sau một cách liền mạch. Không thêm chữ/logo thay thế. Website sẽ chèn các nội dung đó bằng HTML.

Bố cục cho đúng vùng sử dụng:
- 12% phía trên: nền navy dịu, ít chi tiết để đặt menu.
- Vùng trung tâm từ x=15–85%, y=12–48%: khoảng âm navy sạch, tương phản thấp; dành cho logo, tiêu đề, slogan và ngày/địa điểm bằng HTML. Không đặt lụa sáng, tòa nhà hay đầu người ở đây.
- Vùng x=15–85%, y=50–62%: nền yên, đủ tối để đặt nút check-in/bình chọn và số người tham dự; KHÔNG vẽ nút.
- Đặt nhóm 5 người chạy và skyline vào phần dưới, chủ yếu y=68–94%, trong x=25–75%. Giữ người đầy đủ, không cắt đầu/chân; giữ đường sáng và bóng đổ phối cảnh.
- Dải lụa đỏ/magenta nằm chủ yếu ở hai mép ngoài, không băng qua vùng chữ ở giữa. Không làm biến dạng motif.
- Chi tiết quan trọng cách mép tối thiểu 6% để nền còn dùng được khi website crop nhẹ theo màn hình.

Giữ ảnh sắc nét, không kéo giãn, không viền, không mockup thiết bị. Xuất một ảnh hoàn chỉnh 1920 × 1080 px, ưu tiên PNG chất lượng cao. Không chữ, không logo, không watermark.
```

## 2. Nền điện thoại — 1080 × 1920 px

```text
Dùng ảnh key visual IPS Year End Party 2026 đính kèm làm nguồn duy nhất về art direction. Hãy tạo bản NỀN WEBSITE DỌC kích thước chính xác 1080 × 1920 px, tỷ lệ 9:16, bằng cách tái bố cục và mở rộng nền.

KHÔNG kéo giãn ảnh ngang, KHÔNG chỉ crop giữa ảnh làm mất nhân vật. Giữ màu midnight navy/xanh điện, lụa đỏ-hồng magenta, mặt đường sáng cyan, kiến trúc trừu tượng và nhóm 5 bóng người chạy theo đúng phong cách, ánh sáng và chất liệu của ảnh gốc. Không tạo concept mới, không đổi thành hoạt hình.

Loại bỏ toàn bộ chữ và logo có sẵn: IPS/tagline, THE OTHER WAY, MỞ LỐI ĐI RIÊNG, ngày và địa điểm. Retouch nền liền mạch, không để bóng chữ cũ. Bản xuất là nền không chữ; website sẽ tự hiển thị logo và chữ sắc nét.

Bố cục bắt buộc cho màn hình điện thoại:
- y=0–8%: tối, ít chi tiết, đủ khoảng cho menu ở góc trên trái.
- x=8–92%, y=8–40%: nền navy sạch để HTML đặt logo, THE OTHER WAY, slogan và ngày/địa điểm ở giữa. Không đặt đầu người, tòa nhà hoặc dải lụa sáng trong vùng này.
- x=8–92%, y=42–60%: khoảng trống navy yên để đặt các nút check-in/bình chọn và số người tham dự. KHÔNG vẽ nút, chữ hay bảng vào ảnh.
- Nhóm 5 người chạy nằm chủ yếu y=70–92%, gom gọn trong x=15–85%; giữ đủ đầu/chân và cảm giác chuyển động. Skyline thấp phía sau; điểm tụ đường cyan khoảng y=70–78%.
- Dùng lụa đỏ/magenta để dẫn mắt dọc hai mép ảnh, không đè lên các vùng trống ở giữa. Kéo dài đường cyan phối cảnh xuống phần dưới, tạo chiều sâu.
- Giữ vùng an toàn ít nhất 6% quanh mép; tránh điểm sáng trắng quá mạnh ngay sau vùng nút.

Xuất một ảnh dọc 1080 × 1920 px, ưu tiên PNG chất lượng cao, không viền, không khung điện thoại, không chữ, không logo, không watermark.
```

## 3. Nền sân khấu LED — 1920 × 1080 px

```text
Từ ảnh key visual IPS Year End Party 2026 đính kèm, hãy tạo một bản NỀN SÂN KHẤU ĐỘNG cho website bình chọn và bốc thăm, kích thước chính xác 1920 × 1080 px, tỷ lệ 16:9.

Giữ ngôn ngữ nhận diện chính thức: midnight navy/xanh điện, lụa đỏ-hồng magenta ở rìa, các đường sáng cyan phối cảnh và đô thị trừu tượng. Đây là chuyển thể nền để dữ liệu realtime được vẽ phía trước, KHÔNG phải poster đầy đủ và không sáng tạo một phong cách mới.

Xóa toàn bộ logo và chữ có sẵn, kể cả IPS/tagline, THE OTHER WAY, slogan, ngày, địa điểm. Đồng thời loại bỏ nhóm người chạy và các khối đô thị lớn ở chính giữa để không bị nhầm với nhân vật/khối bình chọn do website vẽ động. Giữ các dấu hiệu nhận diện qua màu sắc, lụa, đường sáng và skyline rất thấp, mờ ở hai bên.

Vùng an toàn bắt buộc:
- x=3–70%, y=4–25%: nền navy sạch để website đặt logo, tiêu đề lượt bình chọn/bốc thăm và hướng dẫn.
- x=72–97%, y=4–25%: nền tối, ít chi tiết để đặt khối QR bình chọn và bộ đếm. KHÔNG vẽ sẵn QR hoặc bất cứ ô giao diện nào.
- x=12–88%, y=28–85%: khoảng trống tối và tương phản thấp dành cho các tòa tháp bình chọn 3D, bục giải hoặc đường đua realtime. Không có người, logo, tòa nhà nổi bật hay điểm sáng trắng ở giữa.
- Lụa đỏ/magenta tập trung tại rìa trái/phải và góc; không chạy ngang vùng dữ liệu trung tâm. Các đường cyan chạy mảnh, dịu ở mép dưới và hai bên.
- Giảm chi tiết tần số cao, tránh sọc quá mảnh dễ gây moiré trên LED. Giữ sắc độ navy có chi tiết, không bệt thành đen hoàn toàn; không dùng flare chói.
- Các motif chủ đạo cách mép ít nhất 5%; không viền.

Xuất một ảnh nền ngang 1920 × 1080 px, ưu tiên PNG chất lượng cao. Không chữ, không logo, không QR, không watermark, không mockup sân khấu.
```

## Xuất file, tải lên và nghiệm thu

1. Kiểm tra kích thước thật của file; công cụ tạo ảnh có thể không trả đúng số pixel dù prompt đã yêu cầu. Nếu cần, scale đồng tỷ lệ rồi crop/pad ở vùng nền, không kéo giãn.
2. Có thể tải PNG/JPEG/WebP trực tiếp lên Dashboard; nếu thay file trong repo, chuyển thành WebP và giữ đúng tên file ở bảng trên.
3. Giữ file gốc chất lượng cao riêng; tránh nén mạnh gây banding trên nền xanh và răng cưa ở lụa/nhân vật.
4. Kiểm tra desktop 1366 × 768, 1920 × 1080 và điện thoại rộng 320/375/390 px. Logo/chữ do HTML hiển thị một lần; nút không che người chạy; chữ không bị crop.
5. Kiểm tra `/screen/` và tab Bốc thăm: tiêu đề, QR, tháp, bục và mã số phải đọc rõ trên nền mới.
6. Ảnh hiện có **không tự được thay** chỉ vì cập nhật prompt/code; cần tải ba ảnh đã xuất vào đúng ba ô hoặc thay file mặc định rồi triển khai code.

## Ảnh khác (không thuộc ba vị trí đang thay)

`images/og.jpg` là ảnh chia sẻ link riêng (1200 × 630 px). Nếu dùng poster chính thức cho vị trí này, xuất bản dẫn xuất riêng, giữ logo/chữ trong vùng an toàn và không dùng ảnh nền không chữ thay cho poster một cách mặc định. Ảnh sản phẩm giải thưởng tiếp tục quản lý tại Dashboard → Giải thưởng, không đổi trong đợt này.
