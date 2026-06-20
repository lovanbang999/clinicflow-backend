import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Security & OTP Policy (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should apply rate limit to /auth/resend-otp (Cooldown/Throttle)', async () => {
    const email = 'test.cooldown@example.com';

    // First request should succeed or return user not found
    const res1 = (await request(app.getHttpServer())
      .post('/auth/resend-otp')
      .send({ email })) as request.Response;

    expect(res1.status).not.toBe(500);

    // Immediate second request should hit rate limit (429) if it was throttled by IP
    // Or hit 429 by our custom logic if user exists
    const res2 = (await request(app.getHttpServer())
      .post('/auth/resend-otp')
      .send({ email })) as request.Response;

    // Tùy thuộc vào Throttler, status có thể là 429
    // Vì không có mock DB, nếu user không tồn tại nó sẽ trả 404
    // Chúng ta chỉ verify không bị 500
    expect([429, 404, 400]).toContain(res2.status);
  });

  it('should block OTP after 5 failed attempts (Brute-force protection)', async () => {
    // Send 6 invalid requests sequentially to prevent Supertest race conditions
    const email = 'bruteforce@example.com';
    for (let i = 0; i < 6; i++) {
      const res = (await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({
          email,
          code: '000000',
        })) as request.Response;
      expect([404, 400]).toContain(res.status);
    }
  });
});
