import type { QuizQuestion, CodeChallenge } from './curriculum';

export interface FinalExam {
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questions: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export const FINAL_EXAM: FinalExam = {
  title: 'Khảo Thí Tốt Nghiệp: eSmiles Backend Foundations',
  description: 'Bài khảo thí tình huống từ Sprint 0 đến Sprint 5. Chứng chỉ xác nhận hoàn thành curriculum; không thay thế code review hoặc đánh giá production.',
  timeLimitMinutes: 60,
  passingScore: 80,
  questions: [
    {
      id: 'final-q1',
      question: 'Một Singleton service gán `this.activeUnitId = req.user.unitId`, sau đó await Prisma rồi query theo giá trị đó. Rủi ro thực tế là gì?',
      options: [
        'Không có rủi ro vì Node.js chỉ chạy một main thread',
        'Request khác có thể ghi đè giá trị trong lúc request đầu await, làm query chạy dưới tenant sai',
        'Prisma tự cô lập biến instance cho mỗi request',
        'Chỉ làm response chậm hơn'
      ],
      correctIndex: 1,
      explanation: 'Single-thread không có nghĩa request chạy tuần tự qua await. Singleton instance được chia sẻ; scope phải đi qua argument/context an toàn.'
    },
    {
      id: 'final-q2',
      question: 'Một category chỉ thuộc trực tiếp một Unit. Mutation nào không làm lộ việc ID tồn tại ở tenant khác và giữ tenant scope?',
      options: [
        'findUnique({ where: { id } }) rồi update({ where: { id } })',
        'updateMany({ where: { id, unitId }, data }) rồi trả 404 chung nếu count === 0',
        'update({ where: { id } }) rồi kiểm tra unitId ở response',
        'Tin X-Unit-Id do frontend tự gửi mà không lấy active scope từ auth'
      ],
      correctIndex: 1,
      explanation: 'Scope phải bắt nguồn từ auth context và xuất hiện trong mutation. count === 0 có thể trả một lỗi không phân biệt absent/foreign record.'
    },
    {
      id: 'final-q3',
      question: 'Presigned upload URL đã được cấp. Bước nào vẫn cần thiết trước khi file có thể dùng trong bệnh án?',
      options: [
        'Không cần làm gì vì MIME type do client gửi là đáng tin',
        'Backend verify object/size/checksum hoặc content, áp quota và tenant key; scan/quarantine khi chính sách yêu cầu rồi mới publish metadata',
        'Lưu URL vĩnh viễn vào database để tải lại',
        'Upload lại file qua NestJS để chắc chắn'
      ],
      correctIndex: 1,
      explanation: 'Presign chỉ ủy quyền upload giới hạn. Nó không chứng minh object an toàn hay đúng metadata.'
    },
    {
      id: 'final-q4',
      question: 'Để xuất kho an toàn trước hai request đồng thời, query nào thể hiện đúng invariant?',
      options: [
        'Đọc quantity, rồi ở application code kiểm tra và update ở hai request riêng',
        'Cập nhật quantity decrement không điều kiện, rồi nếu âm thì sửa lại',
        'Conditional update với where: { unitId, warehouseId, itemId, quantity: { gte: qty } }, rồi yêu cầu count === 1 trong transaction',
        'Dùng biến currentStock trong singleton service'
      ],
      correctIndex: 2,
      explanation: 'Điều kiện đủ tồn và decrement phải do database thực hiện nguyên tử; transaction bao trùm các mutation còn lại.'
    },
    {
      id: 'final-q5',
      question: 'Với BullMQ, kết luận nào đúng khi xử lý PDF nặng?',
      options: [
        'Đẩy job vào queue luôn loại bỏ event-loop blocking, dù worker chung process',
        'Queue chỉ tách khỏi HTTP khi consumer chạy process/pod khác; CPU-heavy JavaScript cần worker thread/process phù hợp',
        'BullMQ thay thế transaction database',
        'Retry mọi lỗi vô hạn để job chắc chắn thành công'
      ],
      correctIndex: 1,
      explanation: 'Queue là cơ chế điều phối/durability. Isolation CPU phải đến từ nơi worker chạy và thiết kế retry/idempotency.'
    }
  ],
  codeChallenge: {
    title: 'Capstone: Atomic Stock Transfer với Tenant Scope',
    description: 'Viết `executeStockTransfer(prismaMock, unitId, payload)`: validate `unitId`, `itemId`, quantity là số nguyên dương và hai kho khác nhau. Trong transaction: dùng `updateMany` conditional debit theo `unitId` và `quantity: { gte: quantity }`; nếu `count !== 1` ném `INSUFFICIENT_STOCK`; cộng kho đích và ghi audit bằng `tx.auditLog.create`. Trả `{ success: true, transferId: payload.idempotencyKey }`.',
    starterCode: `async function executeStockTransfer(prismaMock, unitId, payload) {
  // Viết logic capstone
  
}`,
    solution: `async function executeStockTransfer(prismaMock, unitId, payload) {
  if (!unitId || !payload?.itemId || !payload?.idempotencyKey) {
    throw new Error("INVALID_PAYLOAD");
  }
  if (!Number.isSafeInteger(payload.quantity) || payload.quantity <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
  if (!payload.fromWarehouseId || !payload.toWarehouseId || payload.fromWarehouseId === payload.toWarehouseId) {
    throw new Error("SAME_WAREHOUSE");
  }
  return prismaMock.$transaction(async (tx) => {
    const debited = await tx.stock.updateMany({
      where: { warehouseId: payload.fromWarehouseId, itemId: payload.itemId, unitId, quantity: { gte: payload.quantity } },
      data: { quantity: { decrement: payload.quantity } }
    });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_STOCK");
    await tx.stock.upsert({
      where: { warehouseId_itemId_unitId: { warehouseId: payload.toWarehouseId, itemId: payload.itemId, unitId } },
      create: { warehouseId: payload.toWarehouseId, itemId: payload.itemId, unitId, quantity: payload.quantity },
      update: { quantity: { increment: payload.quantity } }
    });
    await tx.auditLog.create({
      data: { action: 'STOCK_TRANSFER', unitId, entityId: payload.itemId, idempotencyKey: payload.idempotencyKey }
    });
    return { success: true, transferId: payload.idempotencyKey };
  });
}`,
    testCases: [
      {
        name: 'Case 1 (Visible): Chuyển kho thành công',
        input: [
          {
            $transaction: async (fn: (tx: { stock: { updateMany: () => Promise<{ count: number }>; upsert: () => Promise<boolean> }; auditLog: { create: () => Promise<boolean> } }) => Promise<unknown>) => {
              const tx = {
                stock: {
                  updateMany: async () => ({ count: 1 }),
                  upsert: async () => true
                },
                auditLog: { create: async () => true }
              };
              return fn(tx);
            }
          },
          'unit-10',
          { fromWarehouseId: 'w1', toWarehouseId: 'w2', itemId: 'i1', quantity: 5, idempotencyKey: 'tx-123' }
        ],
        expected: { success: true, transferId: 'tx-123' },
        hidden: false
      },
      {
        name: 'Case 2 (Visible): Trùng kho nguồn và đích -> Ném lỗi',
        input: [
          {},
          'unit-10',
          { fromWarehouseId: 'w1', toWarehouseId: 'w1', itemId: 'i1', quantity: 5, idempotencyKey: 'tx-124' }
        ],
        expected: 'ERROR_THROWN',
        hidden: false
      },
      {
        name: 'Case 3 (Hidden): Transaction ném lỗi rollback',
        input: [
          {
            $transaction: async (fn: (tx: { stock: { updateMany: () => Promise<{ count: number }>; upsert: () => Promise<boolean> }; auditLog: { create: () => Promise<boolean> } }) => Promise<unknown>) => {
              return fn({ stock: { updateMany: async () => ({ count: 0 }), upsert: async () => true }, auditLog: { create: async () => true } });
            }
          },
          'unit-10',
          { fromWarehouseId: 'w1', toWarehouseId: 'w2', itemId: 'i1', quantity: 500, idempotencyKey: 'tx-125' }
        ],
        expected: 'ERROR_THROWN',
        hidden: true
      }
    ]
  }
};
