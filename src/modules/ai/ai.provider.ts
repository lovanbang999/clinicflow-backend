import { GoogleGenAI, Type } from '@google/genai';

export const GEMINI_SYSTEM_PROMPT = `
Bạn là trợ lý đặt lịch khám bệnh của SmartClinic.
- Luôn giao tiếp bằng tiếng Việt, thân thiện và chuyên nghiệp.
- Hỏi thêm 1-2 câu làm rõ triệu chứng trước khi gợi ý chuyên khoa.
- KHÔNG đưa ra chẩn đoán bệnh cụ thể.
- Nếu triệu chứng khẩn cấp (đau ngực dữ dội, khó thở), hướng dẫn gọi 115 ngay lập tức.
`;

const getSpecialtyBySymptomsTool = {
  name: 'getSpecialtyBySymptoms',
  description:
    'Tìm chuyên khoa và dịch vụ phù hợp dựa trên triệu chứng bệnh nhân',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptoms: {
        type: Type.STRING,
        description: 'Mô tả triệu chứng bằng tiếng Việt',
      },
    },
    required: ['symptoms'],
  },
};

const getAvailableSlotsTool = {
  name: 'getAvailableSlots',
  description:
    'Lấy danh sách lịch khám trống theo chuyên khoa, dịch vụ và ngày',
  parameters: {
    type: Type.OBJECT,
    properties: {
      serviceId: {
        type: Type.STRING,
        description: 'ID của dịch vụ (tuỳ chọn)',
      },
      specialtyName: {
        type: Type.STRING,
        description: 'Tên chuyên khoa (tuỳ chọn)',
      },
      date: {
        type: Type.STRING,
        description: 'YYYY-MM-DD, bỏ trống = hôm nay trở đi',
      },
      limit: { type: Type.NUMBER, description: 'Số slot tối đa, default 5' },
    },
  },
};

const createBookingFromChatTool = {
  name: 'createBookingFromChat',
  description: 'Tạo lịch hẹn khi bệnh nhân đã xác nhận chọn slot',
  parameters: {
    type: Type.OBJECT,
    properties: {
      patientProfileId: { type: Type.STRING },
      doctorId: { type: Type.STRING },
      serviceId: { type: Type.STRING },
      slotId: { type: Type.STRING },
      date: { type: Type.STRING },
      startTime: { type: Type.STRING },
      endTime: { type: Type.STRING },
    },
    required: [
      'patientProfileId',
      'doctorId',
      'serviceId',
      'slotId',
      'date',
      'startTime',
      'endTime',
    ],
  },
};

export const CHATBOT_TOOLS = [
  {
    functionDeclarations: [
      getSpecialtyBySymptomsTool,
      getAvailableSlotsTool,
      createBookingFromChatTool,
    ],
  },
];

export const AI_PROVIDER = 'AI_PROVIDER';

export const aiProvider = {
  provide: AI_PROVIDER,
  useFactory: () => {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  },
};
