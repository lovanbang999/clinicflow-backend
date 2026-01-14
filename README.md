# ClinicFlow Backend API

<p align="center">
  <strong>Smart Clinic Appointment & Queue Management System</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11.0.1-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-7.2.0-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma" />
</p>

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Authentication & Authorization](#authentication--authorization)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## About

**ClinicFlow Backend** is a RESTful API built with NestJS that powers a smart clinic appointment management system. It provides comprehensive features for managing doctor schedules, patient bookings, intelligent queue management, and role-based access control for clinics with multiple healthcare professionals.

**Target Users:**
- **Patients** - Book appointments online 24/7
- **Doctors** - Manage schedules and patient appointments
- **Receptionists** - Handle check-ins and queue management
- **Administrators** - Manage users, services, and system configuration

---

## Key Features

### Authentication & User Management
- JWT-based authentication with access & refresh tokens
- Email verification with OTP (15-minute expiry)
- Role-based access control (PATIENT, DOCTOR, RECEPTIONIST, ADMIN)
- User profile management with avatar upload
- Doctor profiles with specialties, qualifications, and experience

### Smart Scheduling
- Flexible doctor working hours (weekly schedules)
- Break time management (lunch breaks, meetings)
- Off-day tracking (vacations, holidays)
- Intelligent available slot calculation
- Conflict detection and validation

### Appointment Booking
- Real-time booking with slot availability checking
- 8-state booking workflow (PENDING → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED)
- Automatic cancellation handling
- Booking history with status change tracking
- Multi-criteria filtering (date, doctor, service, status)

### Queue Management
- Automatic queuing when time slots are full
- Queue position tracking with estimated wait times
- Auto-promotion when slots become available
- Manual queue promotion by receptionists
- Real-time queue statistics

### Smart Suggestions
- AI-powered time slot recommendations
- Scoring algorithm based on:
  - Slot availability
  - Time preferences (morning/afternoon)
  - Doctor workload optimization
  - Historical booking patterns

### Service Management
- CRUD operations for clinic services
- Service configuration (duration, price, capacity)
- Icon upload for services (Cloudinary integration)
- Service-doctor assignment

### Notifications
- Email notifications for:
  - Account verification
  - Booking confirmations
  - Queue status updates
  - Appointment reminders

### File Upload
- Cloudinary integration for image storage
- User avatar upload
- Service icon management
- Multiple format support (JPEG, PNG, GIF, WebP)

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|----------|
| **NestJS** | 11.0.1 | Backend framework |
| **TypeScript** | 5.7.3 | Programming language |
| **PostgreSQL** | 17+ | Primary database |
| **Prisma** | 7.2.0 | ORM & database toolkit |
| **Passport JWT** | 10.0.0 | Authentication strategy |
| **class-validator** | 0.14.1 | DTO validation |
| **Nodemailer** | 7.0.12 | Email service |
| **Cloudinary** | 2.8.0 | Image upload & storage |
| **Swagger/OpenAPI** | 8.0.7 | API documentation |
| **Jest** | 29.7.0 | Testing framework |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or higher) - [Download](https://nodejs.org/)
- **Yarn** (v1.22.x or higher) - `npm install -g yarn`
- **PostgreSQL** (v14+ recommended) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

**Optional:**
- **Docker** - For containerized PostgreSQL
- **Prisma Studio** - GUI for database inspection (included with Prisma)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ClinicFlow/backend
```

### 2. Install Dependencies

```bash
yarn install
```

This will install all required packages including NestJS, Prisma, and development tools.

---

## Environment Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/smart_clinic_db"

# Server
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_too
JWT_REFRESH_EXPIRES_IN=30d

# Email Configuration (Gmail example)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=youremail@gmail.com
MAIL_PASSWORD=your_app_specific_password
MAIL_FROM="Smart Clinic <youremail@gmail.com>"

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDIARY_FOLDER=smart_clinic
```

### Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `PORT` | API server port | `8080` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `JWT_SECRET` | Secret for access tokens | Strong random string |
| `JWT_EXPIRES_IN` | Access token expiry | `7d` (7 days) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Different strong random string |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `30d` (30 days) |
| `MAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) |
| `MAIL_USER` | Email account username | Your email address |
| `MAIL_PASSWORD` | Email account password | App-specific password |
| `MAIL_FROM` | Sender email with name | `"Clinic <email@example.com>"` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | From Cloudinary dashboard |
| `CLOUDIARY_FOLDER` | Upload folder name | `smart_clinic` |

### Gmail Setup Instructions

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to [Google Account Settings](https://myaccount.google.com/security)
   - Navigate to **Security** → **2-Step Verification** → **App passwords**
   - Generate a new app password for "Mail"
   - Use this password in `MAIL_PASSWORD`

---

## Database Setup

### Option 1: Local PostgreSQL

#### 1. Create Database

```bash
# Using psql
psql -U postgres
CREATE DATABASE smart_clinic_db;
\q
```

#### 2. Run Migrations

```bash
yarn prisma:migrate
```

This applies all database migrations and creates the schema.

#### 3. Seed Database (Optional)

Populate the database with demo data:

```bash
yarn prisma:seed
```

**Demo Users Created:**
- **Admin**: `admin@clinic.com` / `Admin@123`
- **Doctor**: `doctor@clinic.com` / `Doctor@123`
- **Receptionist**: `receptionist@clinic.com` / `Reception@123`
- **Patient**: `patient@clinic.com` / `Patient@123`

### Option 2: Docker PostgreSQL

```bash
# Start PostgreSQL container
docker run --name clinic-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=smart_clinic_db \
  -p 5432:5432 \
  -d postgres:17

# Then run migrations
yarn prisma:migrate
yarn prisma:seed
```

### View Database (Prisma Studio)

Open a GUI to browse and edit database records:

```bash
yarn prisma:studio
```

This opens a browser at `http://localhost:5555`.

---

## Running the Application

### Development Mode (with hot reload)

```bash
yarn start:dev
```

The API will be available at `http://localhost:8080`.

### Production Build

```bash
# Build the application
yarn build

# Start production server
yarn start:prod
```

### Watch Mode (no hot reload)

```bash
yarn start
```

---

## API Documentation

Interactive API documentation is available via **Swagger UI**:

**[http://localhost:8080/api-docs](http://localhost:8080/api-docs)**

The Swagger documentation provides:
- Complete endpoint reference
- Request/response schemas
- Authentication requirements
- Try-it-out functionality
- Model definitions

### Quick API Overview

| Module | Base Path | Description |
|--------|-----------|-------------|
| Authentication | `/api/auth` | Register, login, verify email, refresh tokens |
| Users | `/api/users` | User management, profiles, doctors list |
| Services | `/api/services` | Clinic services CRUD |
| Schedules | `/api/schedules` | Doctor working hours, breaks, off days, available slots |
| Bookings | `/api/bookings` | Create, view, update, cancel appointments |
| Queue | `/api/queue` | Queue management, promotion, statistics |
| Suggestions | `/api/suggestions` | Smart time slot recommendations |
| Upload | `/api/upload` | File upload (avatars, service icons) |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Database seeding script
│   └── migrations/            # Migration history
├── src/
│   ├── main.ts                # Application entry point
│   ├── app.module.ts          # Root module
│   ├── common/                # Shared utilities
│   │   ├── constants/         # Constants (roles, statuses, messages)
│   │   ├── decorators/        # Custom decorators (@CurrentUser, @Roles)
│   │   ├── exceptions/        # Custom exceptions
│   │   ├── filters/           # Exception filters
│   │   ├── guards/            # Auth guards (JWT, Roles)
│   │   ├── interceptors/      # Request/response interceptors
│   │   ├── interfaces/        # Shared interfaces
│   │   └── pipes/             # Validation pipes
│   ├── config/                # Configuration files
│   │   ├── app.config.ts      # App settings
│   │   ├── database.config.ts # Database connection
│   │   └── jwt.config.ts      # JWT configuration
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication & authorization
│   │   ├── users/             # User management
│   │   ├── services/          # Clinic services
│   │   ├── schedules/         # Doctor schedules
│   │   ├── bookings/          # Appointment bookings
│   │   ├── queue/             # Queue management
│   │   ├── suggestions/       # Smart suggestions
│   │   ├── notifications/     # Email notifications
│   │   ├── upload/            # File uploads
│   │   └── prisma/            # Prisma service
│   └── providers/             # External service providers
│       └── cloudinary.provider.ts
├── test/                      # E2E tests
├── .env                       # Environment variables (create this)
├── .env.example               # Example environment file
├── nest-cli.json              # NestJS CLI configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

---

## Authentication & Authorization

### Authentication Flow

1. **Registration**:
   ```
   POST /api/auth/register → Creates user → Sends OTP via email
   POST /api/auth/verify-email → Verifies OTP → Activates account
   ```

2. **Login**:
   ```
   POST /api/auth/login → Returns access token + refresh token
   ```

3. **Token Refresh**:
   ```
   POST /api/auth/refresh → Returns new access token
   ```

4. **Protected Endpoints**:
   ```
   Authorization: Bearer <access_token>
   ```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **PATIENT** | Book appointments, view own bookings, update profile |
| **DOCTOR** | View appointments, update booking status, manage own schedule |
| **RECEPTIONIST** | Manage all bookings, check-in patients, manage queue |
| **ADMIN** | Full access - manage users, services, view all data |

### Security Features

- JWT with refresh token rotation
- Password hashing with bcrypt
- Email verification with OTP
- Rate limiting (recommended to add)
- CORS configuration
- Input validation with class-validator
- SQL injection prevention (Prisma ORM)
- XSS protection

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Development** | `yarn start:dev` | Start with hot reload |
| **Build** | `yarn build` | Compile TypeScript to JavaScript |
| **Production** | `yarn start:prod` | Run compiled production build |
| **Watch** | `yarn start` | Start without hot reload |
| **Lint** | `yarn lint` | Run ESLint |
| **Format** | `yarn format` | Format code with Prettier |
| **Test** | `yarn test` | Run unit tests |
| **Test E2E** | `yarn test:e2e` | Run end-to-end tests |
| **Test Coverage** | `yarn test:cov` | Generate coverage report |
| **Prisma Migrate** | `yarn prisma:migrate` | Run database migrations |
| **Prisma Generate** | `yarn prisma:generate` | Generate Prisma Client |
| **Prisma Seed** | `yarn prisma:seed` | Seed database with demo data |
| **Prisma Studio** | `yarn prisma:studio` | Open Prisma Studio GUI |
| **Prisma Reset** | `yarn prisma:reset` | Reset database (deletes all data) |

---

## Testing

### Run Unit Tests

```bash
yarn test
```

### Run E2E Tests

```bash
yarn test:e2e
```

### Generate Coverage Report

```bash
yarn test:cov
```

### Test with Watch Mode

```bash
yarn test:watch
```

---

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # Linux/Mac
   sudo systemctl status postgresql
   
   # Or check with psql
   psql -U postgres -c "SELECT version();"
   ```

2. Check `DATABASE_URL` in `.env`:
   - Correct format: `postgresql://username:password@host:port/database`
   - Verify credentials, host, and port

3. Test connection:
   ```bash
   yarn prisma db pull
   ```

### Migration Issues

**Error**: `Migration failed`

**Solutions**:
```bash
# Reset database (deletes all data)
yarn prisma:reset

# Or manually drop and recreate
psql -U postgres -c "DROP DATABASE smart_clinic_db;"
psql -U postgres -c "CREATE DATABASE smart_clinic_db;"
yarn prisma:migrate
```

### Email Sending Issues

**Error**: `Invalid login: 535 Authentication failed`

**Solutions**:
1. Enable 2FA and create App Password (see [Gmail Setup](#-gmail-setup-instructions))
2. Use correct SMTP settings:
   - Gmail: `smtp.gmail.com:587` (TLS)
   - Outlook: `smtp-mail.outlook.com:587`
3. Check firewall/antivirus blocking port 587

### Port Already in Use

**Error**: `Port 8080 is already in use`

**Solutions**:
```bash
# Find process using port 8080
lsof -i :8080          # Mac/Linux
netstat -ano | findstr :8080  # Windows

# Kill the process or change PORT in .env
PORT=8081
```

### Cloudinary Upload Issues

**Error**: `Upload failed`

**Solutions**:
1. Verify credentials in `.env`
2. Check Cloudinary dashboard for API limits
3. Ensure file size < 10MB (default limit)
4. Verify supported formats: JPEG, PNG, GIF, WebP

### Prisma Client Issues

**Error**: `Prisma Client could not locate the Query Engine`

**Solution**:
```bash
yarn prisma generate
```

---

## License

This project is part of the ClinicFlow system. See the root LICENSE file for details.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

For issues and questions:
- Create an issue in the repository
- Check the [API Documentation](http://localhost:8080/api-docs)
- Review the [Project Documentation](../docs/)

---

**Built with ❤️ using NestJS**
