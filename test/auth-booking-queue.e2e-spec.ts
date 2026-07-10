import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { RedisService } from './../src/modules/database/services/redis.service';
import { PrismaService } from './../src/modules/prisma/prisma.service';
import { MailService } from './../src/modules/notifications/mail.service';
import { DayOfWeek } from '@prisma/client';

interface DoctorServiceItem {
  service?: {
    id: string;
    name: string;
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

interface BookingResponse {
  success: boolean;
  data: {
    id: string;
    bookingCode?: string;
    status?: string;
    bookingDate?: string;
    startTime?: string;
    endTime?: string;
    patientProfileId?: string;
    doctorId?: string;
    serviceId?: string;
  };
}

interface QueueRecord {
  id: string;
  bookingId: string;
  doctorId: string;
  queuePosition: number;
  estimatedWaitMinutes: number;
  booking?: {
    id: string;
    status: string;
  };
}

interface QueueListResponse {
  success: boolean;
  data: {
    queueRecords: QueueRecord[];
  };
}

interface QueueDetailResponse {
  success: boolean;
  data: QueueRecord;
}

describe('Auth + Booking + Queue Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let patientToken: string;
  let receptionistToken: string;
  let doctorToken: string;
  let adminToken: string;
  let patientProfileId: string;
  let doctorId: string;
  let serviceId: string;
  let bookingId: string;
  let bookingDateStr: string;
  let mainStartTime: string;
  let mainEndTime: string;
  const createdBookingIds: string[] = [];

  function assertSharedState() {
    expect(patientToken).toBeDefined();
    expect(receptionistToken).toBeDefined();
    expect(doctorToken).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(patientProfileId).toBeDefined();
    expect(doctorId).toBeDefined();
    expect(serviceId).toBeDefined();
    expect(bookingDateStr).toBeDefined();
  }

  function assertBookingId() {
    expect(bookingId).toBeDefined();
    expect(typeof bookingId).toBe('string');
    expect(bookingId.length).toBeGreaterThan(0);
  }

  const mockMailService = {
    sendMail: jest.fn().mockResolvedValue(true),
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendBookingConfirmation: jest.fn().mockResolvedValue(true),
    sendBookingReminder: jest.fn().mockResolvedValue(true),
    sendBookingCancellation: jest.fn().mockResolvedValue(true),
  };

  interface TokenResponse {
    accessToken?: string;
    token?: string;
    data?: {
      accessToken?: string;
      token?: string;
      user?: {
        patientProfile?: {
          id?: string;
        };
      };
    };
    user?: {
      patientProfile?: {
        id?: string;
      };
    };
  }

  function extractAccessToken(body: unknown): string {
    const response = body as TokenResponse;
    const token =
      response.data?.accessToken ||
      response.accessToken ||
      response.data?.token ||
      response.token;
    if (!token || typeof token !== 'string') {
      throw new Error(
        `Access token extraction failed. Full body: ${JSON.stringify(body)}`,
      );
    }
    return token;
  }

  async function loginAllRoles() {
    // 1. Patient Login
    const resPatient = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'patient.linh@gmail.com',
        password: 'patient123',
      })
      .expect(200);

    patientToken = extractAccessToken(resPatient.body);
    const responseBody = resPatient.body as TokenResponse;
    const patientUser = responseBody.data?.user || responseBody.user;
    const extractedId = patientUser?.patientProfile?.id;
    if (extractedId) {
      patientProfileId = extractedId;
    }

    if (!patientProfileId) {
      const profile = await prisma.patientProfile.findFirst({
        where: { email: 'patient.linh@gmail.com' },
      });
      if (profile?.id) {
        patientProfileId = profile.id;
      }
    }

    if (!patientProfileId) {
      throw new Error('Patient profile ID not found in response or DB.');
    }

    // 2. Receptionist Login
    const resRec = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'letan.huong@clinic.com',
        password: 'receptionist123',
      })
      .expect(200);

    receptionistToken = extractAccessToken(resRec.body);

    // 3. Doctor Login
    const resDoc = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'bs.nguyenvana@clinic.com',
        password: 'doctor123',
      })
      .expect(200);

    doctorToken = extractAccessToken(resDoc.body);

    // 4. Admin Login
    const resAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@clinic.com',
        password: 'admin123',
      })
      .expect(200);

    adminToken = extractAccessToken(resAdmin.body);
  }

  function getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  async function findAvailableSlot(
    docId: string,
    dateStr: string,
    excludeStartTimes: string[] = [],
  ): Promise<{ startTime: string; endTime: string }> {
    const workingHours = await prisma.doctorWorkingHours.findFirst({
      where: {
        doctorId: docId,
        dayOfWeek: getDayOfWeek(new Date(dateStr)),
      },
    });

    if (!workingHours) {
      throw new Error(`Doctor ${docId} does not work on date ${dateStr}`);
    }

    const candidateSlots = [
      { startTime: '08:00', endTime: '08:30' },
      { startTime: '08:30', endTime: '09:00' },
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '09:30', endTime: '10:00' },
      { startTime: '10:00', endTime: '10:30' },
      { startTime: '10:30', endTime: '11:00' },
      { startTime: '14:00', endTime: '14:30' },
      { startTime: '14:30', endTime: '15:00' },
      { startTime: '15:00', endTime: '15:30' },
      { startTime: '15:30', endTime: '16:00' },
    ];

    for (const slot of candidateSlots) {
      if (excludeStartTimes.includes(slot.startTime)) {
        continue;
      }
      if (
        slot.startTime < workingHours.startTime ||
        slot.startTime >= workingHours.endTime
      ) {
        continue;
      }

      const activeBookingsCount = await prisma.booking.count({
        where: {
          doctorId: docId,
          bookingDate: new Date(dateStr),
          startTime: slot.startTime,
          status: {
            in: [
              'PENDING',
              'CONFIRMED',
              'CHECKED_IN',
              'IN_PROGRESS',
              'AWAITING_RESULTS',
            ],
          },
        },
      });

      const reservationsCount = await prisma.slotReservation.count({
        where: {
          doctorId: docId,
          bookingDate: new Date(dateStr),
          startTime: slot.startTime,
        },
      });

      if (activeBookingsCount + reservationsCount === 0) {
        return slot;
      }
    }
    throw new Error(
      `No available slot found for doctor ${docId} on ${dateStr}`,
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Clear Redis cache
    try {
      const redisService = moduleFixture.get(RedisService);
      if (redisService.isReady()) {
        await redisService.delPattern('cache:*');
      }
    } catch (err) {
      console.warn('Could not clear Redis cache:', err);
    }

    // Compute a dynamic booking date (tomorrow) to guarantee slot availability within 30-day window
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    bookingDateStr = tomorrow.toISOString().split('T')[0];

    // Log in all required roles
    await loginAllRoles();
  });

  afterAll(async () => {
    if (createdBookingIds.length > 0) {
      try {
        // 1. Delete payments linked to invoices of these bookings
        await prisma.payment.deleteMany({
          where: {
            invoice: {
              bookingId: { in: createdBookingIds },
            },
          },
        });

        // 2. Delete prescription items linked to prescriptions of medical records of these bookings
        await prisma.prescriptionItem.deleteMany({
          where: {
            prescription: {
              medicalRecord: {
                bookingId: { in: createdBookingIds },
              },
            },
          },
        });

        // 3. Delete prescriptions linked to medical records of these bookings
        await prisma.prescription.deleteMany({
          where: {
            medicalRecord: {
              bookingId: { in: createdBookingIds },
            },
          },
        });

        // 4. Delete visit service orders linked to medical records of these bookings
        await prisma.visitServiceOrder.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 5. Delete lab results linked to lab orders of these bookings
        await prisma.labResult.deleteMany({
          where: {
            labOrder: {
              bookingId: { in: createdBookingIds },
            },
          },
        });

        // 6. Delete lab orders of these bookings
        await prisma.labOrder.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 7. Delete medical records of these bookings
        await prisma.medicalRecord.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 8. Delete invoices of these bookings (this cascades to invoice items)
        await prisma.invoice.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 9. Delete booking queues of these bookings
        await prisma.bookingQueue.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 10. Delete booking status histories of these bookings
        await prisma.bookingStatusHistory.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 11. Delete ai chat sessions of these bookings
        await prisma.aiChatSession.deleteMany({
          where: {
            bookingId: { in: createdBookingIds },
          },
        });

        // 12. Finally, delete the bookings
        await prisma.booking.deleteMany({
          where: {
            id: { in: createdBookingIds },
          },
        });
      } catch (err) {
        console.warn('Could not clean up test bookings:', err);
      }
    }

    // Explicitly disconnect Prisma and clean up Redis service if possible
    try {
      if (prisma) {
        await prisma.$disconnect();
      }
    } catch (err) {
      console.warn('Could not disconnect Prisma:', err);
    }

    try {
      const redisService = app.get(RedisService);
      if (redisService) {
        redisService.onModuleDestroy();
      }
    } catch {
      // Ignore if not instantiated
    }

    await app.close();
  });

  // ==========================================
  // PHASE 1: Authenticate roles & discover info
  // ==========================================

  it('should authenticate Patient successfully', () => {
    expect(patientToken).toBeDefined();
    expect(typeof patientToken).toBe('string');
    expect(patientProfileId).toBeDefined();
    expect(typeof patientProfileId).toBe('string');
  });

  it('should authenticate Receptionist successfully', () => {
    expect(receptionistToken).toBeDefined();
    expect(typeof receptionistToken).toBe('string');
  });

  it('should authenticate Doctor successfully', () => {
    expect(doctorToken).toBeDefined();
    expect(typeof doctorToken).toBe('string');
  });

  it('should authenticate Admin successfully', () => {
    expect(adminToken).toBeDefined();
    expect(typeof adminToken).toBe('string');
  });

  it('should fetch public doctors and services', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/public/doctors')
      .expect(200);

    const body = res.body as DoctorsResponse;
    expect(body.success).toBe(true);
    expect(body.data.users.length).toBeGreaterThan(0);

    const doc = body.data.users[0];
    doctorId = doc.id;
    expect(doctorId).toBeDefined();

    if (doc.doctorProfile?.services && doc.doctorProfile.services.length > 0) {
      const firstService = doc.doctorProfile.services[0].service;
      if (firstService) {
        serviceId = firstService.id;
      }
    }
    expect(serviceId).toBeDefined();

    // Dynamically find a free slot to prevent booking conflict without unsafe preemptive deletions
    const freeSlot = await findAvailableSlot(doctorId, bookingDateStr);
    mainStartTime = freeSlot.startTime;
    mainEndTime = freeSlot.endTime;

    expect(mainStartTime).toBeDefined();
    expect(mainEndTime).toBeDefined();
  });

  // ==========================================
  // PHASE 2: Security & Authorization Checks
  // ==========================================

  it('should reject unauthorized request to protected booking endpoint with 401', async () => {
    assertSharedState();
    await request(app.getHttpServer())
      .post('/bookings')
      .send({
        doctorId,
        serviceId,
        bookingDate: bookingDateStr,
        startTime: mainStartTime,
        endTime: mainEndTime,
        patientProfileId,
      })
      .expect(401);
  });

  it('should reject Patient checking in their own booking with 403', async () => {
    assertSharedState();
    await request(app.getHttpServer())
      .post('/bookings/fake-id/check-in')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(403);
  });

  // ==========================================
  // PHASE 3: Booking Creation & Verification
  // ==========================================

  it('should create a booking as a Patient with status PENDING', async () => {
    assertSharedState();
    const payload = {
      doctorId,
      serviceId,
      bookingDate: bookingDateStr,
      startTime: mainStartTime,
      endTime: mainEndTime,
      patientProfileId,
    };
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send(payload);

    if (res.status !== 201) {
      console.error('Booking creation failed:', {
        status: res.status,
        body: res.body as unknown,
        payload,
        patientProfileId,
        doctorId,
        serviceId,
      });
    }

    expect(res.status).toBe(201);

    const body = res.body as BookingResponse;
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    bookingId = body.data.id;
    createdBookingIds.push(bookingId);
  });

  it('should prevent double booking / slot conflict with 409', async () => {
    assertSharedState();
    assertBookingId();
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        serviceId,
        bookingDate: bookingDateStr,
        startTime: mainStartTime,
        endTime: mainEndTime,
        patientProfileId,
      })
      .expect(409);
  });

  it('should reject check-in on a PENDING booking with 400', async () => {
    assertSharedState();
    assertBookingId();
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(400);
  });

  // ==========================================
  // PHASE 4: Check-in, Queue Management & Promotion
  // ==========================================

  it('should confirm the booking by Receptionist', async () => {
    assertSharedState();
    assertBookingId();
    const res = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const body = res.body as BookingResponse;
    expect(body.success).toBe(true);
  });

  it('should check-in the booking and return queue position details', async () => {
    assertSharedState();
    assertBookingId();
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    const body = res.body as { success: boolean; data: { queue: QueueRecord } };
    expect(body.success).toBe(true);
    expect(body.data.queue).toBeDefined();
    expect(body.data.queue.queuePosition).toBeDefined();
  });

  it('should reject duplicate check-in with 400', async () => {
    assertSharedState();
    assertBookingId();
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(400);
  });

  it('should find booking queue details by booking ID', async () => {
    assertSharedState();
    assertBookingId();
    const res = await request(app.getHttpServer())
      .get(`/queue/booking/${bookingId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    const body = res.body as QueueDetailResponse;
    expect(body.success).toBe(true);
    expect(body.data.bookingId).toBe(bookingId);
  });

  it('should show the booking in the queue list for the doctor', async () => {
    assertSharedState();
    assertBookingId();
    const res = await request(app.getHttpServer())
      .get(`/queue?doctorId=${doctorId}&date=${bookingDateStr}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const body = res.body as QueueListResponse;
    expect(body.success).toBe(true);
    const found = body.data.queueRecords.some((q) => q.bookingId === bookingId);
    expect(found).toBe(true);
  });

  it('should allow Admin to fetch queue statistics', async () => {
    assertSharedState();
    const res = await request(app.getHttpServer())
      .get(`/queue/statistics?doctorId=${doctorId}&date=${bookingDateStr}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as {
      success: boolean;
      data: { totalQueued: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.totalQueued).toBeDefined();
  });

  it('should promote the booking manually when slot is available', async () => {
    assertSharedState();
    assertBookingId();
    const res = await request(app.getHttpServer())
      .post('/queue/promote')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        bookingId,
        reason: 'E2E promotion test',
      })
      .expect(200);

    const body = res.body as BookingResponse;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CONFIRMED');

    // Confirm that the queue record has been updated/deleted (should return synthetic 200 OK since booking exists)
    const resQueue = await request(app.getHttpServer())
      .get(`/queue/booking/${bookingId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    const bodyQueue = resQueue.body as QueueDetailResponse;
    expect(bodyQueue.success).toBe(true);
    expect(bodyQueue.data.id).toContain('synth-');
    expect(bodyQueue.data.booking?.status).toBe('CONFIRMED');
  });

  it('should prevent queue promotion when slot is full (400)', async () => {
    assertSharedState();
    assertBookingId();

    // Dynamically find a free slot to prevent booking conflict for full-slot test
    const freeSlot = await findAvailableSlot(doctorId, bookingDateStr, [
      mainStartTime,
    ]);
    const startTime = freeSlot.startTime;
    const endTime = freeSlot.endTime;

    // Create booking B (confirmed)
    const bookingB = await prisma.booking.create({
      data: {
        bookingCode: `BK-TEST-B-${Date.now()}`,
        doctorId,
        serviceId: serviceId || null,
        patientProfileId,
        bookingDate: new Date(bookingDateStr),
        startTime,
        endTime,
        status: 'CONFIRMED',
      },
    });
    createdBookingIds.push(bookingB.id);

    // Create booking A (checked in)
    const bookingA = await prisma.booking.create({
      data: {
        bookingCode: `BK-TEST-A-${Date.now()}`,
        doctorId,
        serviceId: serviceId || null,
        patientProfileId,
        bookingDate: new Date(bookingDateStr),
        startTime,
        endTime,
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
      },
    });
    createdBookingIds.push(bookingA.id);

    // Add booking A to the queue
    await prisma.bookingQueue.create({
      data: {
        bookingId: bookingA.id,
        doctorId,
        queueDate: new Date(bookingDateStr),
        queuePosition: 1,
        estimatedWaitMinutes: 0,
        isPreBooked: true,
        scheduledTime: startTime,
      },
    });

    // Try to promote booking A manually -> should fail because booking B makes the slot full
    await request(app.getHttpServer())
      .post('/queue/promote')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        bookingId: bookingA.id,
        reason: 'E2E conflict promotion test',
      })
      .expect(400);

    // Clean up test bookings manually within test
    await prisma.bookingQueue.deleteMany({
      where: { bookingId: bookingA.id },
    });
    await prisma.booking.deleteMany({
      where: {
        id: { in: [bookingA.id, bookingB.id] },
      },
    });
  });
});
