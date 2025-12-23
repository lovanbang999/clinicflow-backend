import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, DayOfWeek, Prisma } from '@prisma/client';
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
  // 1. CREATE USERS (4 roles)
  // ============================================
  console.log('👥 Creating users...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      password: await hashPassword('admin123'),
      role: UserRole.ADMIN,
      fullName: 'Admin User',
      phone: '0900000000',
    },
  });
  console.log('  ✅ Admin created:', admin.email);

  const doctor1 = await prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {},
    create: {
      email: 'doctor@clinic.com',
      password: await hashPassword('doctor123'),
      role: UserRole.DOCTOR,
      fullName: 'BS. Nguyễn Văn A',
      phone: '0901111111',
    },
  });
  console.log('  ✅ Doctor created:', doctor1.email);

  const doctor2 = await prisma.user.upsert({
    where: { email: 'doctor2@clinic.com' },
    update: {},
    create: {
      email: 'doctor2@clinic.com',
      password: await hashPassword('doctor123'),
      role: UserRole.DOCTOR,
      fullName: 'BS. Lê Thị B',
      phone: '0902222222',
    },
  });
  console.log('  ✅ Doctor 2 created:', doctor2.email);

  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@clinic.com' },
    update: {},
    create: {
      email: 'receptionist@clinic.com',
      password: await hashPassword('receptionist123'),
      role: UserRole.RECEPTIONIST,
      fullName: 'Lễ Tân Hoa',
      phone: '0903333333',
    },
  });
  console.log('  ✅ Receptionist created:', receptionist.email);

  const patient1 = await prisma.user.upsert({
    where: { email: 'patient@clinic.com' },
    update: {},
    create: {
      email: 'patient@clinic.com',
      password: await hashPassword('patient123'),
      role: UserRole.PATIENT,
      fullName: 'Trần Thị C',
      phone: '0904444444',
    },
  });
  console.log('  ✅ Patient created:', patient1.email);

  const patient2 = await prisma.user.upsert({
    where: { email: 'patient2@clinic.com' },
    update: {},
    create: {
      email: 'patient2@clinic.com',
      password: await hashPassword('patient123'),
      role: UserRole.PATIENT,
      fullName: 'Nguyễn Văn D',
      phone: '0905555555',
    },
  });
  console.log('  ✅ Patient 2 created:', patient2.email);

  // ============================================
  // 2. CREATE SERVICES
  // ============================================
  console.log('\n🏥 Creating services...');

  const service1 = await prisma.service.upsert({
    where: { name: 'Khám tổng quát' },
    update: {},
    create: {
      name: 'Khám tổng quát',
      description: 'Khám sức khỏe tổng quát, kiểm tra các chỉ số cơ bản',
      durationMinutes: 30,
      price: 200000,
      maxSlotsPerHour: 3,
    },
  });
  console.log('  ✅ Service created:', service1.name);

  const service2 = await prisma.service.upsert({
    where: { name: 'Khám tim mạch' },
    update: {},
    create: {
      name: 'Khám tim mạch',
      description: 'Khám chuyên khoa tim mạch, đo điện tim, siêu âm tim',
      durationMinutes: 45,
      price: 300000,
      maxSlotsPerHour: 2,
    },
  });
  console.log('  ✅ Service created:', service2.name);

  const service3 = await prisma.service.upsert({
    where: { name: 'Khám da liễu' },
    update: {},
    create: {
      name: 'Khám da liễu',
      description: 'Khám và điều trị các bệnh về da, mụn, dị ứng',
      durationMinutes: 30,
      price: 250000,
      maxSlotsPerHour: 2,
    },
  });
  console.log('  ✅ Service created:', service3.name);

  const service4 = await prisma.service.upsert({
    where: { name: 'Khám nội tổng quát' },
    update: {},
    create: {
      name: 'Khám nội tổng quát',
      description: 'Khám các bệnh nội khoa: tiêu hóa, hô hấp, thận',
      durationMinutes: 45,
      price: 280000,
      maxSlotsPerHour: 2,
    },
  });
  console.log('  ✅ Service created:', service4.name);

  // ============================================
  // 3. CREATE DOCTOR WORKING HOURS
  // ============================================
  console.log('\n⏰ Creating doctor working hours...');

  const workingHours: Prisma.DoctorWorkingHoursUncheckedCreateInput[] = [
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.TUESDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.WEDNESDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.THURSDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.FRIDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor1.id,
      dayOfWeek: DayOfWeek.SATURDAY,
      startTime: '08:00',
      endTime: '12:00',
    },

    {
      doctorId: doctor2.id,
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor2.id,
      dayOfWeek: DayOfWeek.TUESDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor2.id,
      dayOfWeek: DayOfWeek.WEDNESDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor2.id,
      dayOfWeek: DayOfWeek.THURSDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
    {
      doctorId: doctor2.id,
      dayOfWeek: DayOfWeek.FRIDAY,
      startTime: '08:00',
      endTime: '17:00',
    },
  ];

  for (const hours of workingHours) {
    await prisma.doctorWorkingHours.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: hours.doctorId,
          dayOfWeek: hours.dayOfWeek,
        },
      },
      update: {
        startTime: hours.startTime,
        endTime: hours.endTime,
      },
      create: hours,
    });
  }

  console.log(`  ✅ Created ${workingHours.length} working hour records`);

  // ============================================
  // 4. CREATE BREAK TIMES (Lunch breaks)
  // ============================================
  console.log('\n🍽️ Creating break times...');

  const today = new Date();
  const dateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const breakTimes = [
    {
      doctorId: doctor1.id,
      date: dateOnly,
      startTime: '12:00',
      endTime: '13:00',
      reason: 'Lunch break',
    },
    {
      doctorId: doctor2.id,
      date: dateOnly,
      startTime: '12:00',
      endTime: '13:00',
      reason: 'Lunch break',
    },
  ];

  for (const breakTime of breakTimes) {
    await prisma.doctorBreakTime.create({
      data: breakTime,
    });
  }
  console.log(`  ✅ Created ${breakTimes.length} break time records`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 Seed Summary:');
  console.log('==========================================');

  const userCount = await prisma.user.count();
  const serviceCount = await prisma.service.count();
  const workingHoursCount = await prisma.doctorWorkingHours.count();
  const breakTimeCount = await prisma.doctorBreakTime.count();

  console.log(`👥 Users: ${userCount}`);
  console.log(`🏥 Services: ${serviceCount}`);
  console.log(`⏰ Working Hours: ${workingHoursCount}`);
  console.log(`🍽️ Break Times: ${breakTimeCount}`);
  console.log('==========================================');

  console.log('\n📝 Demo Credentials:');
  console.log('==========================================');
  console.log('Admin:        admin@clinic.com / admin123');
  console.log('Doctor:       doctor@clinic.com / doctor123');
  console.log('Doctor 2:     doctor2@clinic.com / doctor123');
  console.log('Receptionist: receptionist@clinic.com / receptionist123');
  console.log('Patient:      patient@clinic.com / patient123');
  console.log('Patient 2:    patient2@clinic.com / patient123');
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
