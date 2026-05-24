import * as fs from 'fs';
import * as path from 'path';

// Define directories
const docsDir = path.join(__dirname, '../../../docs/postman');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// ----------------------------------------------------
// 1. Generate Postman Environment
// ----------------------------------------------------
const environment = {
  id: 'e36d4df9-0639-44d2-bbbb-8db7628859ff',
  name: 'SmartClinic - Local',
  values: [
    {
      key: 'base_url',
      value: 'http://localhost:3000',
      type: 'default',
      enabled: true,
    },
    { key: 'patient_token', value: '', type: 'default', enabled: true },
    { key: 'receptionist_token', value: '', type: 'default', enabled: true },
    { key: 'doctor_token', value: '', type: 'default', enabled: true },
    { key: 'patient_profile_id', value: '', type: 'default', enabled: true },
    { key: 'booking_id', value: '', type: 'default', enabled: true },
    { key: 'doctor_id', value: '', type: 'default', enabled: true },
    { key: 'category_id', value: '', type: 'default', enabled: true },
    { key: 'service_id', value: '', type: 'default', enabled: true },
    { key: 'invoice_id', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'Postman/10.0.0',
};

fs.writeFileSync(
  path.join(docsDir, 'SmartClinic_Local.postman_environment.json'),
  JSON.stringify(environment, null, 2),
);
console.log(
  '✅ Generated SmartClinic_Local.postman_environment.json successfully!',
);

// Helper to construct request items
function makeRequest(
  name: string,
  method: string,
  urlPath: string,
  tokenVar: string | null,
  bodyObj: Record<string, unknown> | null,
  testScriptLines: string[],
) {
  const headers = [
    { key: 'Content-Type', value: 'application/json', type: 'text' },
  ];
  if (tokenVar) {
    headers.push({
      key: 'Authorization',
      value: `Bearer {{${tokenVar}}}`,
      type: 'text',
    });
  }

  return {
    name,
    event: [
      {
        listen: 'test',
        script: {
          exec: testScriptLines,
          type: 'text/javascript',
        },
      },
    ],
    request: {
      method,
      header: headers,
      body: bodyObj
        ? {
            mode: 'raw',
            raw: JSON.stringify(bodyObj, null, 2),
          }
        : undefined,
      url: {
        raw: `{{base_url}}${urlPath}`,
        host: ['{{base_url}}'],
        path: urlPath.split('/').filter(Boolean),
      },
    },
    response: [],
  };
}

// ----------------------------------------------------
// 2. Generate Postman Collection
// ----------------------------------------------------
const collection = {
  info: {
    _postman_id: 'a90df7bb-20e4-44df-91ef-070868f7b764',
    name: 'SmartClinic Collection',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Auth',
      item: [
        makeRequest(
          'POST /auth/login (Patient)',
          'POST',
          '/auth/login',
          null,
          { email: 'patient@smartclinic.com', password: 'Password@123' },
          [
            'const res = pm.response.json();',
            'pm.environment.set("patient_token", res.data.accessToken);',
            'if (res.data.patientProfile && res.data.patientProfile.id) {',
            '    pm.environment.set("patient_profile_id", res.data.patientProfile.id);',
            '}',
            'pm.test("Patient Login thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          'POST /auth/login (Receptionist)',
          'POST',
          '/auth/login',
          null,
          { email: 'receptionist@smartclinic.com', password: 'Password@123' },
          [
            'const res = pm.response.json();',
            'pm.environment.set("receptionist_token", res.data.accessToken);',
            'pm.test("Receptionist Login thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          'POST /auth/login (Doctor)',
          'POST',
          '/auth/login',
          null,
          { email: 'doctor@smartclinic.com', password: 'Password@123' },
          [
            'const res = pm.response.json();',
            'pm.environment.set("doctor_token", res.data.accessToken);',
            'pm.test("Doctor Login thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          'POST /auth/refresh',
          'POST',
          '/auth/refresh',
          'patient_token',
          null,
          [
            'pm.test("Refresh token thành công", () => pm.response.to.have.status(200) || pm.response.to.have.status(201));',
          ],
        ),
        makeRequest(
          'POST /auth/logout',
          'POST',
          '/auth/logout',
          'patient_token',
          null,
          [
            'pm.test("Logout thành công", () => pm.response.to.have.status(200) || pm.response.to.have.status(201));',
          ],
        ),
      ],
    },
    {
      name: 'Booking Flow (B1 -> B8)',
      item: [
        makeRequest(
          '1. GET /categories (Public)',
          'GET',
          '/categories',
          null,
          null,
          [
            'const res = pm.response.json();',
            'if (res.data && res.data.length > 0) {',
            '    pm.environment.set("category_id", res.data[0].id);',
            '    if (res.data[0].services && res.data[0].services.length > 0) {',
            '        pm.environment.set("service_id", res.data[0].services[0].id);',
            '    }',
            '}',
            'pm.test("Lấy danh mục thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '2. GET /users/public/doctors (Public)',
          'GET',
          '/users/public/doctors?serviceId={{service_id}}',
          null,
          null,
          [
            'const res = pm.response.json();',
            'if (res.data && res.data.length > 0) {',
            '    pm.environment.set("doctor_id", res.data[0].id);',
            '}',
            'pm.test("Tìm danh sách bác sĩ thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '3. GET /schedules/available-slots (Public)',
          'GET',
          '/schedules/available-slots?doctorId={{doctor_id}}&date=2026-06-01',
          null,
          null,
          [
            'pm.test("Lấy danh sách slot trống thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '4. POST /bookings (Patient)',
          'POST',
          '/bookings',
          'patient_token',
          {
            doctorId: '{{doctor_id}}',
            serviceId: '{{service_id}}',
            bookingDate: '2026-06-01',
            startTime: '09:00',
            endTime: '09:30',
            patientProfileId: '{{patient_profile_id}}',
          },
          [
            'const res = pm.response.json();',
            'pm.environment.set("booking_id", res.data.id);',
            'pm.test("Đặt lịch thành công", () => pm.response.to.have.status(201));',
          ],
        ),
        makeRequest(
          '5. GET /bookings/:id (Patient)',
          'GET',
          '/bookings/{{booking_id}}',
          'patient_token',
          null,
          [
            'pm.test("Xem chi tiết lịch hẹn thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '6. PATCH /bookings/:id/status (Receptionist CONFIRMED)',
          'PATCH',
          '/bookings/{{booking_id}}/status',
          'receptionist_token',
          { status: 'CONFIRMED' },
          [
            'pm.test("Receptionist CONFIRMED thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '7. POST /bookings/:id/check-in (Receptionist)',
          'POST',
          '/bookings/{{booking_id}}/check-in',
          'receptionist_token',
          null,
          [
            'pm.test("Check-in bệnh nhân thành công", () => pm.response.to.have.status(201) || pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '8. PATCH /bookings/:id/start (Doctor)',
          'PATCH',
          '/bookings/{{booking_id}}/start',
          'doctor_token',
          null,
          [
            'pm.test("Bắt đầu khám thành công", () => pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '9. POST /billing/invoices (Receptionist)',
          'POST',
          '/billing/invoices',
          'receptionist_token',
          {
            bookingId: '{{booking_id}}',
            invoiceType: 'CONSULTATION',
          },
          [
            'const res = pm.response.json();',
            'pm.environment.set("invoice_id", res.data.id);',
            'pm.test("Tạo hóa đơn tư vấn thành công", () => pm.response.to.have.status(201));',
          ],
        ),
        makeRequest(
          '10. POST /billing/invoices/:id/payments (Receptionist)',
          'POST',
          '/billing/invoices/{{invoice_id}}/payments',
          'receptionist_token',
          {
            paymentMethod: 'CASH',
            amountPaid: 150000,
          },
          [
            'pm.test("Thanh toán thành công", () => pm.response.to.have.status(201) || pm.response.to.have.status(200));',
          ],
        ),
        makeRequest(
          '11. PATCH /bookings/:id/complete (Doctor Complete)',
          'PATCH',
          '/bookings/{{booking_id}}/complete',
          'doctor_token',
          {
            doctorNotes: 'Bệnh nhân sức khỏe bình thường.',
          },
          [
            'pm.test("Hoàn thành ca khám thành công", () => pm.response.to.have.status(200));',
          ],
        ),
      ],
    },
    {
      name: 'Edge Cases',
      item: [
        makeRequest(
          'POST /bookings (Missing doctorId -> 400)',
          'POST',
          '/bookings',
          'patient_token',
          {
            serviceId: '{{service_id}}',
            bookingDate: '2026-06-01',
            startTime: '09:00',
            endTime: '09:30',
            patientProfileId: '{{patient_profile_id}}',
          },
          [
            'pm.test("Lỗi 400 thiếu doctorId", () => pm.response.to.have.status(400));',
          ],
        ),
        makeRequest(
          'GET /bookings/:id (Invalid UUID -> 400)',
          'GET',
          '/bookings/invalid-uuid',
          'patient_token',
          null,
          [
            'pm.test("Lỗi 400 format UUID", () => pm.response.to.have.status(400));',
          ],
        ),
        makeRequest(
          'POST /auth/login (Wrong Password -> 401)',
          'POST',
          '/auth/login',
          null,
          { email: 'patient@smartclinic.com', password: 'WrongPassword' },
          [
            'pm.test("Lỗi 401 Unauthorized", () => pm.response.to.have.status(401));',
          ],
        ),
        makeRequest(
          'GET /bookings/:id (No Token -> 401)',
          'GET',
          '/bookings/{{booking_id}}',
          null,
          null,
          [
            'pm.test("Lỗi 401 Unauthorized khi không token", () => pm.response.to.have.status(401));',
          ],
        ),
        makeRequest(
          'PATCH /bookings/:id/status (Patient Forbidden -> 403)',
          'PATCH',
          '/bookings/{{booking_id}}/status',
          'patient_token',
          { status: 'CONFIRMED' },
          [
            'pm.test("Lỗi 403 Forbidden phân quyền", () => pm.response.to.have.status(403));',
          ],
        ),
        makeRequest(
          'POST /bookings (Conflict Duplicate Slot -> 409)',
          'POST',
          '/bookings',
          'patient_token',
          {
            doctorId: '{{doctor_id}}',
            serviceId: '{{service_id}}',
            bookingDate: '2026-06-01',
            startTime: '09:00',
            endTime: '09:30',
            patientProfileId: '{{patient_profile_id}}',
          },
          [
            'pm.test("Lỗi 409 Conflict trùng slot", () => pm.response.to.have.status(409) || pm.response.to.have.status(400));',
          ],
        ),
      ],
    },
  ],
};

fs.writeFileSync(
  path.join(docsDir, 'SmartClinic.postman_collection.json'),
  JSON.stringify(collection, null, 2),
);
console.log('✅ Generated SmartClinic.postman_collection.json successfully!');
