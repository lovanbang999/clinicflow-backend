# Đồ án: Hệ thống Quản lý Đặt lịch khám và Xếp hàng thông minh (SmartClinic) - Backend API

Dự án này là phân hệ **Backend API** của hệ thống **SmartClinic** (Hệ thống Quản lý Đặt lịch khám và Xếp hàng thông minh). Hệ thống được thiết kế nhằm tối ưu hóa quy trình tiếp đón, đặt lịch và quản lý hàng đợi tại các phòng khám đa khoa, giúp giảm thiểu thời gian chờ đợi của bệnh nhân và nâng cao hiệu suất làm việc của đội ngũ y bác sĩ.

---

## 📝 Mục lục
- [1. Giới thiệu đề tài](#1-giới-thiệu-đề-tài)
- [2. Kiến trúc & Công nghệ sử dụng](#2-kiến-trúc--công-nghệ-sử-dụng)
- [3. Phân hệ chức năng cốt lõi](#3-phân-hệ-chức-năng-cốt-lõi)
- [4. Cấu trúc thư mục dự án](#4-cấu-trúc-thư-mục-dự-án)
- [5. Hướng dẫn cài đặt & Cấu hình](#5-hướng-dẫn-cài-đặt--cấu-hình)
- [6. Khởi tạo Cơ sở dữ liệu](#6-khởi-tạo-cơ-sở-dữ-liệu)
- [7. Hướng dẫn chạy ứng dụng](#7-hướng-dẫn-chạy-ứng-dụng)
- [8. Danh sách tài khoản thử nghiệm](#8-danh-sách-tài-khoản-thử-nghiệm)
- [9. Tài liệu API (Swagger UI)](#9-tài-liệu-api-swagger-ui)
- [10. Quy trình nghiệp vụ chính](#10-quy-trình-nghiệp-vụ-chính)

---

## 1. Giới thiệu đề tài

### Đặt vấn đề
Quy trình khám chữa bệnh truyền thống thường gặp bất cập lớn trong việc xếp hàng chờ đợi và phân phối lịch khám của bác sĩ. Bệnh nhân mất nhiều thời gian chờ đợi tại phòng khám, trong khi bác sĩ có thể rơi vào tình trạng quá tải cục bộ ở một số khung giờ.

### Giải pháp của SmartClinic
SmartClinic giải quyết triệt để các vấn đề trên thông qua:
1. **Đặt lịch khám linh hoạt:** Cho phép bệnh nhân chọn dịch vụ, bác sĩ và khung giờ trực tuyến.
2. **Đề xuất lịch khám thông minh (Smart Suggestions):** Thuật toán gợi ý khung giờ trống tối ưu dựa trên lịch làm việc của bác sĩ và tải lượng hiện tại của hệ thống.
3. **Quản lý hàng đợi thời gian thực (Real-time Queue Management):** Hệ thống tự động phân loại, xếp số thứ tự, dự báo thời gian chờ và tự động thăng hạng (auto-promotion) khi có chỗ trống.

---

## 2. Kiến trúc & Công nghệ sử dụng

Phân hệ Backend được xây dựng theo **Kiến trúc phân lớp (Layered Architecture)** kết hợp với **Repository Pattern** và **lightweight CQRS (Command Query Responsibility Segregation)** nhằm đảm bảo tính dễ mở rộng, bảo trì và hiệu năng cao.

### Công nghệ sử dụng (Tech Stack)
- **Framework chính:** [NestJS (v11.0.1)](https://nestjs.com/) - Framework Node.js hướng đối tượng mạnh mẽ, hỗ trợ Dependency Injection.
- **Ngôn ngữ:** [TypeScript (v5.7.3)](https://www.typescriptlang.org/) - Tăng cường kiểm soát kiểu dữ liệu tĩnh chặt chẽ.
- **Cơ sở dữ liệu chính:** [PostgreSQL (v17+)](https://www.postgresql.org/) - Hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ, tin cậy.
- **ORM & Database Toolkit:** [Prisma (v7.2.0)](https://www.prisma.io/) - Hỗ trợ thiết kế schema rõ ràng, sinh type-safe queries tự động.
- **Caching & Real-time Queue:** [Redis](https://redis.io/) - Lưu trữ hàng đợi tạm thời và xử lý các tác vụ thời gian thực tốc độ cao.
- **Xác thực & Ủy quyền:** Passport JWT (Access Token & Rotate Refresh Token).
- **Tích hợp bên thứ 3:** 
  - **Cloudinary:** Quản lý và lưu trữ tài nguyên hình ảnh (avatar người dùng, icon dịch vụ).
  - **Nodemailer / Resend:** Gửi email xác thực tài khoản và mã OTP.
- **Tài liệu hóa:** Swagger/OpenAPI phục vụ việc kiểm thử endpoints trực quan.

---

## 3. Phân hệ chức năng cốt lõi

### 🔐 1. Xác thực & Phân quyền (Authentication & Authorization)
- Đăng ký tài khoản, đăng nhập cấp cặp token: Access Token (hạn ngắn) & Refresh Token (hạn dài, hỗ trợ cơ chế Rotation bảo mật).
- Cơ chế xác thực OTP qua email (thời gian hết hạn 15 phút) bảo vệ luồng đăng ký.
- Phân quyền theo vai trò chặt chẽ (Role-Based Access Control - RBAC) sử dụng Custom Guards:
  - `PATIENT` (Bệnh nhân)
  - `DOCTOR` (Bác sĩ)
  - `RECEPTIONIST` (Tiếp tân)
  - `ADMIN` (Quản trị viên)

### 📅 2. Quản lý Lịch làm việc của Bác sĩ (Smart Scheduling)
- Thiết lập khung giờ làm việc cố định theo tuần cho từng bác sĩ.
- Quản lý thời gian nghỉ giữa ca (lunch breaks, meetings) và lịch nghỉ phép (vacations, holidays).
- Thuật toán kiểm tra xung đột thời gian thực và tự động tính toán các slot trống khả dụng (available slots).

### 🩺 3. Đặt lịch khám (Appointment Booking)
- Quy trình đặt lịch y tế chuẩn 8 trạng thái (Booking State Machine):
  `PENDING (Chờ xác nhận) → CONFIRMED (Đã xác nhận) → CHECKED_IN (Đã check-in tại quầy) → IN_PROGRESS (Đang khám) → COMPLETED (Hoàn thành)`
  (Hỗ trợ các trạng thái hủy: `CANCELLED`, vắng mặt: `NO_SHOW`).
- Kiểm tra trùng lặp và giữ chỗ tạm thời tránh tình trạng đặt trùng (double-booking).
- Lưu vết toàn bộ lịch sử thay đổi trạng thái của lịch hẹn (Booking History Tracking).

### 🚶‍♂️ 4. Quản lý Hàng đợi Thông minh (Queue Management)
- Tự động cấp số thứ tự (STT) khi bệnh nhân Check-in hoặc tự động đẩy vào hàng đợi chờ duyệt khi các slot chính đã đầy.
- Tính toán thời gian chờ đợi ước tính dựa trên tốc độ xử lý trung bình của phòng khám.
- Hỗ trợ Tiếp tân thao tác thủ công: Đổi thứ tự ưu tiên (cấp cứu), gọi số tiếp theo, hoặc bỏ qua số (no-show).

### 💡 5. Đề xuất Khung giờ Thông minh (Smart Suggestions)
- Thuật toán chấm điểm và gợi ý các khung giờ khám tối ưu cho bệnh nhân dựa trên:
  - Trạng thái trống của bác sĩ.
  - Tải lượng công việc hiện tại của bác sĩ (workload optimization).
  - Khoảng thời gian yêu thích của bệnh nhân (sáng/chiều).
  - Lịch sử đặt khám trước đó.

### 💼 6. Quản lý Danh mục Dịch vụ & Y tế (Service Management)
- CRUD danh mục dịch vụ khám (tên, giá tiền, thời gian khám mặc định, giới hạn lượt khám).
- Liên kết dịch vụ với danh sách bác sĩ chuyên khoa phụ trách.

---

## 4. Cấu trúc thư mục dự án

Mã nguồn được cấu trúc module hóa chuẩn NestJS, tách biệt rõ ràng giữa logic nghiệp vụ (Service), truy cập dữ liệu (Repository) và giao tiếp ngoại vi (Controller).

```
backend/
├── prisma/
│   ├── schema.prisma          # Định nghĩa Database Schema (PostgreSQL)
│   ├── seed.ts                # Script khởi tạo dữ liệu mẫu (Seeding)
│   └── migrations/            # Lịch sử các phiên bản migration DB
├── src/
│   ├── main.ts                # File khởi chạy ứng dụng (Entry point)
│   ├── app.module.ts          # Module gốc của ứng dụng
│   ├── common/                # Các thành phần dùng chung toàn hệ thống
│   │   ├── constants/         # Định nghĩa hằng số (Role, Status, Messages)
│   │   ├── decorators/        # Custom Decorators (@CurrentUser, @Roles,...)
│   │   ├── exceptions/        # Lớp bắt lỗi tùy chỉnh
│   │   ├── filters/           # Lớp lọc ngoại lệ (Exception Filters)
│   │   ├── guards/            # Bảo vệ endpoint (JWT AuthGuard, RolesGuard)
│   │   ├── interceptors/      # Transform dữ liệu request/response
│   │   └── pipes/             # Validation Pipes kiểm tra kiểu dữ liệu DTO
│   ├── config/                # Cấu hình hệ thống (App, Database, JWT, Mail)
│   ├── modules/               # Các module chức năng nghiệp vụ độc lập
│   │   ├── auth/              # Xác thực, cấp phát token, OTP
│   │   ├── users/             # Quản lý người dùng & Profile bác sĩ/bệnh nhân
│   │   ├── services/          # Quản lý danh mục dịch vụ khám bệnh
│   │   ├── schedules/         # Thiết lập & tính toán lịch trình bác sĩ
│   │   ├── bookings/          # Xử lý luồng đặt lịch khám
│   │   ├── queue/             # Quản lý hàng đợi và thời gian thực
│   │   ├── suggestions/       # Thuật toán đề xuất khung giờ thông minh
│   │   ├── notifications/     # Module gửi mail thông báo
│   │   ├── upload/            # Tải tệp tin lên Cloudinary
│   │   └── prisma/            # Kết nối Prisma ORM Client
│   └── providers/             # Các Provider tích hợp bên thứ ba (Cloudinary)
├── test/                      # Thư mục kiểm thử E2E
├── .env                       # File cấu hình môi trường (Cần tạo)
├── .env.example               # File cấu hình môi trường mẫu
├── nest-cli.json              # Cấu hình NestJS CLI
├── package.json               # Quản lý thư viện phụ thuộc & scripts
└── tsconfig.json              # Cấu hình biên dịch TypeScript
```

---

## 5. Hướng dẫn cài đặt & Cấu hình

### Yêu cầu hệ thống
- **Node.js**: Phiên bản 18.x trở lên.
- **Yarn**: Quản lý gói phụ thuộc (`npm install -g yarn`).
- **PostgreSQL**: Phiên bản 14 trở lên (hoặc chạy qua Docker).
- **Redis**: Phục vụ hàng đợi thời gian thực.

### Các bước cài đặt

#### 1. Tải mã nguồn về máy
```bash
git clone <repository-url>
cd SmartClinic/backend
```

#### 2. Cài đặt các gói phụ thuộc
```bash
yarn install
```

#### 3. Cấu hình biến môi trường
Tạo file `.env` bằng cách sao chép từ `.env.example`:
```bash
cp .env.example .env
```

Mở file `.env` và thiết lập các thông số kết nối:
```env
# Database kết nối PostgreSQL
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/smart_clinic_db?schema=public"

# Redis kết nối hàng đợi
REDIS_URL="redis://localhost:6379"

# Cấu hình Port chạy Server Backend
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Khóa bí mật mã hóa JWT (Thay đổi ở môi trường Production)
JWT_SECRET=smart_clinic_jwt_access_secret_key_2026
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=smart_clinic_jwt_refresh_secret_key_2026
JWT_REFRESH_EXPIRES_IN=30d

# Cấu hình gửi mail OTP bằng Gmail (Môi trường Development)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_gmail@gmail.com
MAIL_PASSWORD=your_app_specific_password  # Mật khẩu ứng dụng Gmail (App Password)
MAIL_FROM="SmartClinic <your_gmail@gmail.com>"

# Cấu hình gửi mail thông báo chuyên nghiệp (Môi trường Production)
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM="SmartClinic <noreply@yourdomain.com>"

# Cấu hình Cloudinary lưu ảnh tải lên
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDIARY_FOLDER=smart_clinic
```

*(Lưu ý: Để gửi được email qua Gmail, bạn cần bật Xác thực 2 bước trên tài khoản Google và tạo mật khẩu ứng dụng (App Password) tại cài đặt Bảo mật).*

---

## 6. Khởi tạo Cơ sở dữ liệu

### Trường hợp 1: Sử dụng PostgreSQL và Redis cài đặt trên máy
Khởi động service PostgreSQL và Redis trên hệ điều hành của bạn. Sau đó thực hiện Migration:

#### Chạy Migration để khởi tạo các bảng trong database:
```bash
npx prisma migrate dev --name init
```

#### Đẩy dữ liệu mẫu (Seed Data):
```bash
npx prisma db seed
```

### Trường hợp 2: Chạy PostgreSQL và Redis nhanh chóng qua Docker
Nếu bạn có cài đặt Docker, bạn có thể khởi chạy nhanh DB và Redis bằng lệnh:
```bash
# Khởi chạy Postgres container
docker run --name smartclinic-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=smart_clinic_db \
  -p 5432:5432 \
  -d postgres:17

# Khởi chạy Redis container
docker run --name smartclinic-redis -p 6379:6379 -d redis:alpine
```
Sau đó tiến hành chạy các lệnh `npx prisma migrate dev` và `npx prisma db seed` như ở trên.

---

## 7. Hướng dẫn chạy ứng dụng

### Chế độ phát triển (Development Mode - Hỗ trợ Hot Reload)
```bash
yarn start:dev
```
Server API sẽ được khởi chạy tại địa chỉ: **[http://localhost:8080](http://localhost:8080)**.

### Biên dịch dự án sang Production
```bash
# Build dự án
yarn build

# Chạy server sản phẩm đã build
yarn start:prod
```

### Xem dữ liệu trực quan qua Prisma Studio
Prisma cung cấp một giao diện web tiện lợi để quản lý dữ liệu nhanh mà không cần cài đặt các tool như pgAdmin:
```bash
npx prisma studio
```
Truy cập qua trình duyệt tại địa chỉ: **[http://localhost:5555](http://localhost:5555)**.

---

## 8. Danh sách tài khoản thử nghiệm

Dữ liệu seed mặc định sẽ tự động tạo ra các tài khoản với đầy đủ vai trò để Hội đồng kiểm thử hệ thống:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Quyền hạn chính |
|---------|-----------------|-------------------|-----------------|
| **ADMIN** | `admin@clinic.com` | `Admin@123` | Quản trị toàn hệ thống, cấu hình dịch vụ, người dùng |
| **DOCTOR** | `doctor@clinic.com` | `Doctor@123` | Quản lý ca trực, xem bệnh án, cập nhật trạng thái khám |
| **RECEPTIONIST** | `receptionist@clinic.com` | `Reception@123` | Check-in bệnh nhân tại quầy, quản lý điều phối hàng đợi |
| **PATIENT** | `patient@clinic.com` | `Patient@123` | Tìm kiếm bác sĩ, đặt lịch khám trực tuyến, xem STT hàng đợi |

---

## 9. Tài liệu API (Swagger UI)

Hệ thống tự động sinh tài liệu API chuẩn OpenAPI. Sau khi khởi chạy Server Backend, bạn có thể truy cập vào đường dẫn sau để xem danh sách endpoints, cấu trúc request/response chi tiết và test trực tiếp API:

👉 **[http://localhost:8080/api-docs](http://localhost:8080/api-docs)**

---

## 10. Quy trình nghiệp vụ chính

### Sơ đồ máy trạng thái Lịch hẹn (Booking State Machine)
```
[ Bệnh nhân Đặt lịch ]
          │
          ▼
     PENDING (Chờ xác nhận) ─────────────► CANCELLED (Đã hủy bởi BN/Hệ thống)
          │
          ▼ (Tiếp tân duyệt hoặc hệ thống tự động xác nhận)
     CONFIRMED (Đã xác nhận) ────────────► NO_SHOW (Bệnh nhân vắng mặt)
          │
          ▼ (Bệnh nhân đến phòng khám và Check-in)
     CHECKED_IN (Đã check-in, xếp hàng đợi)
          │
          ▼ (Bác sĩ gọi vào phòng khám)
     IN_PROGRESS (Đang trong ca khám)
          │
          ▼ (Bác sĩ hoàn thành khám bệnh)
     COMPLETED (Hoàn thành ca khám)
```

---
*Dự án thuộc đề tài Đồ án tốt nghiệp / Đồ án chuyên ngành.*
*Người thực hiện: Lò Văn Bằng - Mã số sinh viên: 2251061721*
*Giáo viên hướng dẫn: TS. Nguyễn Tu Trung*
