// @ts-nocheck
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/modules/prisma/prisma.service';
import { BookingsService } from './src/modules/bookings/bookings.service';
import { BillingService } from './src/modules/billing/billing.service';
import { LabOrdersService } from './src/modules/lab-orders/lab-orders.service';
import { QueueGateway } from './src/modules/queue/queue.gateway';
import { BookingSource, UserRole, PaymentMethod } from '@prisma/client';

// Helper to log with colors
const color = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

function logStep(stepNum: number, title: string, data?: any) {
  console.log(`\n${color.yellow(`[Step ${stepNum}] ${title}`)}`);
  if (data) {
    console.log(color.cyan(JSON.stringify(data, null, 2)));
  }
}

async function bootstrap() {
  console.log(color.blue('🚀 Khởi tạo ứng dụng NestJS Standalone để Verify Workflow...'));
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const bookingsService = app.get(BookingsService);
  const billingService = app.get(BillingService);
  const labOrdersService = app.get(LabOrdersService);

  // Mock WebSocket Gateway to prevent errors in standalone mode
  const queueGateway = app.get(QueueGateway);
  queueGateway.broadcastQueueUpdate = async () => {};

  try {
    // 0. Setup: Lấy dữ liệu test từ DB
    console.log('Đang tìm dữ liệu mẫu trong DB...');
    const patientProfile = await prisma.patientProfile.findFirst();
    const doctor = await prisma.user.findFirst({ where: { role: UserRole.DOCTOR } });
    const receptionist = await prisma.user.findFirst({ where: { role: UserRole.RECEPTIONIST } });
    const consultationService = await prisma.service.findFirst({ where: { name: { contains: 'Khám' } } }) || await prisma.service.findFirst();
    const labTestService = await prisma.service.findFirst({ where: { name: { contains: 'Xét nghiệm' } } }) || await prisma.service.findFirst();

    if (!patientProfile || !doctor || !receptionist || !consultationService) {
      throw new Error('Không đủ dữ liệu mẫu trong DB (Patient, Doctor, Receptionist, Service). Vui lòng setup data trước.');
    }

    console.log(color.green(`Đã tìm thấy:
- Bệnh nhân: ${patientProfile.fullName}
- Bác sĩ: ${doctor.fullName}
- Lễ tân: ${receptionist.fullName}
- Dịch vụ khám: ${consultationService.name} (Giá: ${consultationService.price})
- Dịch vụ cận lâm sàng: ${labTestService?.name} (Giá: ${labTestService?.price})`));

    console.log(color.yellow('Đang dọn dẹp các booking nháp của test trước...'));
    const oldBookings = await prisma.booking.findMany({
      where: {
        patientProfileId: patientProfile.id,
        doctorId: doctor.id,
        bookingDate: { gte: new Date() }
      }
    });
    const bookingIds = oldBookings.map(b => b.id);
    if (bookingIds.length > 0) {
      const oldInvoices = await prisma.invoice.findMany({ where: { bookingId: { in: bookingIds } } });
      const invoiceIds = oldInvoices.map(i => i.id);
      if (invoiceIds.length > 0) {
        await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }
      await prisma.bookingQueue.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.labOrder.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }

    // ==========================================
    // Phase 1: Lễ Tân + Đóng tiền khám
    // ==========================================

    logStep(1, 'Lễ tân tạo Booking (WALK_IN)');
    // Giả lập lịch khám vào 8h sáng ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDateStr = tomorrow.toISOString().split('T')[0];

    const bookingRes = await bookingsService.createByReceptionist(
      {
        patientProfileId: patientProfile.id,
        doctorId: doctor.id,
        serviceId: consultationService.id,
        bookingDate: bookingDateStr,
        startTime: '08:00',
        source: BookingSource.WALK_IN,
      },
      receptionist.id,
    );
    const bookingId = bookingRes.data.id;
    logStep(1, 'Kết quả tạo Booking', {
      bookingId,
      status: bookingRes.data.status,
    });

    logStep(1.5, 'Kiểm tra xem Invoice DRAFT đã tự tạo chưa?');
    const getInvoiceRes = await billingService.getInvoiceByBooking(bookingId);
    let invoiceId = getInvoiceRes.data.id;
    logStep(1.5, 'Invoice Data', {
      invoiceId,
      status: getInvoiceRes.data.status,
      items: getInvoiceRes.data.items.length,
      subtotal: getInvoiceRes.data.subtotal,
    });

    if (getInvoiceRes.data.status !== 'DRAFT') throw new Error('Invoice KHÔNG phải DRAFT nha!');

    logStep(2, 'Lễ tân Check-in Bệnh nhân vào hàng đợi');
    const checkinRes = await bookingsService.checkIn(bookingId, receptionist.id);
    logStep(2, 'Booking Status', checkinRes.data.booking.status);

    logStep(3, 'Lễ tân thu tiền khám đợt 1');
    const payment1Res = await billingService.addPayment(
      invoiceId,
      {
        amountPaid: Number(consultationService.price),
        paymentMethod: PaymentMethod.CASH,
        notes: 'Thu tiền khám đầu vào',
      },
      receptionist.id,
    );
    logStep(3, 'Invoice sau Payment 1', {
      status: payment1Res.data.status,
      totalPayments: payment1Res.data.payments.length,
    });
    if (payment1Res.data.status !== 'OPEN') throw new Error('Invoice không nhảy sang OPEN!');

    // ==========================================
    // Phase 2: Bác sĩ khám + Ra chỉ định
    // ==========================================

    logStep(4, 'Bác sĩ bắt đầu khám bệnh');
    const startRes = await bookingsService.startExamination(bookingId, doctor.id);
    logStep(4, 'Booking Status', startRes.data.status);

    logStep(5, 'Bác sĩ ra chỉ định Cận lâm sàng (Xét nghiệm)');
    const labOrderRes = await labOrdersService.createOrder(doctor.id, {
      bookingId,
      testName: labTestService?.name || 'Xét nghiệm máu',
      serviceId: labTestService?.id,
    });
    const labOrderId = labOrderRes.data.id;
    logStep(5, 'LabOrder tạo ra', {
      id: labOrderId,
      status: labOrderRes.data.status,
    });

    logStep(5.5, 'Kiểm tra InvoiceItem có chui vào hoá đơn tổng không?');
    const invoiceAfterLab = await billingService.getInvoiceById(invoiceId);
    logStep(5.5, 'Items trên Invoice lúc này', invoiceAfterLab.data.items.map(i => ({
      name: i.itemName,
      price: i.unitPrice,
      isLab: !!i.labOrderId,
    })));
    if (invoiceAfterLab.data.items.length < 2) throw new Error('InvoiceItem của Xét nghiệm chưa được add tự động!');


    // ==========================================
    // Phase 3: Thu tiền xét nghiệm + Thực hiện
    // ==========================================

    logStep(6, 'Lễ tân thu tiền Xét nghiệm đợt 2');
    // Tìm item XN để lấy giá tiền
    const labItem = invoiceAfterLab.data.items.find(i => i.labOrderId === labOrderId);
    const payment2Res = await billingService.addPayment(
      invoiceId,
      {
        amountPaid: Number(labItem!.unitPrice),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        labOrderId: labOrderId, // Gắn ID xét nghiệm
      },
      receptionist.id,
    );
    logStep(6, 'Thanh toán đợt 2 thành công', { invoiceStatus: payment2Res.data.status });
    
    // Khẳng định LabOrder phải chuyển thành PAID
    const checkLabOrderStatus = await prisma.labOrder.findUnique({ where: { id: labOrderId } });
    logStep(6, 'Status của LabOrder sau khi Lễ tân thu tiền:', checkLabOrderStatus?.status);
    if (checkLabOrderStatus?.status !== 'PAID') throw new Error('LabOrder KHÔNG chuyển sang PAID, phòng XN không dám làm!');

    logStep(7, 'Kỹ thuật viên thực hiện xét nghiệm & trả kết quả');
    const kienThucVienId = doctor.id; // Mượn ID bác sĩ làm KTV cho lẹ
    const resultRes = await labOrdersService.addResult(kienThucVienId, labOrderId!, {
      resultText: 'Chỉ số bình thường, gan máu nhiễm mỡ nhẹ',
      isAbnormal: false,
    });
    logStep(7, 'LabOrder Status', resultRes.data.status);

    // ==========================================
    // Phase 4: Chốt Khám + Chốt Hoá đơn
    // ==========================================

    logStep(8, 'Bác sĩ đánh giá và Bấm hoàn tất ca khám');
    const completeBookingRes = await bookingsService.completeVisit(bookingId, doctor.id, 'Uống nhiều nước, tập thể dục');
    logStep(8, 'Booking Status', completeBookingRes.data.status);
    
    // Khẳng định Invoice đã nhảy sang ISSUED
    const checkInvoiceStatus = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    logStep(8, 'Invoice Status sau khi bác sĩ chốt:', checkInvoiceStatus?.status);
    if (checkInvoiceStatus?.status !== 'ISSUED') throw new Error('Invoice phải chuyển sang ISSUED!');

    logStep(9, 'Lễ tân/Thu ngân bấm CHỐT HÓA ĐƠN cho bệnh nhân ra về');
    const finalizeRes = await billingService.finalizeInvoice(invoiceId);
    logStep(9, 'FINAL INVOICE', {
      status: finalizeRes.data.status,
      totalPayments: finalizeRes.data.payments.length,
      patientCoPayment: finalizeRes.data.patientCoPayment,
      insuranceAmount: finalizeRes.data.insuranceAmount,
    });
    if (finalizeRes.data.status !== 'PAID') throw new Error('Invoice chưa chuyển sang PAID hoàn toàn!');

    console.log('\n=============================================');
    console.log(color.green('🎉 HOÀN HẢO! LUỒNG THANH TOÁN VN (WORKFLOW A) CHẠY THÀNH CÔNG TỪ A-Z KHÔNG LỖI! 🎉'));
    console.log('=============================================');

  } catch (error) {
    console.error(color.red('\n❌ Lỗi trong quá trình chạy script test:'));
    console.error(error);
  } finally {
    await app.close();
  }
}

bootstrap();
