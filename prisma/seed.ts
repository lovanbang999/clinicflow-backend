import 'dotenv/config';
import {
  PrismaClient,
  UserRole,
  Gender,
  DayOfWeek,
  RoomType,
  ServiceCategoryType,
  PerformerType,
  ExamFormType,
  LabFormType,
  ScheduleSlotStatus,
  Service,
  Category,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIG & CLIENT
// ============================================
const databaseUrl = process.env.DATABASE_URL!;
const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  allowPublicKeyRetrieval: true,
});
const prisma = new PrismaClient({ adapter });

// ============================================
// SHARED HELPERS
// ============================================
let patientCodeCounter = 1;
function generatePatientCode(): string {
  const code = `BN-2026-${String(patientCodeCounter).padStart(4, '0')}`;
  patientCodeCounter++;
  return code;
}

const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

interface Icd10Item {
  code: string;
  name: string;
}

// ============================================
// SEED DATA CONSTANTS
// ============================================

const ROOMS = [
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
    name: 'Phòng khám 103',
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
    name: 'Phòng khám 203',
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

const CATEGORIES = [
  {
    code: 'CAT_NOIKHOA',
    name: 'Nội khoa',
    description: 'Khám nội khoa chung',
    type: ServiceCategoryType.EXAMINATION,
  },
  {
    code: 'CAT_XETNGHIEM',
    name: 'Xét nghiệm (Lab)',
    description: 'Xét nghiệm cận lâm sàng',
    type: ServiceCategoryType.LAB,
  },
  {
    code: 'CAT_CDHA',
    name: 'Chẩn đoán hình ảnh',
    description: 'Siêu âm, X-Quang',
    type: ServiceCategoryType.IMAGING,
  },
  {
    code: 'CAT_NHIKHOA',
    name: 'Nhi khoa',
    description: 'Khám và điều trị cho trẻ em',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_SANPHUKHOA',
    name: 'Sản phụ khoa',
    description: 'Chăm sóc sức khỏe phụ nữ và thai sản',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_CHINHHINH',
    name: 'Chấn thương chỉnh hình',
    description: 'Cơ xương khớp',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_TAMLY',
    name: 'Tâm lý',
    description: 'Tư vấn sức khỏe tâm thần',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_TMH',
    name: 'Tai Mũi Họng',
    description: 'Khám chuyên khoa TMH',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_DALIEU',
    name: 'Da liễu',
    description: 'Khám và điều trị bệnh ngoài da',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_NHAKHOA',
    name: 'Nha khoa',
    description: 'Răng Hàm Mặt',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_NHANKHOA',
    name: 'Nhãn khoa',
    description: 'Khám mắt',
    type: ServiceCategoryType.SPECIALIST,
  },
  {
    code: 'CAT_THANKINH',
    name: 'Thần kinh',
    description: 'Chẩn đoán và điều trị bệnh lý thần kinh',
    type: ServiceCategoryType.SPECIALIST,
  },
];

const DOCTORS = [
  {
    email: 'bs.nguyenvana@clinic.com',
    fullName: 'BS. Nguyễn Văn An',
    phone: '0901111111',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Nội khoa', 'Khám sức khỏe tổng quát'],
    qualifications: ['Bác sĩ CK1', 'Thạc sĩ Y khoa'],
    experience: 15,
    consultationFee: 0,
    bio: 'Bác sĩ có 15 năm kinh nghiệm trong lĩnh vực nội tổng quát, tận tâm với bệnh nhân.',
  },
  {
    email: 'bs.lethib@clinic.com',
    fullName: 'BS. Lê Thị Bình',
    phone: '0902222222',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Nội khoa', 'Tim mạch'],
    qualifications: ['Bác sĩ CK2', 'Tiến sĩ Y khoa'],
    experience: 12,
    consultationFee: 300000,
    bio: 'Chuyên gia tim mạch với 12 năm kinh nghiệm, từng tu nghiệp tại Nhật Bản.',
  },
  {
    email: 'bs.hoangquy@clinic.com',
    fullName: 'BS. Hoàng Quý',
    phone: '0903333444',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Chấn thương chỉnh hình', 'Cơ xương khớp'],
    qualifications: ['Bác sĩ CK2'],
    experience: 20,
    consultationFee: 400000,
    bio: 'Chuyên gia đầu ngành về chấn thương chỉnh hình với hơn 20 năm kinh nghiệm phẫu thuật.',
  },
  {
    email: 'bs.minhthu@clinic.com',
    fullName: 'BS. Đặng Minh Thư',
    phone: '0904444555',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Nhi khoa'],
    qualifications: ['Thạc sĩ Nhi khoa'],
    experience: 8,
    consultationFee: 0,
    bio: 'Bác sĩ Nhi khoa tận tâm, yêu trẻ, có kinh nghiệm xử lý các bệnh lý nhi khoa phổ biến.',
  },
  {
    email: 'bs.quanghuy@clinic.com',
    fullName: 'BS. Trần Quang Huy',
    phone: '0905555666',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Tâm lý lâm sàng', 'Sức khỏe tâm thần'],
    qualifications: ['Tiến sĩ Tâm lý'],
    experience: 15,
    consultationFee: 500000,
    bio: 'Chuyên gia tư vấn tâm lý, hỗ trợ điều trị trầm cảm, lo âu và các rối loạn tâm thần.',
  },
  {
    email: 'bs.tuyetmai@clinic.com',
    fullName: 'BS. Vương Tuyết Mai',
    phone: '0906666777',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Sản phụ khoa'],
    qualifications: ['Bác sĩ CK1'],
    experience: 10,
    consultationFee: 300000,
    bio: 'Chuyên khám thai định kỳ, tư vấn sức khỏe sinh sản và điều trị phụ khoa.',
  },
  {
    email: 'bs.giabao@clinic.com',
    fullName: 'BS. Phạm Gia Bảo',
    phone: '0907777888',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Tiêu hóa', 'Gan mật'],
    qualifications: ['Thạc sĩ Y khoa'],
    experience: 12,
    consultationFee: 250000,
    bio: 'Chuyên gia nội soi tiêu hóa, điều trị các bệnh lý dạ dày, đại tràng và gan mật.',
  },
  {
    email: 'bs.thanhha@clinic.com',
    fullName: 'BS. Nguyễn Thanh Hà',
    phone: '0908888999',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Nội tiết', 'Tiểu đường'],
    qualifications: ['Bác sĩ CK2'],
    experience: 18,
    consultationFee: 350000,
    bio: 'Chuyên điều trị tiểu đường, cường giáp và các rối loạn nội tiết phức tạp.',
  },
  {
    email: 'bs.huuphuoc@clinic.com',
    fullName: 'BS. Lê Hữu Phước',
    phone: '0909999000',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Tai Mũi Họng'],
    qualifications: ['Bác sĩ CK1'],
    experience: 9,
    consultationFee: 0,
    bio: 'Bác sĩ chuyên khoa Tai Mũi Họng, giàu kinh nghiệm điều trị viêm xoang, viêm họng mãn tính.',
  },
  {
    email: 'bs.lananh@clinic.com',
    fullName: 'BS. Đỗ Lan Anh',
    phone: '0901112223',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Dị ứng', 'Miễn dịch lâm sàng'],
    qualifications: ['Thạc sĩ Y khoa'],
    experience: 7,
    consultationFee: 250000,
    bio: 'Chuyên điều trị các bệnh dị ứng, hen suyễn và các vấn đề miễn dịch hệ thống.',
  },
  {
    email: 'bs.minhquan@clinic.com',
    fullName: 'BS. Ngô Minh Quân',
    phone: '0902223334',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Thần kinh'],
    qualifications: ['Bác sĩ CK2'],
    experience: 22,
    consultationFee: 450000,
    bio: 'Chuyên gia thần kinh, điều trị đau đầu, mất ngủ, tiền đình và các bệnh lý não bộ.',
  },
  {
    email: 'bs.thuhuong@clinic.com',
    fullName: 'BS. Trịnh Thu Hương',
    phone: '0903334445',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Dinh dưỡng'],
    qualifications: ['Bác sĩ CK1'],
    experience: 6,
    consultationFee: 200000,
    bio: 'Tư vấn chế độ dinh dưỡng cho người bệnh, trẻ em và người muốn giảm cân khoa học.',
  },
  {
    email: 'bs.tiendung@clinic.com',
    fullName: 'BS. Bùi Tiến Dũng',
    phone: '0904445556',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Phục hồi chức năng'],
    qualifications: ['Thạc sĩ Phục hồi chức năng'],
    experience: 11,
    consultationFee: 250000,
    bio: 'Hỗ trợ bệnh nhân hồi phục sau phẫu thuật hoặc sau tai biến mạch máu não.',
  },
  {
    email: 'bs.thaonguyen@clinic.com',
    fullName: 'BS. Lê Thảo Nguyên',
    phone: '0905556667',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Hô hấp'],
    qualifications: ['Bác sĩ CK1'],
    experience: 13,
    consultationFee: 300000,
    bio: 'Chuyên điều trị các bệnh lý phổi, viêm phế quản và tắc nghẽn phổi mãn tính COPD.',
  },
  {
    email: 'bs.ngocmai@clinic.com',
    fullName: 'BS. Phan Ngọc Mai',
    phone: '0906667778',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Da liễu', 'Thẩm mỹ'],
    qualifications: ['Bác sĩ CK1'],
    experience: 9,
    consultationFee: 350000,
    bio: 'Chuyên da liễu và thẩm mỹ nội khoa, điều trị mụn, nám và trẻ hóa làn da.',
  },
  {
    email: 'bs.mylinh@clinic.com',
    fullName: 'BS. Trương Mỹ Linh',
    phone: '0907778889',
    role: UserRole.DOCTOR,
    gender: Gender.FEMALE,
    specialties: ['Nhãn khoa'],
    qualifications: ['Bác sĩ CK1'],
    experience: 11,
    consultationFee: 250000,
    bio: 'Chuyên gia nhãn khoa, chuyên khám và điều trị các bệnh lý về mắt và tật khúc xạ.',
  },
  {
    email: 'bs.hoangnam@clinic.com',
    fullName: 'BS. Nguyễn Hoàng Nam',
    phone: '0908889990',
    role: UserRole.DOCTOR,
    gender: Gender.MALE,
    specialties: ['Nha khoa'],
    qualifications: ['Bác sĩ CK1'],
    experience: 10,
    consultationFee: 300000,
    bio: 'Bác sĩ nha khoa giỏi, chuyên về phục hình răng và nha khoa thẩm mỹ.',
  },
];

const TECHNICIANS = [
  {
    email: 'ktv.phuong@clinic.com',
    fullName: 'KTV. Trần Thị Phương',
    phone: '0981111111',
    role: UserRole.TECHNICIAN,
    gender: Gender.FEMALE,
    specialties: ['Xét nghiệm'],
    qualifications: ['Cử nhân Xét nghiệm'],
    experience: 6,
    consultationFee: 0,
    bio: 'Kỹ thuật viên xét nghiệm tận tâm, chính xác.',
  },
  {
    email: 'ktv.tuan@clinic.com',
    fullName: 'KTV. Lê Anh Tuấn',
    phone: '0982222222',
    role: UserRole.TECHNICIAN,
    gender: Gender.MALE,
    specialties: ['Chẩn đoán hình ảnh'],
    qualifications: ['Cử nhân Chẩn đoán hình ảnh'],
    experience: 5,
    consultationFee: 0,
    bio: 'Kỹ thuật viên chuyên về Siêu âm và X-quang.',
  },
];

const RECEPTIONISTS = [
  {
    email: 'letan.huong@clinic.com',
    fullName: 'Nguyễn Thị Hương',
    phone: '0906666666',
    gender: Gender.FEMALE,
  },
  {
    email: 'letan.lan@clinic.com',
    fullName: 'Trần Thị Lan',
    phone: '0907777777',
    gender: Gender.FEMALE,
  },
];

const PATIENTS = [
  {
    email: 'patient.nam@gmail.com',
    fullName: 'Nguyễn Văn Nam',
    phone: '0988888888',
    gender: Gender.MALE,
    bloodType: 'O+',
  },
  {
    email: 'patient.linh@gmail.com',
    fullName: 'Lê Thị Linh',
    phone: '0989999999',
    gender: Gender.FEMALE,
    bloodType: 'A+',
  },
  {
    email: 'patient.tuan@gmail.com',
    fullName: 'Trần Anh Tuấn',
    phone: '0981111111',
    gender: Gender.MALE,
    bloodType: 'B+',
  },
  {
    email: 'patient.mai@gmail.com',
    fullName: 'Phạm Thị Mai',
    phone: '0982222222',
    gender: Gender.FEMALE,
    bloodType: 'AB+',
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function main() {
  console.log('🌱 Starting database seed v4.0 (Modular & Expanded)...');

  // 1. DELETE ALL DATA
  console.log('\n🗑️  Clearing existing data...');

  // List of functions to delete data in order
  const deleteActions = [
    () => prisma.aiChatMessage.deleteMany(),
    () => prisma.aiChatSession.deleteMany(),
    () => prisma.payment.deleteMany(),
    () => prisma.invoiceItem.deleteMany(),
    () => prisma.invoice.deleteMany(),
    () => prisma.labResult.deleteMany(),
    () => prisma.labOrder.deleteMany(),
    () => prisma.prescriptionItem.deleteMany(),
    () => prisma.prescription.deleteMany(),
    () => prisma.visitServiceOrder.deleteMany(),
    () => prisma.medicalRecord.deleteMany(),
    () => prisma.bookingStatusHistory.deleteMany(),
    () => prisma.bookingQueue.deleteMany(),
    () => prisma.booking.deleteMany(),
    () => prisma.doctorService.deleteMany(),
    () => prisma.doctorBreakTime.deleteMany(),
    () => prisma.doctorOffDay.deleteMany(),
    () => prisma.doctorScheduleSlot.deleteMany(),
    () => prisma.doctorWorkingHours.deleteMany(),
    () => prisma.doctorProfile.deleteMany(),
    () => prisma.patientProfile.deleteMany(),
    () => prisma.notification.deleteMany(),
    () => prisma.auditLog.deleteMany(),
    () => prisma.systemConfig.deleteMany(),
    () => prisma.refreshToken.deleteMany(),
    () => prisma.verificationCode.deleteMany(),
    () => prisma.icd10Code.deleteMany(),
    () => prisma.service.deleteMany(),
    () => prisma.category.deleteMany(),
    () => prisma.room.deleteMany(),
    () => prisma.user.deleteMany(),
  ];

  for (const action of deleteActions) {
    try {
      await action();
    } catch {
      // Ignore if table doesn't exist or other minor issues
    }
  }
  console.log('  ✅ All data cleared');

  // 2. SEED ROOMS
  console.log('\n🏠 Creating rooms...');
  for (const room of ROOMS) {
    await prisma.room.create({ data: room });
  }
  console.log(`  ✅ Created ${ROOMS.length} rooms`);

  // 3. SEED CATEGORIES
  console.log('\n📁 Creating categories...');
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({ data: cat });
    categoryMap.set(cat.name, created.id);
  }
  console.log(`  ✅ Created ${CATEGORIES.length} categories`);

  // 4. SEED SERVICES
  console.log('\n🏥 Creating services...');
  const servicesData = [
    {
      name: 'Khám nội tổng quát',
      description: 'Khám sức khỏe định kỳ, tầm soát bệnh lý nội khoa',
      category: 'Nội khoa',
      price: 200000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.GENERAL,
    },
    {
      name: 'Khám tim mạch',
      description: 'Chuyên khoa tim mạch, huyết áp',
      category: 'Nội khoa',
      price: 300000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.CARDIOLOGY,
    },
    {
      name: 'Khám nhi khoa',
      description: 'Khám và tư vấn sức khỏe cho trẻ em',
      category: 'Nhi khoa',
      price: 250000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.GENERAL,
    },
    {
      name: 'Khám xương khớp',
      description: 'Chẩn đoán các bệnh lý cơ xương khớp',
      category: 'Chấn thương chỉnh hình',
      price: 400000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.ORTHOPEDIC,
    },
    {
      name: 'Khám sản phụ khoa',
      description: 'Khám thai, phụ khoa và tư vấn sức khỏe sinh sản',
      category: 'Sản phụ khoa',
      price: 300000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.GYNECOLOGY,
    },
    {
      name: 'Khám tâm lý',
      description: 'Tư vấn và trị liệu tâm lý',
      category: 'Tâm lý',
      price: 500000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.GENERAL,
    },
    {
      name: 'Khám mắt',
      description: 'Khám tật khúc xạ và các bệnh lý về mắt',
      category: 'Nhãn khoa',
      price: 200000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.EYE,
    },
    {
      name: 'Khám tai mũi họng',
      description: 'Nội soi và khám các bệnh lý TMH',
      category: 'Tai Mũi Họng',
      price: 200000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.ENT,
    },
    {
      name: 'Khám da liễu',
      description: 'Điều trị bệnh ngoài da và thẩm mỹ da',
      category: 'Da liễu',
      price: 350000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.DERMATOLOGY,
    },
    {
      name: 'Khám răng hàm mặt',
      description: 'Khám và điều trị các bệnh lý răng miệng',
      category: 'Nha khoa',
      price: 200000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.DENTAL,
    },
    {
      name: 'Khám tiêu hóa',
      description: 'Chuyên khoa tiêu hóa, gan mật',
      category: 'Nội khoa',
      price: 250000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.GASTRO,
    },
    {
      name: 'Khám nội tiết',
      description: 'Điều trị tiểu đường, bệnh lý tuyến giáp',
      category: 'Nội khoa',
      price: 350000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.ENDOCRINE,
    },
    {
      name: 'Khám thần kinh',
      description: 'Chẩn đoán đau đầu, chóng mặt, rối loạn thần kinh, mất ngủ',
      category: 'Thần kinh',
      price: 450000,
      pType: PerformerType.DOCTOR,
      eType: ExamFormType.NEUROLOGY,
    },

    // Lab Services (Nhóm 1 - KTV thực hiện)
    {
      name: 'Tổng phân tích tế bào máu (CBC)',
      description: 'Kiểm tra các thành phần tế bào máu',
      category: 'Xét nghiệm (Lab)',
      price: 150000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.BLOOD_LAB,
    },
    {
      name: 'Đường huyết đói (FBS)',
      description: 'Kiểm tra nồng độ đường trong máu',
      category: 'Xét nghiệm (Lab)',
      price: 80000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.BLOOD_LAB,
    },
    {
      name: 'Chức năng gan (AST, ALT, GGT)',
      description: 'Đánh giá tình trạng viêm gan, tổn thương gan',
      category: 'Xét nghiệm (Lab)',
      price: 240000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.BLOOD_LAB,
    },
    {
      name: 'Chức năng thận (Ure, Creatinin)',
      description: 'Đánh giá khả năng lọc của thận',
      category: 'Xét nghiệm (Lab)',
      price: 160000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.BLOOD_LAB,
    },
    {
      name: 'Tổng phân tích nước tiểu (10 chỉ số)',
      description: 'Kiểm tra các bệnh lý về tiết niệu, thận',
      category: 'Xét nghiệm (Lab)',
      price: 100000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.URINE_LAB,
    },
    {
      name: 'Siêu âm ổ bụng tổng quát',
      description: 'Quan sát các cơ quan nội tạng trong bụng',
      category: 'Chẩn đoán hình ảnh',
      price: 250000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.IMAGING,
    },
    {
      name: 'Siêu âm tim Doppler',
      description: 'Kiểm tra cấu trúc và chức năng tim',
      category: 'Chẩn đoán hình ảnh',
      price: 500000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.IMAGING,
    },
    {
      name: 'X-quang ngực thẳng',
      description: 'Kiểm tra tim, phổi và khung xương sườn',
      category: 'Chẩn đoán hình ảnh',
      price: 150000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.IMAGING,
    },
    {
      name: 'Chụp CT-Scanner đầu',
      description: 'Tầm soát chấn thương hoặc bệnh lý não',
      category: 'Chẩn đoán hình ảnh',
      price: 1200000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.IMAGING,
    },
    {
      name: 'Điện tâm đồ (ECG)',
      description: 'Ghi lại hoạt động điện của tim',
      category: 'Chẩn đoán hình ảnh',
      price: 120000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.ECG,
    },
    {
      name: 'Nội soi dạ dày (không gây mê)',
      description: 'Quan sát trực tiếp thực quản và dạ dày',
      category: 'Chẩn đoán hình ảnh',
      price: 600000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.ENDOSCOPY,
    },
    {
      name: 'Đo chức năng hô hấp',
      description: 'Tầm soát bệnh lý phổi tắc nghẽn',
      category: 'Chẩn đoán hình ảnh',
      price: 200000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.SPIROMETRY,
    },
    {
      name: 'Đo loãng xương (DEXA)',
      description: 'Kiểm tra mật độ xương',
      category: 'Chẩn đoán hình ảnh',
      price: 350000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.BONE_DENSITY,
    },
    {
      name: 'Dịch vụ kỹ thuật khác',
      description: 'Các thủ thuật kỹ thuật chung',
      category: 'Chẩn đoán hình ảnh',
      price: 100000,
      pType: PerformerType.TECHNICIAN,
      lType: LabFormType.GENERAL,
    },
  ];

  const createdServices: (Service & { category: Category | null })[] = [];
  for (const s of servicesData) {
    const created = await prisma.service.create({
      data: {
        name: s.name,
        description: s.description,
        price: s.price,
        durationMinutes: 30,
        categoryId: categoryMap.get(s.category)!,
        performerType: s.pType,
        examFormType: s.eType || ExamFormType.GENERAL,
        labFormType: s.lType || LabFormType.GENERAL,
      },
      include: { category: true },
    });
    createdServices.push(created);
  }
  console.log(`  ✅ Created ${servicesData.length} services`);

  // 5. SEED ADMIN
  console.log('\n👥 Creating users...');
  await prisma.user.create({
    data: {
      email: 'admin@clinic.com',
      password: await hashPassword('admin123'),
      role: UserRole.ADMIN,
      fullName: 'Quản Trị Viên Hệ Thống',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('  ✅ Admin created');

  // 6. SEED DOCTORS & TECHNICIANS
  const allProviders = [...DOCTORS, ...TECHNICIANS];
  for (const p of allProviders) {
    const user = await prisma.user.create({
      data: {
        email: p.email,
        password: await hashPassword(
          p.role === UserRole.DOCTOR ? 'doctor123' : 'technician123',
        ),
        role: p.role,
        fullName: p.fullName,
        phone: p.phone,
        gender: p.gender,
        isActive: true,
        isVerified: true,
        doctorProfile: {
          create: {
            specialties: p.specialties,
            qualifications: p.qualifications,
            yearsOfExperience: p.experience,
            bio: p.bio,
            consultationFee: p.consultationFee,
            rating: 4.5 + Math.random() * 0.5,
            reviewCount: Math.floor(Math.random() * 200),
          },
        },
      },
    });

    // Link doctor to services matching their specialties
    if (p.role === UserRole.DOCTOR) {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: user.id },
      });

      if (doctorProfile) {
        for (const service of createdServices) {
          // Check if doctor specialty matches service category or service name
          const isMatch = p.specialties.some(
            (spec) =>
              spec.toLowerCase() === service.category?.name.toLowerCase() ||
              service.name.toLowerCase().includes(spec.toLowerCase()),
          );

          if (isMatch) {
            await prisma.doctorService.create({
              data: {
                doctorProfileId: doctorProfile.id,
                serviceId: service.id,
              },
            });
          }
        }
      }
    }

    // Create Working Hours (T2-T7, 08:00 - 17:00)
    for (const day of [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ]) {
      await prisma.doctorWorkingHours.create({
        data: {
          doctorId: user.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '17:00',
        },
      });
    }
  }
  console.log(
    `  ✅ Created ${allProviders.length} providers with profiles and working hours`,
  );

  // 6b. SEED SCHEDULE SLOTS — 30 days of demo slots for every doctor
  console.log('\n📅 Creating schedule slots...');
  const allDoctors = await prisma.user.findMany({
    where: { role: UserRole.DOCTOR, isActive: true },
    select: { id: true },
  });
  const consultationRooms = await prisma.room.findMany({
    where: { type: RoomType.CONSULTATION, isActive: true },
    select: { id: true },
  });

  if (allDoctors.length > 0 && consultationRooms.length > 0) {
    const timeBlocks = [
      { start: '08:00', end: '09:00' },
      { start: '09:00', end: '10:00' },
      { start: '10:00', end: '11:00' },
      { start: '13:30', end: '14:30' },
      { start: '14:30', end: '15:30' },
      { start: '15:30', end: '16:30' },
    ];

    // Use VN timezone to get the correct "today" date string, then construct
    // a UTC midnight Date so MySQL @db.Date stores the correct VN date.
    const todayVN = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date()); // e.g. "2026-04-20"
    const today = new Date(todayVN + 'T00:00:00.000Z');

    const slotData: {
      doctorId: string;
      roomId: string;
      date: Date;
      startTime: string;
      endTime: string;
      maxPatients: number;
      bookedCount: number;
      status: ScheduleSlotStatus;
      isActive: boolean;
      maxPreBookings: number;
      maxQueueSize: number;
      preBookedCount: number;
      queueCount: number;
    }[] = [];
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const slotDate = new Date(today);
      slotDate.setDate(today.getDate() + dayOffset);

      for (let di = 0; di < allDoctors.length; di++) {
        const room = consultationRooms[di % consultationRooms.length];
        for (const block of timeBlocks) {
          slotData.push({
            doctorId: allDoctors[di].id,
            roomId: room.id,
            date: slotDate,
            startTime: block.start,
            endTime: block.end,
            maxPatients: 1,
            bookedCount: 0,
            status: ScheduleSlotStatus.SCHEDULED,
            isActive: true,
            maxPreBookings: 1,
            maxQueueSize: 5,
            preBookedCount: 0,
            queueCount: 0,
          });
        }
      }
    }

    await prisma.doctorScheduleSlot.createMany({ data: slotData });
    console.log(
      `  ✅ Created ${slotData.length} schedule slots across ${allDoctors.length} doctors for 30 days`,
    );
  } else {
    console.warn(
      '  ⚠️ No doctors or consultation rooms found — skipping slot generation',
    );
  }

  // 7. SEED RECEPTIONISTS
  for (const r of RECEPTIONISTS) {
    await prisma.user.create({
      data: {
        email: r.email,
        password: await hashPassword('receptionist123'),
        role: UserRole.RECEPTIONIST,
        fullName: r.fullName,
        phone: r.phone,
        gender: r.gender,
        isActive: true,
        isVerified: true,
      },
    });
  }
  console.log('  ✅ Receptionists created');

  // 8. SEED PATIENTS
  for (const p of PATIENTS) {
    await prisma.user.create({
      data: {
        email: p.email,
        password: await hashPassword('patient123'),
        role: UserRole.PATIENT,
        fullName: p.fullName,
        phone: p.phone,
        gender: p.gender,
        isActive: true,
        isVerified: true,
        patientProfile: {
          create: {
            fullName: p.fullName,
            phone: p.phone,
            email: p.email,
            gender: p.gender,
            bloodType: p.bloodType,
            patientCode: generatePatientCode(),
          },
        },
      },
    });
  }
  console.log('  ✅ Patients created');

  // 12. SEED ICD10 CODES
  console.log('\n🩺 Seeding ICD-10 codes...');
  const icd10Path = path.join(__dirname, '../../Tools/icd10_vietnamese.json');
  if (fs.existsSync(icd10Path)) {
    try {
      const icd10Data = JSON.parse(
        fs.readFileSync(icd10Path, 'utf8'),
      ) as Icd10Item[];
      console.log(`  Found ${icd10Data.length} ICD-10 codes. Importing...`);

      const chunkSize = 1000;
      for (let i = 0; i < icd10Data.length; i += chunkSize) {
        const chunk = icd10Data
          .slice(i, i + chunkSize)
          .map((item: Icd10Item) => ({
            code: item.code,
            name: item.name,
          }));
        await prisma.icd10Code.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        if (i % 5000 === 0) {
          console.log(
            `    Imported ${i + chunk.length}/${icd10Data.length}...`,
          );
        }
      }
      console.log('  ✅ ICD-10 codes seeded successfully');
    } catch (error) {
      console.error('  ❌ Error seeding ICD-10 codes:', error);
    }
  } else {
    console.warn('  ⚠️ ICD-10 file not found at', icd10Path);
  }

  console.log('\n🚀 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
