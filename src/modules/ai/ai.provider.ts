import { GoogleGenAI, Type } from '@google/genai';

// ─── Patient Context Type ─────────────────────────────────────────────────────
export interface PatientContext {
  fullName?: string;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  bloodType?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
}

// ─── System Prompt Builder ─────────────────────────────────────────────────────

/**
 * Builds a dynamic system prompt with:
 *  - Current date/time (Vietnam timezone)
 *  - Patient personal context (if available)
 *  - Symptom-to-specialty mapping guide
 *  - Behavior rules and safety guardrails
 */
export function buildSystemPrompt(patient?: PatientContext): string {
  const now = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Compute age if date of birth is provided
  let age: number | null = null;
  if (patient?.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    age = new Date().getFullYear() - dob.getFullYear();
  }

  const patientBlock = patient
    ? `
### THÔNG TIN BỆNH NHÂN HIỆN TẠI:
- Tên: ${patient.fullName ?? 'Không rõ'}
- Giới tính: ${patient.gender === 'MALE' ? 'Nam' : patient.gender === 'FEMALE' ? 'Nữ' : 'Không rõ'}
- Tuổi: ${age !== null ? `${age} tuổi` : 'Không rõ'}
- Nhóm máu: ${patient.bloodType ?? 'Không có thông tin'}
- Dị ứng đã biết: ${patient.allergies ?? 'Không có'}
- Bệnh mãn tính: ${patient.chronicConditions ?? 'Không có'}

Hãy ghi nhớ thông tin này khi tư vấn. Ví dụ: nếu bệnh nhân có dị ứng, hãy lưu ý khi gợi ý xét nghiệm hay dịch vụ.
`
    : '';

  return `
Bạn là "Trợ lý Điều phối Y tế" thông minh của SmartClinic. Nhiệm vụ của bạn là giúp bệnh nhân tìm đúng chuyên khoa, bác sĩ, và đặt lịch khám một cách thuận tiện nhất.

### THỜI GIAN HIỆN TẠI:
${now}
(Dùng thông tin này khi người dùng nói "hôm nay", "tuần sau", "sáng mai", v.v.)
${patientBlock}
### QUY TẮC GIAO TIẾP:
1. **Ngôn ngữ**: Luôn dùng tiếng Việt thân thiện, chuyên nghiệp. Xưng "Tôi", gọi người dùng là "Bạn" hoặc "Quý khách".
2. **Khám phá triệu chứng**: Khi bệnh nhân mô tả mập mờ (vd: "tôi thấy mệt"), hãy hỏi thêm 1-2 câu cụ thể (vị trí đau, thời gian, mức độ, có sốt không) trước khi gọi tool.
3. **Quy trình chuẩn**: Triệu chứng → Gợi ý Chuyên khoa → Tìm Lịch trống → Xác nhận Đặt lịch.
4. **Xử lý hết lịch**: Nếu tool báo fallback, thông báo chủ động: "Ngày [X] đã đầy lịch, tôi tìm thấy lịch gần nhất vào ngày [Y], bạn có muốn đặt không?"
5. **Tìm bác sĩ theo tên**: Khi bệnh nhân nhắc đến tên bác sĩ cụ thể (vd: "Bác sĩ Nguyễn Văn An"), hãy dùng tool \`getDoctorInfo\` NGAY để tra thông tin và lịch của bác sĩ đó.
6. **Xác nhận trước khi đặt**: Luôn tóm tắt thông tin (bác sĩ, ngày, giờ, phòng) và hỏi xác nhận trước khi gọi \`createBookingFromChat\`.

### BẢN ĐỒ TRIỆU CHỨNG → CHUYÊN KHOA (hỗ trợ suy luận):
| Triệu chứng / Từ khóa | Chuyên khoa gợi ý |
|---|---|
| Đau đầu, chóng mặt, tê liệt, động kinh, mất ký ức | Nội thần kinh |
| Đau ngực, hồi hộp, khó thở khi gắng sức, tim đập nhanh | Tim mạch |
| Ho, khó thở, hen, tức ngực, viêm phổi | Hô hấp / Nội phổi |
| Đau bụng, buồn nôn, tiêu chảy, táo bón, đầy hơi, trào ngược | Tiêu hóa / Nội tổng quát |
| Khớp sưng đau, cứng khớp, đau lưng, đau cổ | Cơ xương khớp / Chấn thương chỉnh hình |
| Da nổi mẩn, ngứa, mụn, rụng tóc, móng tay | Da liễu |
| Mắt đỏ, mờ, chảy nước mắt, đau mắt | Nhãn khoa |
| Tai ù, đau tai, nghe kém, viêm xoang, ngạt mũi, đau họng | Tai Mũi Họng |
| Tiểu khó, tiểu buốt, đau hông, sỏi thận | Niệu khoa / Thận |
| Trẻ em, sốt trẻ, biếng ăn trẻ, phát triển chậm | Nhi khoa |
| Kinh nguyệt bất thường, thai sản, phụ khoa | Sản phụ khoa |
| Tiểu đường, béo phì, tuyến giáp, hormone | Nội tiết / Chuyển hóa |
| Lo âu, trầm cảm, mất ngủ, rối loạn tâm thần | Tâm thần / Tâm lý |
| Khám sức khỏe định kỳ, tổng quát | Nội tổng quát / Sức khỏe tổng quát |

**Lưu ý**: Nếu tool \`getSpecialtyBySymptoms\` trả về \`matchedByKeyword: false\` và trả về toàn bộ danh sách — hãy tự suy luận chuyên khoa phù hợp nhất từ bảng trên và đề xuất 1-2 chuyên khoa cho bệnh nhân, đừng hỏi lại "không tìm thấy".

### GIỚI HẠN AN TOÀN:
- TUYỆT ĐỐI KHÔNG chẩn đoán bệnh cụ thể. Chỉ nói "Triệu chứng của bạn phù hợp với chuyên khoa [X]".
- Nếu có dấu hiệu nguy kịch (đau ngực trái dữ dội, liệt nửa người, khó thở cấp, chấn thương nặng): Yêu cầu gọi **115** hoặc đến **cấp cứu ngay lập tức**. Không tiếp tục hỏi về lịch hẹn.
- Không chia sẻ thông tin cá nhân của bệnh nhân khác.
`;
}

// ─── Tool Declarations ─────────────────────────────────────────────────────────

const getSpecialtyBySymptomsTool = {
  name: 'getSpecialtyBySymptoms',
  description:
    'Tìm kiếm chuyên khoa và dịch vụ lâm sàng dựa trên mô tả triệu chứng. Nếu không khớp từ khóa, trả về toàn bộ danh sách chuyên khoa để AI suy luận. Dùng khi bệnh nhân chưa biết nên khám ở đâu.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptoms: {
        type: Type.STRING,
        description:
          'Mô tả triệu chứng hoặc từ khóa bệnh lý (vd: đau đầu, đau dạ dày, nhi khoa, tim mạch)',
      },
    },
    required: ['symptoms'],
  },
};

const getDoctorInfoTool = {
  name: 'getDoctorInfo',
  description:
    'Tìm thông tin chi tiết về bác sĩ theo tên: chuyên khoa, kinh nghiệm, phí khám, dịch vụ và các slot lịch còn trống sắp tới. Dùng khi bệnh nhân hỏi về một bác sĩ cụ thể hoặc muốn đặt lịch với bác sĩ nào đó.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorName: {
        type: Type.STRING,
        description: 'Tên bác sĩ (đầy đủ hoặc một phần, vd: "Nguyễn Văn An")',
      },
      specialtyName: {
        type: Type.STRING,
        description:
          'Chuyên khoa để lọc thêm (tùy chọn, vd: "Tim mạch", "Nhi khoa")',
      },
    },
    required: ['doctorName'],
  },
};

const getAvailableSlotsTool = {
  name: 'getAvailableSlots',
  description:
    'Lấy danh sách các khung giờ khám còn trống theo chuyên khoa hoặc dịch vụ. Nếu không tìm thấy ngày yêu cầu, tự động gợi ý ngày lân cận.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      serviceId: {
        type: Type.STRING,
        description: 'ID dịch vụ cụ thể (nếu có)',
      },
      specialtyName: {
        type: Type.STRING,
        description:
          'Tên chuyên khoa (vd: Nội thần kinh, Da liễu, Sản phụ khoa)',
      },
      date: {
        type: Type.STRING,
        description:
          'Ngày mong muốn định dạng YYYY-MM-DD. Bỏ trống để tìm từ hôm nay.',
      },
      limit: {
        type: Type.NUMBER,
        description: 'Số lượng kết quả tối đa, mặc định là 5',
      },
    },
  },
};

const createBookingFromChatTool = {
  name: 'createBookingFromChat',
  description:
    'Tạo lịch hẹn khi bệnh nhân đã xác nhận đồng ý. Chỉ gọi tool này sau khi đã tóm tắt thông tin và bệnh nhân xác nhận. QUAN TRỌNG: Mọi ID phải là UUID chính xác từ kết quả của các tool trước.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      patientProfileId: {
        type: Type.STRING,
        description:
          'UUID của bệnh nhân (có thể suy ra từ patientContext nếu được cung cấp, nếu không thì lấy từ ngữ cảnh)',
      },
      doctorId: {
        type: Type.STRING,
        description:
          'BẮT BUỘC là chuỗi UUID chính xác của bác sĩ (VD: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). KHÔNG GHI TÊN BÁC SĨ TẠI ĐÂY.',
      },
      serviceId: {
        type: Type.STRING,
        description:
          'BẮT BUỘC là chuỗi UUID chính xác của dịch vụ (VD: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). KHÔNG GHI TÊN DỊCH VỤ.',
      },
      slotId: {
        type: Type.STRING,
        description: 'BẮT BUỘC là chuỗi UUID chính xác của slot lịch hẹn.',
      },
      date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      startTime: { type: Type.STRING, description: 'HH:mm' },
      endTime: { type: Type.STRING, description: 'HH:mm' },
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
      getDoctorInfoTool,
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

// Keep GEMINI_SYSTEM_PROMPT as a static export for Cloudflare fallback
export const GEMINI_SYSTEM_PROMPT = buildSystemPrompt();
