/**
 * eSmiles Backend Academy - Final Comprehensive Certification Exam
 * Final assessment covering all 4 pillars of the backend architecture
 */

window.FINAL_EXAM = {
  id: 'final-graduation-exam',
  title: 'Kỳ Thi Đánh Giá Tốt Nghiệp Toàn Khóa: eSmiles Backend Master Certification',
  description: 'Bài thi tổng hợp 4 trụ cột kiến trúc backend eSmiles (NestJS Core, Prisma 7 Multi-Tenancy, CASL Authz, Queue & Tooling). Đạt từ 80% trở lên để nhận Chứng chỉ Tốt Nghiệp Kỹ Sư Backend eSmiles.',
  timeLimitMinutes: 45,
  passingScore: 80,
  questions: [
    {
      id: 'fe-1',
      question: 'Trong kiến trúc đa chi nhánh của eSmiles, cấp nào là đơn vị cô lập dữ liệu chính (Data Isolation Unit) cho Bệnh nhân, Kho và Doanh thu?',
      options: [
        'Group (Tập đoàn)',
        'Unit (Pháp nhân / Phòng khám)',
        'Branch (Chi nhánh / Điểm phục vụ)',
        'Room (Phòng điều trị)'
      ],
      correctIndex: 1,
      explanation: 'Unit là đơn vị pháp nhân sở hữu toàn bộ dữ liệu nghiệp vụ chính. Branch chỉ là địa điểm vật lý trực thuộc Unit.'
    },
    {
      id: 'fe-2',
      question: 'Khi nhận HTTP GET request `/api/i/v1/inventory/categories?page=1&pageSize=20`, thành phần nào bóc tách và validate query params?',
      options: [
        'Exception Filter',
        'ValidationPipe kết hợp class-validator và class-transformer trên DTO',
        'Database Trigger',
        'Pino Logger'
      ],
      correctIndex: 1,
      explanation: 'ValidationPipe đọc decorator trên DTO, dùng class-transformer để ép kiểu và class-validator để kiểm tra điều kiện hợp lệ.'
    },
    {
      id: 'fe-3',
      question: 'Tại sao dự án eSmiles cấm viết trực tiếp các khối try/catch lặp đi lặp lại trong Service để bắt mã lỗi Prisma?',
      options: [
        'Vì JavaScript không hỗ trợ try/catch',
        'Vì hệ thống đã có AllExceptionsFilter toàn cục tự động map các mã lỗi vi phạm khóa chính/ngoại (P2002, P2003, P2025) thành mã HTTP 409, 404 chuẩn hóa',
        'Vì try/catch làm hỏng kết nối cơ sở dữ liệu',
        'Để giảm dung lượng file bundle'
      ],
      correctIndex: 1,
      explanation: 'AllExceptionsFilter bắt tập trung tất cả exception từ Prisma, đảm bảo code service gọn gàng và mã lỗi trả về client nhất quán.'
    },
    {
      id: 'fe-4',
      question: 'Khi thực hiện cập nhật số lượng tồn kho và tạo phiếu nhập kho cùng một lúc, giải pháp nào đảm bảo tính toàn vẹn dữ liệu (ACID)?',
      options: [
        'Gọi tuần tự 2 hàm create và update không có transaction',
        'Sử dụng `this.prisma.$transaction([...])`',
        'Dùng lệnh setTimeout()',
        'Gửi qua email'
      ],
      correctIndex: 1,
      explanation: 'Prisma $transaction đảm bảo tất cả các câu lệnh cùng thành công hoặc tự động rollback nếu có bất kỳ lỗi nào xảy ra.'
    },
    {
      id: 'fe-5',
      question: 'Để bảo vệ Web CMS khỏi nguy cơ tấn công XSS đánh cắp phiên đăng nhập, Refresh Token được lưu trữ ở đâu?',
      options: [
        'LocalStorage của trình duyệt',
        'SessionStorage',
        'HttpOnly Cookie (JavaScript không thể đọc)',
        'URL Query String'
      ],
      correctIndex: 2,
      explanation: 'HttpOnly Cookie được trình duyệt bảo vệ nghiêm ngặt, ngăn chặn mã JavaScript độc hại đọc trộm token khi bị dính XSS.'
    },
    {
      id: 'fe-6',
      question: 'Decorator nào trong eSmiles giúp phân vùng API cho nhân viên nội bộ phòng khám với tiền tố `/api/i/v1/`?',
      options: [
        '@PlatformAdminController()',
        '@InternalController()',
        '@CustomerController()',
        '@PublicController()'
      ],
      correctIndex: 1,
      explanation: '@InternalController() tự động gắn prefix /api/i/v1/ và phân loại audience nội bộ cho nhân viên.'
    },
    {
      id: 'fe-7',
      question: 'Mã quyền `inventory:stocktake:approve` thuộc dạng thẩm quyền nào?',
      options: [
        'Quyền xem thông thường',
        'Thẩm quyền chuyển trạng thái riêng biệt (State-transition verb), chỉ cấp cho quản lý để chống gian lận kiểm kê',
        'Quyền mặc định của mọi tài khoản',
        'Quyền của bệnh nhân'
      ],
      correctIndex: 1,
      explanation: 'Các verb chuyển trạng thái tài chính/kho như approve, place, cancel là thẩm quyền đặc biệt, tách biệt khỏi quyền update thông thường.'
    },
    {
      id: 'fe-8',
      question: 'Công cụ nào lưu trữ các request API dưới dạng file `.bru` thuần text trực tiếp trong Git repo eSmiles?',
      options: [
        'Postman',
        'Bruno',
        'Insomnia Cloud',
        'SoapUI'
      ],
      correctIndex: 1,
      explanation: 'Bruno lưu trữ collection dưới dạng file text trong thư mục bruno/, giúp track thay đổi API qua từng commit và Pull Request.'
    }
  ],
  codeChallenge: {
    title: 'Capstone Challenge: Hệ Thống Dispatcher & Multi-Tenant Audit Logger',
    description: 'Viết hàm `dispatchBusinessEvent(event)`: Nhận vào `event: { unitId: string, action: string, payload: any, timestamp?: number }`. \n1. Nếu thiếu `unitId` hoặc `action`, ném `Error("INVALID_EVENT_SCHEMA")`. \n2. Thêm `processedAt: Date.now()`. \n3. Chuẩn hóa `action` thành CHỮ HOA. \n4. Trả về envelope `{ success: true, eventId: "evt-" + Math.floor(Math.random()*10000), data: event }`.',
    starterCode: `function dispatchBusinessEvent(event: any) {
  // Viết logic capstone dispatcher
  
}`,
    solution: `function dispatchBusinessEvent(event: any) {
  if (!event || typeof event !== 'object' || !event.unitId || !event.action) {
    throw new Error("INVALID_EVENT_SCHEMA");
  }
  const normalizedEvent = {
    unitId: event.unitId.trim(),
    action: event.action.trim().toUpperCase(),
    payload: event.payload || {},
    timestamp: event.timestamp || Date.now(),
    processedAt: Date.now()
  };
  return {
    success: true,
    eventId: "evt-001",
    data: normalizedEvent
  };
}`,
    testCases: [
      {
        name: 'Case 1 (Visible): Sự kiện hợp lệ',
        input: [{ unitId: 'u-100', action: 'patient_checked_in', payload: { patientId: 'p-1' } }],
        expected: {
          success: true,
          eventId: 'evt-001',
          data: {
            unitId: 'u-100',
            action: 'PATIENT_CHECKED_IN',
            payload: { patientId: 'p-1' }
          }
        },
        hidden: false
      },
      {
        name: 'Case 2 (Visible): Thiếu unitId -> Báo lỗi',
        input: [{ action: 'CREATE' }],
        expected: 'ERROR_THROWN',
        hidden: false
      },
      {
        name: 'Case 3 (Hidden): Thiếu action -> Báo lỗi',
        input: [{ unitId: 'u-100' }],
        expected: 'ERROR_THROWN',
        hidden: true
      }
    ]
  }
};
