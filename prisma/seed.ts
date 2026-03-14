import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  Gender,
  DayOfWeek,
  User,
  Service,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Make sure .env is in the backend root (be/) or set DOTENV_CONFIG_PATH.',
  );
}

console.log('Using database URL:', databaseUrl);

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash password helper
  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
  };

  // ============================================
  // 0. CLEAR ALL DATA (fresh seed)
  // ============================================
  console.log('\n�️  Clearing existing data...');

  // Delete in order to avoid FK constraint violations
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
  await prisma.refreshToken.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  console.log('  ✅ All data cleared');

  // ============================================
  // 1. CREATE USERS
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
  // serviceKeys: tên các service sẽ được map sau khi tạo services
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
      // Tên services (phải khớp với trường name bên dưới)
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
    console.log(
      `  ✅ Doctor created: ${doctor.fullName} (${doctorData.profile.specialties[0]})`,
    );
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
    const created = await prisma.user.create({
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
    console.log(`  ✅ Receptionist created: ${created.fullName}`);
  }

  // PATIENTS
  const patientsData = [
    {
      email: 'patient.nam@gmail.com',
      fullName: 'Nguyễn Văn Nam',
      phone: '0908888888',
      dateOfBirth: new Date('1988-12-05'),
      gender: Gender.MALE,
      address: '111 Cách Mạng Tháng 8, Quận 10, TP.HCM',
    },
    {
      email: 'patient.linh@gmail.com',
      fullName: 'Lê Thị Linh',
      phone: '0909999999',
      dateOfBirth: new Date('1995-08-20'),
      gender: Gender.FEMALE,
      address: '222 Phan Xích Long, Phú Nhuận, TP.HCM',
    },
    {
      email: 'patient.tuan@gmail.com',
      fullName: 'Trần Anh Tuấn',
      phone: '0911111111',
      dateOfBirth: new Date('1990-02-14'),
      gender: Gender.MALE,
      address: '333 Hoàng Văn Thụ, Tân Bình, TP.HCM',
    },
    {
      email: 'patient.mai@gmail.com',
      fullName: 'Phạm Thị Mai',
      phone: '0912222222',
      dateOfBirth: new Date('1993-05-18'),
      gender: Gender.FEMALE,
      address: '444 Điện Biên Phủ, Bình Thạnh, TP.HCM',
    },
    {
      email: 'patient.hung@gmail.com',
      fullName: 'Hoàng Văn Hùng',
      phone: '0913333333',
      dateOfBirth: new Date('1987-11-30'),
      gender: Gender.MALE,
      address: '555 Lý Thường Kiệt, Quận 11, TP.HCM',
    },
    {
      email: 'patient.thu@gmail.com',
      fullName: 'Võ Thị Thu',
      phone: '0914444444',
      dateOfBirth: new Date('1991-07-25'),
      gender: Gender.FEMALE,
      address: '666 Trường Chinh, Tân Bình, TP.HCM',
    },
    {
      email: 'patient.dat@gmail.com',
      fullName: 'Đặng Minh Đạt',
      phone: '0915555555',
      dateOfBirth: new Date('1989-04-12'),
      gender: Gender.MALE,
      address: '777 Xô Viết Nghệ Tĩnh, Bình Thạnh, TP.HCM',
    },
    {
      email: 'patient.nhi@gmail.com',
      fullName: 'Bùi Thị Nhi',
      phone: '0916666666',
      dateOfBirth: new Date('1996-09-08'),
      gender: Gender.FEMALE,
      address: '888 Ba Tháng Hai, Quận 10, TP.HCM',
    },
  ];

  for (const patient of patientsData) {
    const created = await prisma.user.create({
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
    console.log(`  ✅ Patient created: ${created.fullName}`);
  }

  // ============================================
  // 2. CREATE SERVICES
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
    console.log(
      `  ✅ Service created: ${created.name} — ${created.category} (${created.price.toString()}đ)`,
    );
  }

  // Build lookup map: serviceName → Service object
  const serviceMap = new Map<string, Service>();
  for (const s of createdServices) {
    serviceMap.set(s.name, s);
  }

  // ============================================
  // 3. LINK DOCTORS ↔ SERVICES (DoctorService)
  // ============================================
  console.log('\n🔗 Linking doctors to services...');

  let doctorServiceCount = 0;
  for (let i = 0; i < doctorsData.length; i++) {
    const doctorData = doctorsData[i];
    const doctor = createdDoctors[i];

    // Fetch the doctorProfile id
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: doctor.id },
      select: { id: true },
    });

    if (!profile) {
      console.warn(
        `  ⚠️  No profile found for ${doctor.fullName}, skipping...`,
      );
      continue;
    }

    for (const serviceName of doctorData.serviceNames) {
      const service = serviceMap.get(serviceName);
      if (!service) {
        console.warn(`  ⚠️  Service "${serviceName}" not found, skipping...`);
        continue;
      }

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
  // 4. CREATE DOCTOR WORKING HOURS
  // ============================================
  console.log('\n⏰ Creating doctor working hours...');

  const workingDays = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  let workingHoursCount = 0;
  for (const doctor of createdDoctors) {
    // Weekdays: 8:00 - 17:00
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

    // Saturday: 8:00 - 12:00 (half day)
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
  // 5. CREATE BREAK TIMES (Lunch breaks)
  // ============================================
  console.log('\n🍽️ Creating break times...');

  const today = new Date();
  const dateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  // Create lunch breaks for all doctors for the next 7 days
  let breakTimeCount = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const breakDate = new Date(dateOnly);
    breakDate.setDate(dateOnly.getDate() + dayOffset);

    // Skip Sunday
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
  // SUMMARY
  // ============================================
  console.log('\n📊 Seed Summary:');
  console.log('==========================================');

  const userCount = await prisma.user.count();
  const serviceCount = await prisma.service.count();
  const doctorServiceTotal = await prisma.doctorService.count();
  const workingHoursTotal = await prisma.doctorWorkingHours.count();
  const breakTimeTotal = await prisma.doctorBreakTime.count();
  const doctorProfileCount = await prisma.doctorProfile.count();

  const adminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });
  const doctorCount = await prisma.user.count({
    where: { role: UserRole.DOCTOR },
  });
  const receptionistCount = await prisma.user.count({
    where: { role: UserRole.RECEPTIONIST },
  });
  const patientCount = await prisma.user.count({
    where: { role: UserRole.PATIENT },
  });

  console.log(`👥 Total Users: ${userCount}`);
  console.log(`   - Admins: ${adminCount}`);
  console.log(`   - Doctors: ${doctorCount}`);
  console.log(`   - Receptionists: ${receptionistCount}`);
  console.log(`   - Patients: ${patientCount}`);
  console.log(`👨‍⚕️ Doctor Profiles: ${doctorProfileCount}`);
  console.log(`🏥 Services: ${serviceCount}`);
  console.log(`🔗 Doctor-Service Links: ${doctorServiceTotal}`);
  console.log(`⏰ Working Hours: ${workingHoursTotal}`);
  console.log(`🍽️ Break Times: ${breakTimeTotal}`);
  console.log('==========================================');

  console.log('\n📝 Demo Credentials:');
  console.log('==========================================');
  console.log('ADMIN:');
  console.log('  admin@clinic.com / admin123');
  console.log('\nDOCTORS:');
  console.log(
    '  bs.nguyenvana@clinic.com     / doctor123 → Khám tổng quát, Xét nghiệm, Siêu âm, Nội soi',
  );
  console.log(
    '  bs.lethib@clinic.com          / doctor123 → Khám tim mạch, Xét nghiệm, Siêu âm',
  );
  console.log(
    '  bs.tranthic@clinic.com        / doctor123 → Khám da liễu, Xét nghiệm',
  );
  console.log(
    '  bs.phamvand@clinic.com        / doctor123 → Khám răng hàm mặt',
  );
  console.log(
    '  bs.hoangthie@clinic.com       / doctor123 → Khám mắt, Xét nghiệm',
  );
  console.log(
    '  bs.nguyenvantai@clinic.com    / doctor123 → Khám tai mũi họng, Xét nghiệm',
  );
  console.log(
    '  bs.tranthimylinh@clinic.com   / doctor123 → Khám sản phụ khoa, Siêu âm, Xét nghiệm',
  );
  console.log('\nRECEPTIONISTS:');
  console.log('  letan.huong@clinic.com / receptionist123');
  console.log('  letan.lan@clinic.com   / receptionist123');
  console.log('\nPATIENTS:');
  console.log('  patient.nam@gmail.com   / patient123');
  console.log('  patient.linh@gmail.com  / patient123');
  console.log('  patient.tuan@gmail.com  / patient123');
  console.log('  patient.mai@gmail.com   / patient123');
  console.log('  patient.hung@gmail.com  / patient123');
  console.log('  patient.thu@gmail.com   / patient123');
  console.log('  patient.dat@gmail.com   / patient123');
  console.log('  patient.nhi@gmail.com   / patient123');
  console.log('==========================================');

  console.log('\n🎉 Seed completed successfully!');
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
