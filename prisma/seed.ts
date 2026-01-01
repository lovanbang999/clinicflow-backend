import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
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
  // 1. CREATE USERS
  // ============================================
  console.log('\n👥 Creating users...');

  // ADMIN
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      password: await hashPassword('admin123'),
      role: UserRole.ADMIN,
      fullName: 'Quản Trị Viên Hệ Thống',
      phone: '0900000000',
      isActive: true,
    },
  });
  console.log('  ✅ Admin created:', admin.email);

  // DOCTORS
  const doctors = [
    {
      email: 'bs.nguyenvana@clinic.com',
      fullName: 'BS. Nguyễn Văn An',
      phone: '0901111111',
      specialty: 'Khám tổng quát',
    },
    {
      email: 'bs.lethib@clinic.com',
      fullName: 'BS. Lê Thị Bình',
      phone: '0902222222',
      specialty: 'Tim mạch',
    },
    {
      email: 'bs.tranthic@clinic.com',
      fullName: 'BS. Trần Thị Cẩm',
      phone: '0903333333',
      specialty: 'Da liễu',
    },
    {
      email: 'bs.phamvand@clinic.com',
      fullName: 'BS. Phạm Văn Dũng',
      phone: '0904444444',
      specialty: 'Răng hàm mặt',
    },
    {
      email: 'bs.hoangthie@clinic.com',
      fullName: 'BS. Hoàng Thị Em',
      phone: '0905555555',
      specialty: 'Mắt',
    },
  ];

  const createdDoctors: User[] = [];
  for (const doctor of doctors) {
    const created = await prisma.user.upsert({
      where: { email: doctor.email },
      update: {},
      create: {
        email: doctor.email,
        password: await hashPassword('doctor123'),
        role: UserRole.DOCTOR,
        fullName: doctor.fullName,
        phone: doctor.phone,
        isActive: true,
      },
    });
    createdDoctors.push(created);
    console.log(
      `  ✅ Doctor created: ${created.fullName} (${doctor.specialty})`,
    );
  }

  // RECEPTIONISTS
  const receptionists = [
    {
      email: 'letan.huong@clinic.com',
      fullName: 'Nguyễn Thị Hương',
      phone: '0906666666',
    },
    {
      email: 'letan.lan@clinic.com',
      fullName: 'Trần Thị Lan',
      phone: '0907777777',
    },
  ];

  for (const receptionist of receptionists) {
    const created = await prisma.user.upsert({
      where: { email: receptionist.email },
      update: {},
      create: {
        email: receptionist.email,
        password: await hashPassword('receptionist123'),
        role: UserRole.RECEPTIONIST,
        fullName: receptionist.fullName,
        phone: receptionist.phone,
        isActive: true,
      },
    });
    console.log(`  ✅ Receptionist created: ${created.fullName}`);
  }

  // PATIENTS
  const patients = [
    {
      email: 'patient.nam@gmail.com',
      fullName: 'Nguyễn Văn Nam',
      phone: '0908888888',
    },
    {
      email: 'patient.linh@gmail.com',
      fullName: 'Lê Thị Linh',
      phone: '0909999999',
    },
    {
      email: 'patient.tuan@gmail.com',
      fullName: 'Trần Anh Tuấn',
      phone: '0911111111',
    },
    {
      email: 'patient.mai@gmail.com',
      fullName: 'Phạm Thị Mai',
      phone: '0912222222',
    },
    {
      email: 'patient.hung@gmail.com',
      fullName: 'Hoàng Văn Hùng',
      phone: '0913333333',
    },
    {
      email: 'patient.thu@gmail.com',
      fullName: 'Võ Thị Thu',
      phone: '0914444444',
    },
    {
      email: 'patient.dat@gmail.com',
      fullName: 'Đặng Minh Đạt',
      phone: '0915555555',
    },
    {
      email: 'patient.nhi@gmail.com',
      fullName: 'Bùi Thị Nhi',
      phone: '0916666666',
    },
  ];

  for (const patient of patients) {
    const created = await prisma.user.upsert({
      where: { email: patient.email },
      update: {},
      create: {
        email: patient.email,
        password: await hashPassword('patient123'),
        role: UserRole.PATIENT,
        fullName: patient.fullName,
        phone: patient.phone,
        isActive: true,
      },
    });
    console.log(`  ✅ Patient created: ${created.fullName}`);
  }

  // ============================================
  // 2. CREATE SERVICES
  // ============================================
  console.log('\n🏥 Creating services...');

  const services = [
    {
      name: 'Khám tổng quát',
      description: 'Khám sức khỏe định kỳ, tư vấn các vấn đề sức khỏe chung',
      durationMinutes: 30,
      price: 200000,
      maxSlotsPerHour: 3,
    },
    {
      name: 'Khám tim mạch',
      description: 'Siêu âm tim, điện tâm đồ, tư vấn điều trị bệnh tim mạch',
      durationMinutes: 45,
      price: 300000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám da liễu',
      description: 'Điều trị mụn, nám, viêm da, dị ứng da',
      durationMinutes: 30,
      price: 250000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám răng hàm mặt',
      description: 'Khám tổng quát, lấy cao răng, nhổ răng, trám răng',
      durationMinutes: 45,
      price: 350000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám mắt',
      description: 'Đo thị lực, khám bệnh về mắt, kê đơn kính',
      durationMinutes: 30,
      price: 200000,
      maxSlotsPerHour: 3,
    },
    {
      name: 'Xét nghiệm',
      description: 'Xét nghiệm máu, nước tiểu, các xét nghiệm chuyên sâu',
      durationMinutes: 15,
      price: 150000,
      maxSlotsPerHour: 4,
    },
    {
      name: 'Siêu âm tổng quát',
      description: 'Siêu âm bụng, siêu âm tuyến giáp, siêu âm vú',
      durationMinutes: 30,
      price: 280000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Nội soi',
      description: 'Nội soi dạ dày, nội soi đại tràng',
      durationMinutes: 60,
      price: 500000,
      maxSlotsPerHour: 1,
    },
    {
      name: 'Khám tai mũi họng',
      description: 'Khám và điều trị bệnh tai mũi họng',
      durationMinutes: 30,
      price: 220000,
      maxSlotsPerHour: 2,
    },
    {
      name: 'Khám sản phụ khoa',
      description: 'Khám thai, tư vấn sức khỏe phụ nữ',
      durationMinutes: 45,
      price: 300000,
      maxSlotsPerHour: 2,
    },
  ];

  const createdServices: Service[] = [];
  for (const service of services) {
    const created = await prisma.service.upsert({
      where: { name: service.name },
      update: {},
      create: service,
    });
    createdServices.push(created);
    console.log(
      `  ✅ Service created: ${created.name} (${created.price.toString()}đ)`,
    );
  }

  // ============================================
  // 3. CREATE DOCTOR WORKING HOURS
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
      await prisma.doctorWorkingHours.upsert({
        where: {
          doctorId_dayOfWeek: {
            doctorId: doctor.id,
            dayOfWeek: day,
          },
        },
        update: {
          startTime: '08:00',
          endTime: '17:00',
        },
        create: {
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '17:00',
        },
      });
      workingHoursCount++;
    }

    // Saturday: 8:00 - 12:00 (half day)
    await prisma.doctorWorkingHours.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: doctor.id,
          dayOfWeek: DayOfWeek.SATURDAY,
        },
      },
      update: {
        startTime: '08:00',
        endTime: '12:00',
      },
      create: {
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
  // 4. CREATE BREAK TIMES (Lunch breaks)
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
          date: breakDate,
          startTime: '12:00',
          endTime: '13:00',
          reason: 'Lunch break',
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
  const workingHoursCount2 = await prisma.doctorWorkingHours.count();
  const breakTimeCount2 = await prisma.doctorBreakTime.count();

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
  console.log(`🏥 Services: ${serviceCount}`);
  console.log(`⏰ Working Hours: ${workingHoursCount2}`);
  console.log(`🍽️ Break Times: ${breakTimeCount2}`);
  console.log('==========================================');

  console.log('\n📝 Demo Credentials:');
  console.log('==========================================');
  console.log('ADMIN:');
  console.log('  admin@clinic.com / admin123');
  console.log('\nDOCTORS:');
  console.log('  bs.nguyenvana@clinic.com / doctor123 (Khám tổng quát)');
  console.log('  bs.lethib@clinic.com / doctor123 (Tim mạch)');
  console.log('  bs.tranthic@clinic.com / doctor123 (Da liễu)');
  console.log('  bs.phamvand@clinic.com / doctor123 (Răng hàm mặt)');
  console.log('  bs.hoangthie@clinic.com / doctor123 (Mắt)');
  console.log('\nRECEPTIONISTS:');
  console.log('  letan.huong@clinic.com / receptionist123');
  console.log('  letan.lan@clinic.com / receptionist123');
  console.log('\nPATIENTS:');
  console.log('  patient.nam@gmail.com / patient123');
  console.log('  patient.linh@gmail.com / patient123');
  console.log('  patient.tuan@gmail.com / patient123');
  console.log('  patient.mai@gmail.com / patient123');
  console.log('  (... và 4 bệnh nhân khác)');
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
