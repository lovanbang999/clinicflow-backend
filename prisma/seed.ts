import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  Gender,
  DayOfWeek,
  BookingSource,
  BookingPriority,
  RoomType,
  User,
  Service,
  PatientProfile,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Make sure .env is in the backend root (be/) or set DOTENV_CONFIG_PATH.',
  );
}

console.log('Using database URL:', databaseUrl);

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// Shared counter for patient codes & booking codes
let patientCodeCounter = 1;
let bookingCodeCounter = 1;

function generatePatientCode(): string {
  const code = `BN-2026-${String(patientCodeCounter).padStart(4, '0')}`;
  patientCodeCounter++;
  return code;
}

function generateBookingCode(dateStr: string): string {
  // dateStr format: YYYY-MM-DD
  const compact = dateStr.replace(/-/g, '');
  const code = `BK-${compact}-${String(bookingCodeCounter).padStart(4, '0')}`;
  bookingCodeCounter++;
  return code;
}

async function main() {
  console.log('🌱 Starting database seed v3.0...');

  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
  };

  // ============================================
  // 0. CLEAR ALL DATA (fresh seed)
  // ============================================
  console.log('\n🗑️  Clearing existing data...');

  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.labResult.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingQueue.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.doctorService.deleteMany();
  await prisma.doctorBreakTime.deleteMany();
  await prisma.doctorOffDay.deleteMany();
  await prisma.doctorScheduleSlot.deleteMany();
  await prisma.doctorWorkingHours.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.icd10Code.deleteMany();
  await prisma.service.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log('  ✅ All data cleared');

  // ============================================
  // 1. CREATE ROOMS
  // ============================================
  console.log('\n🏠 Creating rooms...');

  const roomsData = [
    {
      name: 'Phòng khám 101',
      type: RoomType.CONSULTATION,
      floor: '1',
      capacity: 1,
    },
    {
      name: 'Phòng khám 102',
      type: RoomType.CONSULTATION,
      floor: '1',
      capacity: 1,
    },
    {
      name: 'Phòng khám 201',
      type: RoomType.CONSULTATION,
      floor: '2',
      capacity: 1,
    },
    {
      name: 'Phòng khám 202',
      type: RoomType.CONSULTATION,
      floor: '2',
      capacity: 1,
    },
    {
      name: 'Phòng siêu âm 1',
      type: RoomType.ULTRASOUND,
      floor: '1',
      capacity: 2,
    },
    {
      name: 'Phòng siêu âm 2',
      type: RoomType.ULTRASOUND,
      floor: '2',
      capacity: 2,
    },
    { name: 'Phòng xét nghiệm', type: RoomType.LAB, floor: '1', capacity: 5 },
    {
      name: 'Phòng thủ thuật',
      type: RoomType.PROCEDURE,
      floor: '2',
      capacity: 2,
    },
    {
      name: 'Phòng chờ tầng 1',
      type: RoomType.WAITING,
      floor: '1',
      capacity: 20,
    },
    {
      name: 'Phòng chờ tầng 2',
      type: RoomType.WAITING,
      floor: '2',
      capacity: 20,
    },
  ];

  for (const roomData of roomsData) {
    await prisma.room.create({ data: roomData });
  }
  console.log(`  ✅ Created ${roomsData.length} rooms`);

  // ============================================
  // 2. CREATE USERS
  // ============================================
  console.log('\n👥 Creating users...');

  // ADMIN
  const admin = await prisma.user.create({
    data: {
      email: 'admin@clinic.com',
      password: await hashPassword('admin123'),
      role: UserRole.ADMIN,
      fullName: 'Quản Trị Viên Hệ Thống',
      phone: '0900000000',
      dateOfBirth: new Date('1985-01-15'),
      gender: Gender.MALE,
      address: '100 Nguyễn Huệ, Quận 1, TP.HCM',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('  ✅ Admin created:', admin.email);

  // DOCTORS WITH PROFILES
  const doctorsData = [
    {
      user: {
        email: 'bs.nguyenvana@clinic.com',
        fullName: 'BS. Nguyễn Văn An',
        phone: '0901111111',
        dateOfBirth: new Date('1975-03-20'),
        gender: Gender.MALE,
        address: '456 Lê Lợi, Quận 3, TP.HCM',
      },
      profile: {
        specialties: ['Nội tổng quát', 'Khám sức khỏe định kỳ'],
        qualifications: ['Bác sĩ CK1', 'Thạc sĩ Y khoa'],
        yearsOfExperience: 15,
        rating: 4.8,
        reviewCount: 120,
        bio: 'Bác sĩ có 15 năm kinh nghiệm trong lĩnh vực nội tổng quát, tận tâm với bệnh nhân',
      },
      serviceNames: [
        'Khám tổng quát',
        'Xét nghiệm',
        'Siêu âm tổng quát',
        'Nội soi',
      ],
    },
    {
      user: {
        email: 'bs.lethib@clinic.com',
        fullName: 'BS. Lê Thị Bình',
        phone: '0902222222',
        dateOfBirth: new Date('1980-07-10'),
        gender: Gender.FEMALE,
        address: '789 Trần Hưng Đạo, Quận 5, TP.HCM',
      },
      profile: {
        specialties: ['Tim mạch', 'Điều trị bệnh mạch vành'],
        qualifications: ['Bác sĩ CK2', 'Tiến sĩ Y khoa'],
        yearsOfExperience: 12,
        rating: 4.9,
        reviewCount: 89,
        bio: 'Chuyên gia tim mạch với 12 năm kinh nghiệm, từng tu nghiệp tại Nhật Bản',
      },
      serviceNames: ['Khám tim mạch', 'Xét nghiệm', 'Siêu âm tổng quát'],
    },
    {
      user: {
        email: 'bs.tranthic@clinic.com',
        fullName: 'BS. Trần Thị Cẩm',
        phone: '0903333333',
        dateOfBirth: new Date('1982-11-25'),
        gender: Gender.FEMALE,
        address: '321 Hai Bà Trưng, Quận 1, TP.HCM',
      },
      profile: {
        specialties: ['Da liễu', 'Thẩm mỹ da'],
        qualifications: ['Bác sĩ CK1', 'Chứng chỉ Thẩm mỹ Da'],
        yearsOfExperience: 10,
        rating: 4.7,
        reviewCount: 156,
        bio: 'Bác sĩ da liễu với chuyên môn sâu về điều trị mụn và thẩm mỹ da',
      },
      serviceNames: ['Khám da liễu', 'Xét nghiệm'],
    },
    {
      user: {
        email: 'bs.phamvand@clinic.com',
        fullName: 'BS. Phạm Văn Dũng',
        phone: '0904444444',
        dateOfBirth: new Date('1986-04-08'),
        gender: Gender.MALE,
        address: '555 Võ Văn Tần, Quận 3, TP.HCM',
      },
      profile: {
        specialties: ['Răng hàm mặt', 'Nha khoa thẩm mỹ'],
        qualifications: ['Bác sĩ CK1', 'Bác sĩ nội trú'],
        yearsOfExperience: 8,
        rating: 4.6,
        reviewCount: 95,
        bio: 'Chuyên gia răng hàm mặt, tập trung vào nha khoa thẩm mỹ và implant',
      },
      serviceNames: ['Khám răng hàm mặt'],
    },
    {
      user: {
        email: 'bs.hoangthie@clinic.com',
        fullName: 'BS. Hoàng Thị Em',
        phone: '0905555555',
        dateOfBirth: new Date('1978-09-15'),
        gender: Gender.FEMALE,
        address: '888 Pasteur, Quận 1, TP.HCM',
      },
      profile: {
        specialties: ['Mắt', 'Phẫu thuật khúc xạ'],
        qualifications: ['Bác sĩ CK2', 'Thạc sĩ Nhãn khoa'],
        yearsOfExperience: 14,
        rating: 4.9,
        reviewCount: 203,
        bio: 'Bác sĩ mắt giàu kinh nghiệm, chuyên về phẫu thuật khúc xạ và điều trị bệnh lý võng mạc',
      },
      serviceNames: ['Khám mắt', 'Xét nghiệm'],
    },
    {
      user: {
        email: 'bs.nguyenvantai@clinic.com',
        fullName: 'BS. Nguyễn Văn Tài',
        phone: '0908111111',
        dateOfBirth: new Date('1977-06-12'),
        gender: Gender.MALE,
        address: '200 Nam Kỳ Khởi Nghĩa, Quận 3, TP.HCM',
      },
      profile: {
        specialties: ['Tai mũi họng'],
        qualifications: ['Bác sĩ CK2', 'Thạc sĩ Y khoa'],
        yearsOfExperience: 16,
        rating: 4.8,
        reviewCount: 175,
        bio: 'Chuyên gia tai mũi họng với hơn 16 năm kinh nghiệm điều trị các bệnh lý tai mũi họng phức tạp',
      },
      serviceNames: ['Khám tai mũi họng', 'Xét nghiệm'],
    },
    {
      user: {
        email: 'bs.tranthimylinh@clinic.com',
        fullName: 'BS. Trần Thị Mỹ Linh',
        phone: '0908222222',
        dateOfBirth: new Date('1983-02-28'),
        gender: Gender.FEMALE,
        address: '300 Cộng Hòa, Tân Bình, TP.HCM',
      },
      profile: {
        specialties: ['Sản phụ khoa'],
        qualifications: ['Bác sĩ CK1', 'Chứng chỉ Siêu âm sản khoa'],
        yearsOfExperience: 11,
        rating: 4.85,
        reviewCount: 210,
        bio: 'Bác sĩ sản phụ khoa tận tâm, có kinh nghiệm chăm sóc sức khỏe phụ nữ và theo dõi thai kỳ',
      },
      serviceNames: ['Khám sản phụ khoa', 'Siêu âm tổng quát', 'Xét nghiệm'],
    },
  ];

  const createdDoctors: User[] = [];
  for (const doctorData of doctorsData) {
    const doctor = await prisma.user.create({
      data: {
        email: doctorData.user.email,
        password: await hashPassword('doctor123'),
        role: UserRole.DOCTOR,
        fullName: doctorData.user.fullName,
        phone: doctorData.user.phone,
        dateOfBirth: doctorData.user.dateOfBirth,
        gender: doctorData.user.gender,
        address: doctorData.user.address,
        isActive: true,
        isVerified: true,
        doctorProfile: {
          create: doctorData.profile,
        },
      },
    });
    createdDoctors.push(doctor);
    console.log(`  ✅ Doctor created: ${doctor.fullName}`);
  }

  // RECEPTIONISTS
  const receptionistsData = [
    {
      email: 'letan.huong@clinic.com',
      fullName: 'Nguyễn Thị Hương',
      phone: '0906666666',
      dateOfBirth: new Date('1992-06-10'),
      gender: Gender.FEMALE,
      address: '234 Lý Thái Tổ, Quận 10, TP.HCM',
    },
    {
      email: 'letan.lan@clinic.com',
      fullName: 'Trần Thị Lan',
      phone: '0907777777',
      dateOfBirth: new Date('1994-03-22'),
      gender: Gender.FEMALE,
      address: '567 Nguyễn Thị Minh Khai, Quận 3, TP.HCM',
    },
  ];

  for (const receptionist of receptionistsData) {
    await prisma.user.create({
      data: {
        email: receptionist.email,
        password: await hashPassword('receptionist123'),
        role: UserRole.RECEPTIONIST,
        fullName: receptionist.fullName,
        phone: receptionist.phone,
        dateOfBirth: receptionist.dateOfBirth,
        gender: receptionist.gender,
        address: receptionist.address,
        isActive: true,
        isVerified: true,
      },
    });
  }
  console.log('  ✅ Receptionists created');

  // TECHNICIANS
  const techniciansData = [
    {
      email: 'ktv.phuong@clinic.com',
      fullName: 'KTV. Trần Thị Phương',
      phone: '0981111111',
      dateOfBirth: new Date('1990-05-15'),
      gender: Gender.FEMALE,
      address: '111 Nguyễn Trãi, Quận 1, TP.HCM',
    },
    {
      email: 'ktv.tuan@clinic.com',
      fullName: 'KTV. Lê Anh Tuấn',
      phone: '0982222222',
      dateOfBirth: new Date('1992-08-22'),
      gender: Gender.MALE,
      address: '222 Lê Lợi, Quận 1, TP.HCM',
    },
  ];

  for (const technician of techniciansData) {
    await prisma.user.create({
      data: {
        email: technician.email,
        password: await hashPassword('technician123'),
        role: UserRole.TECHNICIAN,
        fullName: technician.fullName,
        phone: technician.phone,
        dateOfBirth: technician.dateOfBirth,
        gender: technician.gender,
        address: technician.address,
        isActive: true,
        isVerified: true,
      },
    });
  }
  console.log('  ✅ Technicians created');

  // ============================================
  // 3. CREATE REGISTERED PATIENTS (User + PatientProfile)
  // ============================================
  console.log('\n🧑‍⚕️ Creating registered patients...');

  const patientsData = [
    {
      email: 'patient.nam@gmail.com',
      fullName: 'Nguyễn Văn Nam',
      phone: '0908888888',
      dateOfBirth: new Date('1988-12-05'),
      gender: Gender.MALE,
      address: '111 Cách Mạng Tháng 8, Quận 10, TP.HCM',
      bloodType: 'O+',
      allergies: 'Penicillin',
    },
    {
      email: 'patient.linh@gmail.com',
      fullName: 'Lê Thị Linh',
      phone: '0909999999',
      dateOfBirth: new Date('1995-08-20'),
      gender: Gender.FEMALE,
      address: '222 Phan Xích Long, Phú Nhuận, TP.HCM',
      bloodType: 'A+',
      allergies: null,
    },
    {
      email: 'patient.tuan@gmail.com',
      fullName: 'Trần Anh Tuấn',
      phone: '0911111111',
      dateOfBirth: new Date('1990-02-14'),
      gender: Gender.MALE,
      address: '333 Hoàng Văn Thụ, Tân Bình, TP.HCM',
      bloodType: 'B+',
      allergies: null,
    },
    {
      email: 'patient.mai@gmail.com',
      fullName: 'Phạm Thị Mai',
      phone: '0912222222',
      dateOfBirth: new Date('1993-05-18'),
      gender: Gender.FEMALE,
      address: '444 Điện Biên Phủ, Bình Thạnh, TP.HCM',
      bloodType: 'AB+',
      allergies: 'Sulfa drugs',
    },
    {
      email: 'patient.hung@gmail.com',
      fullName: 'Hoàng Văn Hùng',
      phone: '0913333333',
      dateOfBirth: new Date('1987-11-30'),
      gender: Gender.MALE,
      address: '555 Lý Thường Kiệt, Quận 11, TP.HCM',
      bloodType: 'O-',
      allergies: null,
    },
    {
      email: 'patient.thu@gmail.com',
      fullName: 'Võ Thị Thu',
      phone: '0914444444',
      dateOfBirth: new Date('1991-07-25'),
      gender: Gender.FEMALE,
      address: '666 Trường Chinh, Tân Bình, TP.HCM',
      bloodType: 'A-',
      allergies: null,
    },
    {
      email: 'patient.dat@gmail.com',
      fullName: 'Đặng Minh Đạt',
      phone: '0915555555',
      dateOfBirth: new Date('1989-04-12'),
      gender: Gender.MALE,
      address: '777 Xô Viết Nghệ Tĩnh, Bình Thạnh, TP.HCM',
      bloodType: 'B-',
      allergies: null,
    },
    {
      email: 'patient.nhi@gmail.com',
      fullName: 'Bùi Thị Nhi',
      phone: '0916666666',
      dateOfBirth: new Date('1996-09-08'),
      gender: Gender.FEMALE,
      address: '888 Ba Tháng Hai, Quận 10, TP.HCM',
      bloodType: 'AB-',
      allergies: 'Aspirin',
    },
  ];

  const createdPatientProfiles: PatientProfile[] = [];
  for (const patient of patientsData) {
    const user = await prisma.user.create({
      data: {
        email: patient.email,
        password: await hashPassword('patient123'),
        role: UserRole.PATIENT,
        fullName: patient.fullName,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        isActive: true,
        isVerified: true,
      },
    });

    const profile = await prisma.patientProfile.create({
      data: {
        userId: user.id,
        fullName: patient.fullName,
        phone: patient.phone,
        email: patient.email,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        patientCode: generatePatientCode(),
        isGuest: false,
        bloodType: patient.bloodType || null,
        allergies: patient.allergies || null,
      },
    });

    createdPatientProfiles.push(profile);
    console.log(
      `  ✅ Patient created: ${patient.fullName} (${profile.patientCode})`,
    );
  }

  // ============================================
  // 4. CREATE GUEST PATIENTS (walk-in, no account)
  // ============================================
  console.log('\n👤 Creating guest patients (walk-in)...');

  const guestPatientsData = [
    {
      fullName: 'Trần Văn Khách',
      phone: '0917777777',
      email: 'tranvankhach@gmail.com',
      dateOfBirth: new Date('1985-06-20'),
      gender: Gender.MALE,
      address: '123 Nguyễn Trãi, Quận 5, TP.HCM',
      bloodType: 'O+',
    },
    {
      fullName: 'Nguyễn Thị Vãng Lai',
      phone: '0918888888',
      email: null,
      dateOfBirth: new Date('2000-03-15'),
      gender: Gender.FEMALE,
      address: null,
      bloodType: null,
    },
  ];

  const createdGuestProfiles: PatientProfile[] = [];
  for (const guest of guestPatientsData) {
    const profile = await prisma.patientProfile.create({
      data: {
        userId: null, // No account
        fullName: guest.fullName,
        phone: guest.phone,
        email: guest.email,
        dateOfBirth: guest.dateOfBirth,
        gender: guest.gender,
        address: guest.address,
        patientCode: generatePatientCode(),
        isGuest: true,
        bloodType: guest.bloodType || null,
      },
    });
    createdGuestProfiles.push(profile);
    console.log(
      `  ✅ Guest patient created: ${guest.fullName} (${profile.patientCode}) — isGuest=true`,
    );
  }

  // ============================================
  // 5. CREATE SERVICES
  // ============================================
  console.log('\n🏥 Creating services...');

  const servicesData = [
    {
      name: 'Khám tổng quát',
      description: 'Khám sức khỏe định kỳ, tư vấn các vấn đề sức khỏe chung',
      category: 'Nội khoa',
      durationMinutes: 30,
      price: 200000,
      maxSlotsPerHour: 3,
    },
    {
      name: 'Khám tim mạch',
      description: 'Siêu âm tim, điện tâm đồ, tư vấn điều trị bệnh tim mạch',
      category: 'Nội khoa',
      durationMinutes: 45,
      price: 300000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám da liễu',
      description: 'Điều trị mụn, nám, viêm da, dị ứng da',
      category: 'Da liễu',
      durationMinutes: 30,
      price: 250000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám răng hàm mặt',
      description: 'Khám tổng quát, lấy cao răng, nhổ răng, trám răng',
      category: 'Nha khoa',
      durationMinutes: 45,
      price: 350000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám mắt',
      description: 'Đo thị lực, khám bệnh về mắt, kê đơn kính',
      category: 'Nhãn khoa',
      durationMinutes: 30,
      price: 200000,
      maxSlotsPerHour: 3,
    },
    {
      name: 'Xét nghiệm',
      description: 'Xét nghiệm máu, nước tiểu, các xét nghiệm chuyên sâu',
      category: 'Xét nghiệm',
      durationMinutes: 15,
      price: 150000,
      maxSlotsPerHour: 4,
    },
    {
      name: 'Siêu âm tổng quát',
      description: 'Siêu âm bụng, siêu âm tuyến giáp, siêu âm vú',
      category: 'Chẩn đoán hình ảnh',
      durationMinutes: 30,
      price: 280000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Nội soi',
      description: 'Nội soi dạ dày, nội soi đại tràng',
      category: 'Nội khoa',
      durationMinutes: 60,
      price: 500000,
      maxSlotsPerHour: 1,
    },
    {
      name: 'Khám tai mũi họng',
      description: 'Khám và điều trị bệnh tai mũi họng',
      category: 'Tai mũi họng',
      durationMinutes: 30,
      price: 220000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám sản phụ khoa',
      description: 'Khám thai, tư vấn sức khỏe phụ nữ',
      category: 'Sản phụ khoa',
      durationMinutes: 45,
      price: 300000,
      maxSlotsPerHour: 2,
    },
  ];

  const createdServices: Service[] = [];
  for (const service of servicesData) {
    const created = await prisma.service.create({ data: service });
    createdServices.push(created);
    console.log(`  ✅ Service: ${created.name}`);
  }

  const serviceMap = new Map<string, Service>();
  for (const s of createdServices) {
    serviceMap.set(s.name, s);
  }

  // ============================================
  // 6. LINK DOCTORS ↔ SERVICES
  // ============================================
  console.log('\n🔗 Linking doctors to services...');

  let doctorServiceCount = 0;
  for (let i = 0; i < doctorsData.length; i++) {
    const doctorData = doctorsData[i];
    const doctor = createdDoctors[i];

    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: doctor.id },
      select: { id: true },
    });

    if (!profile) continue;

    for (const serviceName of doctorData.serviceNames) {
      const service = serviceMap.get(serviceName);
      if (!service) continue;
      await prisma.doctorService.create({
        data: {
          doctorProfileId: profile.id,
          serviceId: service.id,
        },
      });
      doctorServiceCount++;
    }
    console.log(
      `  ✅ ${doctor.fullName} → [${doctorData.serviceNames.join(', ')}]`,
    );
  }
  console.log(`  ✅ Total DoctorService records: ${doctorServiceCount}`);

  // ============================================
  // 7. CREATE DOCTOR WORKING HOURS
  // ============================================
  console.log('\n⏰ Creating doctor working hours...');

  const workingDays = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SUNDAY,
  ];

  let workingHoursCount = 0;
  for (const doctor of createdDoctors) {
    for (const day of workingDays) {
      await prisma.doctorWorkingHours.create({
        data: {
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '17:00',
        },
      });
      workingHoursCount++;
    }
    await prisma.doctorWorkingHours.create({
      data: {
        doctorId: doctor.id,
        dayOfWeek: DayOfWeek.SATURDAY,
        startTime: '08:00',
        endTime: '12:00',
      },
    });
    workingHoursCount++;
  }
  console.log(`  ✅ Created ${workingHoursCount} working hour records`);

  // ============================================
  // 8. CREATE BREAK TIMES (Lunch breaks)
  // ============================================
  console.log('\n🍽️ Creating break times...');

  const today = new Date();
  const dateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  let breakTimeCount = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const breakDate = new Date(dateOnly);
    breakDate.setDate(dateOnly.getDate() + dayOffset);
    if (breakDate.getDay() === 0) continue;
    for (const doctor of createdDoctors) {
      await prisma.doctorBreakTime.create({
        data: {
          doctorId: doctor.id,
          breakDate: breakDate,
          startTime: '12:00',
          endTime: '13:00',
          reason: 'Nghỉ trưa',
        },
      });
      breakTimeCount++;
    }
  }
  console.log(`  ✅ Created ${breakTimeCount} break time records`);

  // ============================================
  // 9. CREATE DOCTOR SCHEDULE SLOTS (Capacity tracking)
  // ============================================
  console.log('\n📅 Creating doctor schedule slots...');

  let slotCount = 0;
  // Seed slots for the next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const slotDate = new Date(dateOnly);
    slotDate.setDate(dateOnly.getDate() + dayOffset);
    if (slotDate.getDay() === 0) continue; // Skip Sunday

    for (const doctor of createdDoctors) {
      // Create slots from 08:00 to 17:00 (hourly)
      for (let hour = 8; hour < 17; hour++) {
        if (hour === 12) continue; // Skip lunch hour

        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endTime = `${String(hour + 1).padStart(2, '0')}:00`;

        await prisma.doctorScheduleSlot.create({
          data: {
            doctorId: doctor.id,
            date: slotDate,
            startTime,
            endTime,
            maxPreBookings: 2, // 2 pre-bookings per hour
            maxQueueSize: 5, // 5 walk-in slots per hour
            preBookedCount: 0,
            queueCount: 0,
            isActive: true,
          },
        });
        slotCount++;
      }
    }
  }
  console.log(`  ✅ Created ${slotCount} schedule slots`);

  // ============================================
  // 9. CREATE SAMPLE BOOKINGS (hybrid: pre-booking + walk-in)
  // ============================================
  console.log('\n📅 Creating sample bookings...');

  const doctorVanAn = createdDoctors[0]; // Nội tổng quát
  const doctorLeBinh = createdDoctors[1]; // Tim mạch
  const khamTongQuat = serviceMap.get('Khám tổng quát')!;
  const khamTimMach = serviceMap.get('Khám tim mạch')!;
  const xetNghiem = serviceMap.get('Xét nghiệm')!;

  const bookingDates = [
    new Date(dateOnly), // today
    new Date(dateOnly), // today
    new Date(dateOnly), // today — walk-in
    new Date(dateOnly.getTime() + 1 * 24 * 60 * 60 * 1000), // tomorrow
    new Date(dateOnly.getTime() + 2 * 24 * 60 * 60 * 1000), // +2 days — walk-in
    new Date(dateOnly.getTime() + 3 * 24 * 60 * 60 * 1000), // +3 days
  ];

  // Helper: compute endTime string from startTime + durationMinutes
  function calcEndTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + durationMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  // ---- PRE-BOOKINGS (isPreBooked=true, startTime required) ----
  const preBookings = [
    // Online: Nguyễn Văn Nam — Nội tổng quát
    {
      patientProfile: createdPatientProfiles[0],
      doctor: doctorVanAn,
      service: khamTongQuat,
      bookingDate: bookingDates[0],
      startTime: '09:00',
      source: BookingSource.ONLINE,
      priority: BookingPriority.NORMAL,
    },
    // Online: Lê Thị Linh — Tim mạch
    {
      patientProfile: createdPatientProfiles[1],
      doctor: doctorLeBinh,
      service: khamTimMach,
      bookingDate: bookingDates[1],
      startTime: '10:00',
      source: BookingSource.ONLINE,
      priority: BookingPriority.NORMAL,
    },
    // Phone: Trần Anh Tuấn — upcoming
    {
      patientProfile: createdPatientProfiles[2],
      doctor: doctorVanAn,
      service: khamTongQuat,
      bookingDate: bookingDates[3],
      startTime: '09:00',
      source: BookingSource.PHONE,
      priority: BookingPriority.NORMAL,
    },
    // Receptionist pre-booking: Phạm Thị Mai — future
    {
      patientProfile: createdPatientProfiles[3],
      doctor: doctorVanAn,
      service: khamTongQuat,
      bookingDate: bookingDates[5],
      startTime: '14:00',
      source: BookingSource.RECEPTIONIST,
      priority: BookingPriority.NORMAL,
    },
  ];

  for (const bData of preBookings) {
    const dateStr = bData.bookingDate.toISOString().split('T')[0];
    const endTime = calcEndTime(bData.startTime, bData.service.durationMinutes);
    await prisma.booking.create({
      data: {
        patientProfileId: bData.patientProfile.id,
        doctorId: bData.doctor.id,
        serviceId: bData.service.id,
        bookingCode: generateBookingCode(dateStr),
        bookingDate: bData.bookingDate,
        startTime: bData.startTime,
        endTime,
        isPreBooked: true,
        source: bData.source,
        priority: bData.priority,
      },
    });
  }
  console.log(`  ✅ Created ${preBookings.length} pre-bookings`);

  // ---- WALK-IN BOOKINGS (isPreBooked=false, no startTime/endTime) ----
  // Walk-in are created by receptionist; they get a BookingQueue record on check-in.
  const walkInBookings = [
    // Walk-in guest: Trần Văn Khách — today
    {
      patientProfile: createdGuestProfiles[0],
      doctor: doctorVanAn,
      service: xetNghiem,
      bookingDate: bookingDates[2],
      source: BookingSource.WALK_IN,
      priority: BookingPriority.NORMAL,
    },
    // Walk-in guest urgent: Nguyễn Thị Vãng Lai — +2 days
    {
      patientProfile: createdGuestProfiles[1],
      doctor: doctorLeBinh,
      service: khamTimMach,
      bookingDate: bookingDates[4],
      source: BookingSource.RECEPTIONIST,
      priority: BookingPriority.URGENT,
    },
  ];

  const createdWalkInBookings: {
    booking: { id: string };
    bData: {
      doctor: { id: string };
      bookingDate: Date;
      service: { durationMinutes: number };
    };
  }[] = [];
  for (const bData of walkInBookings) {
    const dateStr = bData.bookingDate.toISOString().split('T')[0];
    const booking = await prisma.booking.create({
      data: {
        patientProfileId: bData.patientProfile.id,
        doctorId: bData.doctor.id,
        serviceId: bData.service.id,
        bookingCode: generateBookingCode(dateStr),
        bookingDate: bData.bookingDate,
        // startTime / endTime intentionally null — walk-in
        isPreBooked: false,
        source: bData.source,
        priority: bData.priority,
      },
    });
    createdWalkInBookings.push({ booking, bData });
  }
  console.log(`  ✅ Created ${walkInBookings.length} walk-in bookings`);

  // Seed BookingQueue for walk-in bookings (simulates check-in)
  // In production this is created by BookingsService.checkIn()
  let queuePos = 1;
  for (const { booking, bData } of createdWalkInBookings) {
    await prisma.bookingQueue.create({
      data: {
        bookingId: booking.id,
        doctorId: bData.doctor.id,
        queueDate: bData.bookingDate,
        queuePosition: queuePos++,
        isPreBooked: false,
        scheduledTime: null,
        estimatedWaitMinutes: (queuePos - 1) * bData.service.durationMinutes,
      },
    });
  }
  console.log(
    `  ✅ Created ${createdWalkInBookings.length} walk-in queue records`,
  );

  const sampleBookingTotal = preBookings.length + walkInBookings.length;
  console.log(
    `  ✅ Total ${sampleBookingTotal} bookings created (${preBookings.length} pre-booked, ${walkInBookings.length} walk-in)`,
  );

  // ============================================
  // 11. CREATE ICD-10 CODES (FULL DATASET IMPORT)
  // ============================================
  console.log('\n🩺 Creating ICD-10 Codes...');
  const icd10Path = path.resolve(
    process.cwd(),
    '../Tools/icd10_vietnamese.json',
  );
  let icd10CodesData: { code: string; name: string }[] = [];

  if (fs.existsSync(icd10Path)) {
    console.log(`  📂 Found scraped dataset at ${icd10Path}`);
    try {
      icd10CodesData = JSON.parse(fs.readFileSync(icd10Path, 'utf8')) as {
        code: string;
        name: string;
      }[];
      console.log(`  📦 Loaded ${icd10CodesData.length} entries from JSON`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('  ❌ Error parsing JSON file:', errorMessage);
    }
  }

  // Fallback sample if file missing or empty
  if (icd10CodesData.length === 0) {
    console.log('  ⚠️ Using fallback mock sample...');
    icd10CodesData = [
      { code: 'J00', name: 'Bệnh đường hô hấp trên cấp tính (Cảm lạnh)' },
      { code: 'J01', name: 'Viêm xoang cấp' },
      { code: 'J02', name: 'Viêm họng cấp' },
      { code: 'J03', name: 'Viêm amidan cấp' },
      { code: 'J04', name: 'Viêm thanh quản và khí quản cấp' },
      { code: 'I10', name: 'Tăng huyết áp vô căn (nguyên phát)' },
      { code: 'E11', name: 'Bệnh đái tháo đường không phụ thuộc insuline' },
      {
        code: 'E78',
        name: 'Rối loạn chuyển hóa lipoprotein và tình trạng tăng lipid máu khác',
      },
      { code: 'K21', name: 'Bệnh trào ngược dạ dày - thực quản' },
      { code: 'K29', name: 'Viêm dạ dày và tá tràng' },
      { code: 'M54.5', name: 'Đau thắt lưng' },
      { code: 'A09', name: 'Tiêu chảy và viêm dạ dày ruột' },
    ];
  }

  const batchSize = 1000;
  for (let i = 0; i < icd10CodesData.length; i += batchSize) {
    const batch = icd10CodesData.slice(i, i + batchSize);
    await prisma.icd10Code.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(
      `  ✅ Batch ${i / batchSize + 1}: Migrated indices ${i + 1} to ${Math.min(i + batchSize, icd10CodesData.length)}`,
    );
  }
  console.log(`  🎉 Finished seeding ${icd10CodesData.length} ICD-10 Codes`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 Seed Summary:');
  console.log('==========================================');

  // ============================================
  // 11. CREATE DEFAULT SYSTEM CONFIGS
  // ============================================
  console.log('\n⚙️ Creating default system configurations...');

  const systemConfigs = [
    // CLINIC
    {
      key: 'clinic.name',
      value: 'SmartClinic Central',
      category: 'CLINIC',
      dataType: 'string',
      description: 'Tên phòng khám',
      isPublic: true,
    },
    {
      key: 'clinic.address',
      value: '123 Hospital St, Health District',
      category: 'CLINIC',
      dataType: 'string',
      description: 'Địa chỉ phòng khám',
      isPublic: true,
    },
    {
      key: 'clinic.phone',
      value: '+84 123 456 789',
      category: 'CLINIC',
      dataType: 'string',
      description: 'Số điện thoại liên hệ',
      isPublic: true,
    },
    {
      key: 'clinic.email',
      value: 'contact@clinic.com',
      category: 'CLINIC',
      dataType: 'string',
      description: 'Email liên hệ',
      isPublic: true,
    },
    {
      key: 'clinic.taxId',
      value: 'MST-12345678',
      category: 'CLINIC',
      dataType: 'string',
      description: 'Mã số thuế',
      isPublic: false,
    },

    // BOOKING
    {
      key: 'booking.openTime',
      value: '08:00',
      category: 'BOOKING',
      dataType: 'string',
      description: 'Giờ mở cửa',
      isPublic: true,
    },
    {
      key: 'booking.closeTime',
      value: '17:00',
      category: 'BOOKING',
      dataType: 'string',
      description: 'Giờ đóng cửa',
      isPublic: true,
    },
    {
      key: 'booking.slotDuration',
      value: '30',
      category: 'BOOKING',
      dataType: 'number',
      description: 'Thời lượng mỗi ca khám (phút)',
      isPublic: true,
    },
    {
      key: 'booking.cancelationWindowHours',
      value: '24',
      category: 'BOOKING',
      dataType: 'number',
      description: 'Thời hạn hủy hẹn trước (giờ)',
      isPublic: true,
    },
    {
      key: 'booking.noShowGraceMinutes',
      value: '15',
      category: 'BOOKING',
      dataType: 'number',
      description: 'Thời gian chờ tối đa (phút)',
      isPublic: false,
    },
    {
      key: 'booking.allowOnlineBooking',
      value: 'true',
      category: 'BOOKING',
      dataType: 'boolean',
      description: 'Cho phép đặt lịch trực tuyến',
      isPublic: true,
    },

    // NOTIFICATION
    {
      key: 'notification.enableEmailReminders',
      value: 'true',
      category: 'NOTIFICATION',
      dataType: 'boolean',
      description: 'Gửi nhắc hẹn qua Email',
      isPublic: false,
    },
    {
      key: 'notification.enableSmsReminders',
      value: 'false',
      category: 'NOTIFICATION',
      dataType: 'boolean',
      description: 'Gửi nhắc hẹn qua SMS',
      isPublic: false,
    },
    {
      key: 'notification.reminderSchedule',
      value: '24, 2',
      category: 'NOTIFICATION',
      dataType: 'string',
      description: 'Lịch gửi nhắc hẹn (cách bao nhiêu giờ)',
      isPublic: false,
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.create({
      data: {
        ...config,
        updatedBy: admin.id,
      },
    });
  }
  console.log(`  ✅ Created ${systemConfigs.length} default configurations`);

  const userCount = await prisma.user.count();
  const roomCount = await prisma.room.count();
  const serviceCount = await prisma.service.count();
  const doctorServiceTotal = await prisma.doctorService.count();
  const workingHoursTotal = await prisma.doctorWorkingHours.count();
  const breakTimeTotal = await prisma.doctorBreakTime.count();
  const patientProfileTotal = await prisma.patientProfile.count();
  const guestProfileTotal = await prisma.patientProfile.count({
    where: { isGuest: true },
  });
  const registeredProfileTotal = await prisma.patientProfile.count({
    where: { isGuest: false },
  });
  const bookingTotal = await prisma.booking.count();

  const adminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });
  const doctorCount = await prisma.user.count({
    where: { role: UserRole.DOCTOR },
  });
  const receptionistCount = await prisma.user.count({
    where: { role: UserRole.RECEPTIONIST },
  });
  const technicianCount = await prisma.user.count({
    where: { role: UserRole.TECHNICIAN },
  });
  const patientUserCount = await prisma.user.count({
    where: { role: UserRole.PATIENT },
  });

  console.log(`👥 Total Users: ${userCount}`);
  console.log(`   - Admins: ${adminCount}`);
  console.log(`   - Doctors: ${doctorCount}`);
  console.log(`   - Receptionists: ${receptionistCount}`);
  console.log(`   - Technicians: ${technicianCount}`);
  console.log(`   - Patients (có tài khoản): ${patientUserCount}`);
  console.log(`🏠 Rooms: ${roomCount}`);
  console.log(`🧑‍⚕️ PatientProfiles: ${patientProfileTotal}`);
  console.log(`   - Registered (có tài khoản): ${registeredProfileTotal}`);
  console.log(`   - Guest (vãng lai): ${guestProfileTotal}`);
  console.log(`🏥 Services: ${serviceCount}`);
  console.log(`🔗 Doctor-Service Links: ${doctorServiceTotal}`);
  console.log(`⏰ Working Hours: ${workingHoursTotal}`);
  console.log(`🍽️ Break Times: ${breakTimeTotal}`);
  console.log(`📅 Sample Bookings: ${bookingTotal}`);
  console.log('==========================================');

  console.log('\n📝 Demo Credentials:');
  console.log('==========================================');
  console.log('ADMIN:');
  console.log('  admin@clinic.com / admin123');
  console.log('\nDOCTORS:');
  console.log('  bs.nguyenvana@clinic.com     / doctor123 → Nội tổng quát');
  console.log('  bs.lethib@clinic.com          / doctor123 → Tim mạch');
  console.log('  bs.tranthic@clinic.com        / doctor123 → Da liễu');
  console.log('  bs.phamvand@clinic.com        / doctor123 → Răng hàm mặt');
  console.log('  bs.hoangthie@clinic.com       / doctor123 → Mắt');
  console.log('  bs.nguyenvantai@clinic.com    / doctor123 → Tai mũi họng');
  console.log('  bs.tranthimylinh@clinic.com   / doctor123 → Sản phụ khoa');
  console.log('\nRECEPTIONISTS:');
  console.log('  letan.huong@clinic.com / receptionist123');
  console.log('  letan.lan@clinic.com   / receptionist123');
  console.log('\nTECHNICIANS:');
  console.log('  ktv.phuong@clinic.com / technician123');
  console.log('  ktv.tuan@clinic.com   / technician123');
  console.log('\nPATIENTS (registered):');
  console.log('  patient.nam@gmail.com / patient123  → BN-2026-0001');
  console.log('  patient.linh@gmail.com / patient123 → BN-2026-0002');
  console.log('  patient.tuan@gmail.com / patient123 → BN-2026-0003');
  console.log('  patient.mai@gmail.com / patient123  → BN-2026-0004');
  console.log('  patient.hung@gmail.com / patient123 → BN-2026-0005');
  console.log('  patient.thu@gmail.com / patient123  → BN-2026-0006');
  console.log('  patient.dat@gmail.com / patient123  → BN-2026-0007');
  console.log('  patient.nhi@gmail.com / patient123  → BN-2026-0008');
  console.log('\nGUEST PATIENTS (walk-in, no account):');
  console.log('  Trần Văn Khách     → BN-2026-0009 (isGuest=true)');
  console.log('  Nguyễn Thị Vãng Lai → BN-2026-0010 (isGuest=true)');
  console.log('==========================================');

  console.log('\n🎉 Seed v3.0 completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
