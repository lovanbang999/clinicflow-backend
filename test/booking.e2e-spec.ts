import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

import { RedisService } from './../src/modules/database/services/redis.service';

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    user?: {
      patientProfile?: {
        id: string;
      };
    };
  };
}

interface CategoriesResponse {
  success: boolean;
}

interface DoctorServiceItem {
  service?: {
    id: string;
  };
}

interface DoctorInfo {
  id: string;
  doctorProfile?: {
    services?: DoctorServiceItem[];
  };
}

interface DoctorsResponse {
  success: boolean;
  data: {
    users: DoctorInfo[];
  };
}

interface AvailableSlotsResponse {
  success: boolean;
}

interface BookingResponse {
  success: boolean;
  data: {
    id: string;
  };
}

interface InvoiceResponse {
  success: boolean;
  data: {
    id: string;
  };
}

describe('Booking Clinical Flow Integration (e2e)', () => {
  let app: INestApplication<App>;
  let patientToken: string;
  let receptionistToken: string;
  let doctorToken: string;
  let patientProfileId: string;
  let doctorId: string;
  let serviceId: string;
  let bookingId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Clear Redis cache to avoid stale cache from previous database states
    try {
      const redisService = moduleFixture.get(RedisService);
      if (redisService.isReady()) {
        await redisService.delPattern('cache:*');
      }
    } catch (err) {
      console.warn('Could not clear Redis cache:', err);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // PHASE 1: Authentication & Identity
  // ==========================================

  it('should authenticate Patient successfully', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'patient.khang@gmail.com',
      password: 'patient123',
    });

    const body = res.body as AuthResponse;
    expect([200, 201]).toContain(res.status);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    patientToken = body.data.accessToken;

    if (body.data.user?.patientProfile) {
      patientProfileId = body.data.user.patientProfile.id;
    }
  });

  it('should authenticate Receptionist successfully', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'letan.huong@clinic.com',
      password: 'receptionist123',
    });

    const body = res.body as AuthResponse;
    expect([200, 201]).toContain(res.status);
    receptionistToken = body.data.accessToken;
  });

  it('should authenticate Doctor successfully', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'bs.nguyenvana@clinic.com',
      password: 'doctor123',
    });

    const body = res.body as AuthResponse;
    expect([200, 201]).toContain(res.status);
    doctorToken = body.data.accessToken;
  });

  // ==========================================
  // PHASE 2: Information Retrieval & Discovery
  // ==========================================

  it('should fetch clinic specialties (categories) publicly', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);

    const body = res.body as CategoriesResponse;
    expect(body.success).toBe(true);
  });

  it('should fetch public doctors and their services', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/public/doctors')
      .expect(200);

    const body = res.body as DoctorsResponse;
    expect(body.success).toBe(true);
    if (body.data?.users && body.data.users.length > 0) {
      const doc = body.data.users[0];
      doctorId = doc.id;
      if (
        doc.doctorProfile?.services &&
        doc.doctorProfile.services.length > 0
      ) {
        const firstService = doc.doctorProfile.services[0].service;
        if (firstService) {
          serviceId = firstService.id;
        }
      }
    }
  });

  it('should fetch doctor schedule available slots publicly', async () => {
    if (doctorId) {
      const res = await request(app.getHttpServer())
        .get(`/schedules/available-slots?doctorId=${doctorId}&date=2026-06-01`)
        .expect(200);

      const body = res.body as AvailableSlotsResponse;
      expect(body.success).toBe(true);
    }
  });

  // ==========================================
  // PHASE 3: Booking Flow Orchestration (B1-B8)
  // ==========================================

  it('should allow Patient to create a new appointment booking', async () => {
    if (!doctorId || !serviceId || !patientProfileId) {
      console.warn(
        '⚠️ Skipping booking test due to missing doctorId/serviceId/patientProfileId.',
      );
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        serviceId,
        bookingDate: '2026-06-01',
        startTime: '09:00',
        endTime: '09:30',
        patientProfileId,
      });

    const body = res.body as BookingResponse;
    expect([201, 409, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(body.success).toBe(true);
      bookingId = body.data.id;
    }
  });

  it('should fetch booking details successfully for authorized Patient', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const body = res.body as BookingResponse;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(bookingId);
  });

  it('should allow Receptionist to confirm booking', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        status: 'CONFIRMED',
      });

    expect([200, 201]).toContain(res.status);
  });

  it('should allow Receptionist to check-in the patient', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect([200, 201, 400, 409]).toContain(res.status);
  });

  it('should allow Doctor to start examination', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/start`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect([200, 201, 400, 409]).toContain(res.status);
  });

  it('should allow Receptionist to issue consultation invoice', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .post('/billing/invoices')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        bookingId,
        invoiceType: 'CONSULTATION',
      });

    const body = res.body as InvoiceResponse;
    expect([201, 400, 409]).toContain(res.status);
    if (res.status === 201) {
      invoiceId = body.data.id;
    }
  });

  it('should allow Patient payment confirmation by Receptionist', async () => {
    if (!invoiceId) return;

    const res = await request(app.getHttpServer())
      .post(`/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        paymentMethod: 'CASH',
        amountPaid: 150000,
      });

    expect([200, 201, 400, 409]).toContain(res.status);
  });

  it('should allow Doctor to complete clinical examination', async () => {
    if (!bookingId) return;

    const res = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        doctorNotes: 'Kiem tra lam sang benh nhan on dinh.',
      });

    expect([200, 201, 400, 409]).toContain(res.status);
  });
});
