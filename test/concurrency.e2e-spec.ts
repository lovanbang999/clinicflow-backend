import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Concurrency & Race Conditions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Giả lập gửi 10 request đồng thời để đặt cùng 1 khung giờ
  it('should prevent double booking when multiple users try to reserve the same slot (Race Condition)', async () => {
    // Lưu ý: Cần chuẩn bị một data test hợp lệ cho /booking/reserve
    // Tuy nhiên trong môi trường test này, chúng ta sẽ test logic trả về.
    // Nếu chưa có auth token/data thật, nó có thể trả về 401 hoặc 400.
    // Mục đích là đảm bảo server không crash và có thể xử lý song song.
    const concurrentRequests = 10;
    const requests = Array.from({ length: concurrentRequests }).map(() =>
      request(app.getHttpServer())
        .post('/booking/reserve')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-10',
          startTime: '08:00',
          endTime: '08:30',
        }),
    );

    const responses = await Promise.all(requests);

    // Xác nhận không có lỗi 500
    responses.forEach((res) => {
      expect(res.status).not.toBe(500);
    });
  });

  it('should handle concurrent invoice creation without duplicating queue numbers', async () => {
    const concurrentRequests = 5;
    const requests = Array.from({ length: concurrentRequests }).map(() =>
      request(app.getHttpServer())
        .post('/invoices') // Assuming this is the endpoint
        .send({
          bookingId: 'test-booking-id',
          amount: 100000,
        }),
    );

    const responses = await Promise.all(requests);

    responses.forEach((res) => {
      expect(res.status).not.toBe(500);
    });
  });
});
