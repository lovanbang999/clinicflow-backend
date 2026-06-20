import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AuthResponse {
  success: boolean;
  data: { accessToken: string };
}

interface ApiResponse {
  success: boolean;
  data: unknown;
}

describe('Lab Orders, VSO & Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let doctorToken: string;
  let technicianToken: string;
  let receptionistToken: string;
  let patientToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const login = async (email: string, password: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      return (res.body as AuthResponse).data?.accessToken ?? '';
    };

    [doctorToken, technicianToken, receptionistToken, patientToken] =
      await Promise.all([
        login('bs.nguyenvana@clinic.com', 'doctor123'),
        login('ktv.phuong@clinic.com', 'technician123'),
        login('letan.huong@clinic.com', 'receptionist123'),
        login('patient.khang@gmail.com', 'patient123'),
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- Lab Orders ----

  it('GET /lab-orders/pending => 200 (receptionist)', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders/pending')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiResponse).success).toBe(true);
  });

  it('GET /lab-orders/pending-ready => 200 (technician)', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders/pending-ready')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiResponse).success).toBe(true);
  });

  it('GET /lab-orders/technician/stats => 200 (technician)', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders/technician/stats')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /lab-orders/technician/history => 200 (technician)', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders/technician/history')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /lab-orders/pending => 403 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders/pending')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /lab-orders/pending => 401 (no token)', async () => {
    const res = await request(app.getHttpServer()).get('/lab-orders/pending');
    expect(res.status).toBe(401);
  });

  // ---- Visit Service Orders ----

  it('GET /visit-service-orders/worklist => 200 (technician)', async () => {
    const res = await request(app.getHttpServer())
      .get('/visit-service-orders/worklist')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiResponse).success).toBe(true);
  });

  it('GET /visit-service-orders/worklist?status=PENDING => 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/visit-service-orders/worklist?status=PENDING')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /visit-service-orders/worklist => 403 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/visit-service-orders/worklist')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  it('PATCH /visit-service-orders/invalid-id/start => 400 or 404', async () => {
    const res = await request(app.getHttpServer())
      .patch('/visit-service-orders/invalid-id/start')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect([400, 404]).toContain(res.status);
  });

  // ---- Analytics — Patient ----

  it('GET /analytics/patient/me/visit-trend => 200 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/patient/me/visit-trend')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiResponse).success).toBe(true);
  });

  it('GET /analytics/patient/me/top-diseases => 200 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/patient/me/top-diseases')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/patient/me/total-spending => 200 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/patient/me/total-spending')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/patient/me/visit-trend => 403 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/patient/me/visit-trend')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(403);
  });

  // ---- Analytics — Doctor ----

  it('GET /analytics/doctor/me/summary => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/summary')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiResponse).success).toBe(true);
  });

  it('GET /analytics/doctor/me/summary?period=week => 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/summary?period=week')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/top-diagnoses => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/top-diagnoses')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/booking-status => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/booking-status')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/patients-per-month => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/patients-per-month')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/recent-patients => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/recent-patients')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/today-schedule => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/today-schedule')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/heatmap => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/heatmap')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/clinical-kpis => 200 (doctor)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/clinical-kpis')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /analytics/doctor/me/summary => 403 (patient)', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/doctor/me/summary')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });
});
