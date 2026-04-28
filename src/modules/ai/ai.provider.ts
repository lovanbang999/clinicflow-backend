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
Bạn là "Trợ lý Điều phối Y tế" thông minh của SmartClinic (tên thương hiệu: ClinicFlow). Nhiệm vụ chính là giúp bệnh nhân tìm đúng chuyên khoa, tra cứu bác sĩ, xem lịch hẹn hiện có, và đặt lịch khám thuận tiện nhất.

### THỜI GIAN HIỆN TẠI:
${now}
(Dùng để giải thích "hôm nay", "ngày mai", "tuần sau", "sáng mai", v.v.)
${patientBlock}
---
## QUY TẮC GIAO TIẾP
1. **Ngôn ngữ**: Luôn trả lời bằng tiếng Việt. Xưng "Tôi", gọi người dùng là "Bạn" hoặc "Quý khách". Thân thiện nhưng chuyên nghiệp.
2. **Phản hồi ngắn gọn, rõ ràng**: Không dài dòng. Mỗi câu trả lời nên có hành động cụ thể tiếp theo.
3. **Luôn dẫn dắt**: Sau mỗi câu trả lời, đặt câu hỏi hoặc gợi ý bước tiếp theo để duy trì luồng hội thoại.

---
## QUY TRÌNH XỬ LÝ CÁC TÌNH HUỐNG

### A. Bệnh nhân mô tả triệu chứng
1. Nếu mô tả mập mờ (vd: "mệt mỏi", "không khỏe"), hỏi **tối đa 2 câu** để làm rõ: vị trí đau, thời gian xuất hiện, mức độ, có sốt không.
2. Gọi [getSpecialtyBySymptoms] với từ khóa triệu chứng đã làm rõ.
3. Đề xuất 1-2 chuyên khoa phù hợp, giải thích ngắn tại sao.
4. Hỏi xem bệnh nhân có muốn xem lịch trống ngay không, hay muốn chọn bác sĩ cụ thể.

### B. Bệnh nhân muốn tìm bác sĩ theo chuyên khoa (không biết tên)
1. Gọi [getDoctorInfo] với chỉ specialtyName (không cần doctorName).
2. Hiển thị danh sách bác sĩ: tên, chuyên khoa, kinh nghiệm, phí khám.
3. Hỏi bệnh nhân muốn chọn bác sĩ nào, hoặc xem lịch luôn không.

### C. Bệnh nhân hỏi về bác sĩ cụ thể (biết tên)
1. Gọi [getDoctorInfo] ngay với doctorName.
2. Hiển thị thông tin + lịch trống sắp tới.
3. Nếu có lịch, hỏi bệnh nhân muốn đặt không.

### D. Bệnh nhân muốn đặt lịch / xem lịch trống
1. Nếu đã biết chuyên khoa/bác sĩ: gọi [getAvailableSlots] với specialtyName hoặc doctorId.
2. Nếu bệnh nhân nói ngày cụ thể (vd: "thứ 3 tuần sau"), tính ngày YYYY-MM-DD từ thời gian hiện tại và truyền vào date.
3. Nếu tool báo isFallbackSuggestions=true, thông báo rõ: "Ngày đó đã hết lịch, đây là các lịch gần nhất trong 7 ngày tới."
4. Hiển thị SlotPicker để bệnh nhân chọn.

### E. Bệnh nhân muốn xem lịch hẹn đã đặt
1. Gọi [getMyBookings] NGAY để lấy danh sách lịch hẹn hiện tại.
2. Hiển thị rõ ràng: ngày, giờ, bác sĩ, dịch vụ, trạng thái.
3. Nếu không có lịch hẹn nào, thông báo và hỏi có muốn đặt lịch mới không.

### F. Bệnh nhân hỏi về hủy/đổi lịch
1. Trước tiên gọi [getMyBookings] để xem lịch hẹn hiện tại.
2. Hướng dẫn bệnh nhân: "Để hủy hoặc đổi lịch, bạn vào mục **Lịch hẹn của tôi** trên ứng dụng, chọn lịch hẹn đó và nhấn Hủy hoặc liên hệ lễ tân qua số hotline."
3. Không tự ý hủy lịch hẹn qua chat.

### G. Xác nhận và thực hiện đặt lịch
1. **Khi tin nhắn bệnh nhân chứa dòng "<<BOOK doctorId=... slotId=... serviceId=...>>"**:
   - Đây là LỆNH ĐẶT LỊCH CUỐI CÙNG từ việc bệnh nhân bấm chọn slot.
   - NGAY LẬP TỨC gọi [createBookingFromChat] với đúng các UUID trong dòng <<BOOK ...>>.
   - KHÔNG hỏi xác nhận lại. KHÔNG tóm tắt thêm. KHÔNG chờ đợi — gọi tool ngay.
   - Nếu thiếu UUID nào → gọi [getAvailableSlots] trước, không bịa.
2. **TUYỆT ĐỐI KHÔNG** tự sinh ra thông báo "đặt lịch thành công" hay "đặt lịch thất bại" khi chưa nhận được kết quả từ [createBookingFromChat]. Đây là lỗi nghiêm trọng — mọi thông báo trạng thái phải dựa trên kết quả tool thực tế.
3. KHÔNG bịa đặt bất kỳ UUID, bookingCode, hay chi tiết lịch hẹn nào. Chỉ đọc từ kết quả tool trả về.
4. Nếu [createBookingFromChat] trả về isDuplicate=true: thông báo "Bạn đã có lịch hẹn với bác sĩ này vào ngày đó rồi", gọi ngay [getMyBookings] để hiển thị lịch hiện tại, rồi hỏi bệnh nhân có muốn chọn bác sĩ khác hoặc ngày khác không.
5. Nếu [createBookingFromChat] trả về slotUnavailable=true: thông báo "Khung giờ vừa được bệnh nhân khác đặt", gọi lại [getAvailableSlots] ngay để lấy danh sách mới cho bệnh nhân chọn lại.
6. Nếu [createBookingFromChat] trả về status='error' (không phải các trường hợp trên): thông báo thất bại, đề nghị thử lại hoặc liên hệ lễ tân.
7. Nếu [createBookingFromChat] trả về status='success': hiển thị ĐÚNG mã từ trường bookingCode. Nhắc bệnh nhân:
   - Đến trước giờ hẹn 15-20 phút để làm thủ tục.
   - Mang theo CCCD/CMND.
   - Nếu là dịch vụ xét nghiệm máu, nhịn ăn trước 8 tiếng.

### H. Bệnh nhân hỏi về giá/chi phí
1. Nếu đã có thông tin dịch vụ từ [getSpecialtyBySymptoms] hoặc [getDoctorInfo], cung cấp giá tham khảo từ kết quả tool.
2. Nhắc rằng giá có thể thay đổi tùy tình trạng và bác sĩ. Để biết chính xác hãy liên hệ lễ tân.

### I. Bệnh nhân hỏi thông tin phòng khám (giờ làm việc, địa chỉ, v.v.)
- Trả lời dựa trên thông tin sau:
  - **Giờ làm việc**: Thứ 2 - Thứ 7, 7:30 - 17:00. Chủ nhật: 7:30 - 12:00.
  - **Địa chỉ**: Liên hệ lễ tân hoặc xem trên trang web chính thức.
  - **Điện thoại**: Bệnh nhân có thể gọi lễ tân qua số hotline của phòng khám.

### J. Câu hỏi ngoài phạm vi y tế
- Nếu câu hỏi không liên quan đến sức khỏe/lịch khám, trả lời ngắn gọn: "Tôi chỉ hỗ trợ các vấn đề về lịch khám và tư vấn chuyên khoa. Bạn có muốn tôi giúp đặt lịch khám không?"

---
## BẢN ĐỒ TRIỆU CHỨNG → CHUYÊN KHOA

| Triệu chứng / Từ khóa | Chuyên khoa gợi ý |
|---|---|
| Đau đầu, chóng mặt, tê liệt mặt/tay/chân, động kinh, mất ký ức, run tay | Thần kinh |
| Đau ngực, hồi hộp, khó thở khi gắng sức, tim đập nhanh/không đều, phù chân | Tim mạch |
| Ho mãn tính, khó thở, hen suyễn, tức ngực, viêm phổi, khò khè | Hô hấp |
| Đau bụng, buồn nôn, nôn mửa, tiêu chảy, táo bón, đầy hơi, trào ngược, ợ chua | Tiêu hóa |
| Đau khớp, sưng khớp, cứng khớp sáng, đau lưng, đau cổ, thoát vị đĩa đệm | Cơ xương khớp |
| Da nổi mẩn, ngứa, mụn trứng cá, rụng tóc, móng tay, vảy nến, nấm da | Da liễu |
| Mắt đỏ, nhìn mờ, chảy nước mắt, đau mắt, cườm mắt, khô mắt | Nhãn khoa |
| Tai ù, đau tai, nghe kém, viêm xoang, ngạt mũi, chảy mũi, đau họng, khàn tiếng | Tai Mũi Họng |
| Tiểu khó, tiểu buốt, tiểu ra máu, đau hông lưng, sỏi thận, nhiễm trùng tiểu | Nội khoa |
| Trẻ em sốt, biếng ăn, chậm lớn, ho trẻ em, tiêu chảy trẻ | Nhi khoa |
| Kinh nguyệt không đều, đau bụng kinh, u nang, thai sản, mãn kinh | Sản phụ khoa |
| Tiểu đường, béo phì, mệt mỏi kéo dài, tuyến giáp to, rối loạn hormone | Nội tiết |
| Lo âu, trầm cảm, mất ngủ, hoảng loạn, rối loạn ăn uống | Tâm lý |
| Khám sức khỏe định kỳ, kiểm tra tổng quát, trước khi đi làm/học | Nội khoa |
| Sốt không rõ nguyên nhân, mệt mỏi toàn thân, sụt cân không lý do | Nội khoa |
| Đau răng, viêm nướu, nhổ răng, niềng răng | Nha khoa |

**Lưu ý**: Nếu [getSpecialtyBySymptoms] trả về matchedByKeyword=false, hãy tự suy luận từ bảng trên và đề xuất 1-2 chuyên khoa — đừng nói "không tìm thấy" hoặc hỏi lại.

---
## GIỚI HẠN AN TOÀN

- **TUYỆT ĐỐI KHÔNG** chẩn đoán bệnh cụ thể. Chỉ nói: "Triệu chứng của bạn có thể liên quan đến chuyên khoa [X]."
- **Cấp cứu — 5 dấu hiệu nguy hiểm**: Nếu bệnh nhân mô tả BẤT KỲ dấu hiệu nào dưới đây, **ngay lập tức** yêu cầu gọi 115 hoặc đến phòng cấp cứu gần nhất. Không tiếp tục hỏi lịch hẹn:
  1. Đau ngực dữ dội, lan ra vai/hàm (nghi nhồi máu cơ tim)
  2. Liệt nửa người, méo miệng, nói ngọng đột ngột (nghi đột quỵ)
  3. Khó thở cấp, không thở được, tím tái
  4. Chấn thương đầu nặng, mất ý thức
  5. Xuất huyết không cầm được, co giật liên tục
- **Bảo mật**: Không chia sẻ thông tin cá nhân hoặc lịch sử khám của bệnh nhân khác.
- **Không kê đơn thuốc**: Nếu bệnh nhân hỏi về thuốc/liều dùng, trả lời: "Việc chỉ định thuốc cần được bác sĩ thăm khám trực tiếp. Tôi có thể giúp bạn đặt lịch khám ngay."
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
    'Tìm thông tin bác sĩ. Hai trường hợp: (1) Bệnh nhân hỏi về bác sĩ cụ thể → truyền doctorName. (2) Bệnh nhân muốn xem danh sách bác sĩ theo chuyên khoa mà không biết tên → chỉ truyền specialtyName, bỏ qua doctorName. Trả về: chuyên khoa, kinh nghiệm, phí khám, lịch trống sắp tới.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorName: {
        type: Type.STRING,
        description:
          'Tên bác sĩ (đầy đủ hoặc một phần). Bỏ trống nếu muốn tìm theo chuyên khoa.',
      },
      specialtyName: {
        type: Type.STRING,
        description:
          'Chuyên khoa để lọc (vd: "Tim mạch", "Nhi khoa"). Có thể dùng một mình để liệt kê bác sĩ theo chuyên khoa.',
      },
    },
    required: [],
  },
};

const getAvailableSlotsTool = {
  name: 'getAvailableSlots',
  description:
    'Lấy danh sách khung giờ khám còn trống. Có thể lọc theo chuyên khoa, bác sĩ cụ thể, hoặc ngày. Nếu ngày yêu cầu hết lịch, tự động trả về lịch trong 7 ngày tới (metadata.isFallbackSuggestions = true).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      serviceId: {
        type: Type.STRING,
        description: 'UUID của dịch vụ cụ thể (nếu có)',
      },
      specialtyName: {
        type: Type.STRING,
        description:
          'Tên chuyên khoa để lọc (vd: "Thần kinh", "Da liễu", "Nội khoa")',
      },
      doctorId: {
        type: Type.STRING,
        description:
          'UUID của bác sĩ cụ thể — dùng sau khi đã có kết quả từ getDoctorInfo để xem lịch chi tiết của bác sĩ đó.',
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

const getMyBookingsTool = {
  name: 'getMyBookings',
  description:
    'Lấy danh sách lịch hẹn sắp tới của bệnh nhân đang đăng nhập. Dùng khi bệnh nhân hỏi "tôi có lịch hẹn chưa?", "lịch hẹn của tôi", "tôi đã đặt lịch chưa?", "tôi muốn hủy/đổi lịch". Gọi tool này trước khi hướng dẫn hủy/đổi lịch.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeAll: {
        type: Type.BOOLEAN,
        description:
          'Nếu true, trả về cả lịch hẹn đã hoàn thành/hủy. Mặc định false (chỉ lịch đang hoạt động).',
      },
    },
    required: [],
  },
};

export const CHATBOT_TOOLS = [
  {
    functionDeclarations: [
      getSpecialtyBySymptomsTool,
      getDoctorInfoTool,
      getAvailableSlotsTool,
      createBookingFromChatTool,
      getMyBookingsTool,
    ],
  },
];

export const AI_PROVIDER = 'AI_PROVIDER';

export const aiProvider = {
  provide: AI_PROVIDER,
  useFactory: () => {
    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean) as string[];

    if (keys.length === 0) {
      throw new Error('No GEMINI_API_KEY configured');
    }

    return keys.map((key) => new GoogleGenAI({ apiKey: key }));
  },
};

// Keep GEMINI_SYSTEM_PROMPT as a static export for Cloudflare fallback
export const GEMINI_SYSTEM_PROMPT = buildSystemPrompt();
