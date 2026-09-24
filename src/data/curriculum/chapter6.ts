import type { Sprint } from './types.ts';

export const chapter6: Sprint = {
  sprintId: 6,
  sprintTitle: 'Chương 6: Transaction Isolation, Concurrency Control & Database Locking',
  sprintDesc: 'Làm chủ tính toàn vẹn dữ liệu: 4 Cấp độ cô lập ACID, Hiện tượng đọc dị thường, Cơ chế MVCC xmin/xmax, Chiến lược Pessimistic vs Optimistic Locking và Xử lý Deadlocks',
  lessons: [
    {
      id: 'c6-l1',
      title: 'Bài 01: 4 Cấp Độ Cô Lập Giao Dịch (Isolation Levels) & Hiện Tượng Đọc Dị Thường (Read Anomalies)',
      duration: '60 phút',
      tag: 'ACID & Isolation Levels',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: CUỘC HỌP BỎ PHIẾU KÍN VS CUỘC ĐẤU THẦU ĐỒNG THỜI

Khi hàng trăm người dùng cùng truy cập và chỉnh sửa cơ sở dữ liệu cùng một giây, ranh giới giữa tính đúng đắn và tốc độ trở thành bài toán sinh tử:
* **Môi trường hoang dã không có cô lập (Chợ phiên ồn ào - Read Uncommitted):** Người bán hàng hét to: "Tôi đồng ý bán bức tranh này giá 1 tỷ!". Bạn vội vàng ghi vào sổ (Dirty Read). Nhưng ngay giây tiếp theo, người bán đổi ý nói "Tôi nói đùa đấy, tôi không bán nữa!" (Rollback). Bạn đã ghi lại một mẩu tin rác không có thật trong lịch sử thế giới!
* **Cuộc họp bỏ phiếu kín (Repeatable Read):** Khi bạn bước vào phòng họp và mở tập tài liệu báo cáo ra xem (Snapshot), toàn bộ thế giới bên ngoài phòng họp bị đóng băng đối với bạn. Dù bên ngoài các cổ đông khác có liên tục ký thêm 100 hợp đồng mới (Committed Transactions), nội dung cuốn báo cáo trên tay bạn vẫn y nguyên như lúc bạn bước vào phòng họp.
* **Cấp độ tối thượng (Thế giới tuần tự - Serializable):** Giống như một chiếc cầu hẹp chỉ cho phép đúng một người bước qua tại một thời điểm. Mọi hành vi đồng thời (Concurrent) đều có kết quả hoàn toàn tương đương với việc xếp hàng chạy tuần tự từng người một. Không có bất kỳ sai lệch nào, nhưng cái giá phải trả là tắc nghẽn giao thông nếu lưu lượng quá lớn!

---

# 2. 4 CẤP ĐỘ CÔ LẬP THEO CHUẨN ANSI SQL VÀ CÁC HIỆN TƯỢNG ĐỌC DỊ THƯỜNG

Theo chuẩn ANSI/ISO SQL-92, có 4 hiện tượng dị thường (Phenomena / Anomalies):

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MA TRẬN CÔ LẬP GIAO DỊCH & CÁC HIỆN TƯỢNG DỊ THƯỜNG      │
├────────────────────┬────────────┬──────────────────┬──────────────┬─────────┤
│ Cấp Độ Cô Lập      │ Dirty Read │ Non-repeatable   │ Phantom Read │ Write   │
│ (Isolation Level)  │ (Đọc Rác)  │ Read (Đọc Không  │ (Bóng Ma Đọc)│ Skew    │
│                    │            │ Lặp Lại Được)    │              │         │
├────────────────────┼────────────┼──────────────────┼──────────────┼─────────┤
│ Read Uncommitted   │ CÓ THỂ     │ CÓ THỂ           │ CÓ THỂ       │ CÓ THỂ  │
│ Read Committed     │ ĐÃ CHẶN    │ CÓ THỂ           │ CÓ THỂ       │ CÓ THỂ  │
│ Repeatable Read    │ ĐÃ CHẶN    │ ĐÃ CHẶN          │ ĐÃ CHẶN (PG) │ CÓ THỂ  │
│ Serializable       │ ĐÃ CHẶN    │ ĐÃ CHẶN          │ ĐÃ CHẶN      │ ĐÃ CHẶN │
└────────────────────┴────────────┴──────────────────┴──────────────┴─────────┘
\`\`\`

*(Lưu ý của Kỹ sư Cấp cao: Trong PostgreSQL, \`Read Uncommitted\` được đối xử y hệt như \`Read Committed\`. PostgreSQL không bao giờ cho phép xảy ra Dirty Read dưới bất kỳ cấu hình nào).*

### 2.1 Bản Chất Của Từng Hiện Tượng Dị Thường
1. **Dirty Read (Đọc dữ liệu rác):** Giao dịch A đọc dữ liệu được chỉnh sửa bởi Giao dịch B. Nhưng sau đó Giao dịch B bị lỗi và ROLLBACK. Giao dịch A đã xử lý trên dữ liệu chưa từng tồn tại!
2. **Non-repeatable Read (Đọc không lặp lại được):** Giao dịch A đọc dòng X có giá trị \`100\`. Giao dịch B cập nhật dòng X thành \`200\` và COMMIT. Giao dịch A đọc lại dòng X và thấy giá trị đã biến thành \`200\`. Hai lần đọc trong cùng một transaction lại ra 2 kết quả khác nhau!
3. **Phantom Read (Bóng ma xuất hiện):** Giao dịch A đếm số đơn hàng \`WHERE user_id = 1\` ra 5 dòng. Giao dịch B chèn thêm một đơn hàng mới cho user 1 và COMMIT. Giao dịch A thực hiện lại câu lệnh đếm thì bất ngờ thấy 6 dòng!
4. **Write Skew (Lệch ghi nguy hiểm):** Xảy ra trong bài toán "Ít nhất một bác sĩ phải trực đêm": Có 2 bác sĩ A và B đang trực. Cả hai cùng làm đơn xin nghỉ phép cùng lúc. Hệ thống kiểm tra: Nếu số bác sĩ trực $\ge 2$ thì cho phép nghỉ. Giao dịch 1 thấy có 2 người -> cho A nghỉ. Giao dịch 2 thấy có 2 người -> cho B nghỉ. Cả hai cùng commit thành công -> **Bệnh viện không còn bác sĩ nào trực đêm!** Chỉ có \`Serializable\` mới chặn được Write Skew.

---

# 3. THIẾT LẬP ISOLATION LEVEL TRONG NESTJS & TYPEORM

Trong NestJS, mặc định cơ sở dữ liệu chạy ở mức **\`Read Committed\`**.
Khi xử lý các nghiệp vụ ngân hàng hoặc thanh toán, ta phải nâng cấp Isolation Level trong Transaction:

\`\`\`typescript
await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
  // Toàn bộ các câu query trong đây được nhìn vào một Snapshot cố định
  const balance = await manager.findOne(Account, { where: { id: accountId } });
  // ...
});
\`\`\`

> **Quy Tắc Xử Lý Lỗi Repeatable Read & Serializable:** Khi chạy ở mức \`REPEATABLE READ\` hoặc \`SERIALIZABLE\`, nếu xảy ra xung đột ghi đồng thời, PostgreSQL sẽ ném ra lỗi mã **\`40001 (serialization_failure)\`**. Mã nguồn NestJS bắt buộc phải bắt mã lỗi này và thực hiện cơ chế **Tự Động Thử Lại (Retry Loop)**!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Tầng Bảo Vệ Toàn Vẹn Giao Dịch (Integrity Perimeter Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG ỨNG DỤNG (NESTJS RUNTIME)                     │
│  └── Retry Mechanism: Tự động thử lại khi gặp mã lỗi '40001'                │
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG ĐIỀU PHỐI TRANSACTION MANAGER                 │
│  ├── Read Committed (Mặc định cho CRUD, tốc độ cao nhất)                   │
│  ├── Repeatable Read (Dành cho báo cáo tài chính, thống kê)                 │
│  └── Serializable (Dành cho phân bổ số dư, ví điện tử, vé xem phim)        │
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG HẠ TẦNG POSTGRESQL ENGINE                     │
│  ├── Snapshot Isolation: Chụp ảnh trạng thái dữ liệu (xmin / xmax)          │
│  └── SSI (Serializable Snapshot Isolation): Theo dõi vết SIREAD Locks       │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Kịch Bản Xung Đột Serialization Failure & Retry (Retry Flowchart)
\`\`\`diagram
[ NestJS Transaction Bắt Đầu: SERIALIZABLE ]
                     │
                     ▼
           [ Thực thi phép tính nghiệp vụ ]
                     │
                     ▼
             [ COMMIT TRANSACTION ]
                     │
          Có phát hiện xung đột tuần tự?
          ├── [ KHÔNG ] ──► Giao dịch thành công 100%!
          │
          └── [ CÓ XUNG ĐỘT (Error: 40001 serialization_failure) ]
                 │
                 ▼
              Kiểm tra số lần thử lại (Retry Count < Max)?
                 ├── [ VƯỢT QUÁ ] ──► Ném lỗi về cho Client
                 └── [ CÒN LƯỢT ] ──► Chờ ngẫu nhiên (Jitter Delay)
                                      └──► Quay lại Bắt Đầu từ đầu!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Chọn Isolation Level (Level Selection Tree)
\`\`\`diagram
BẠN ĐANG XÂY DỰNG NGHIỆP VỤ NÀO CHO HỆ THỐNG?
│
├── Nghiệp vụ đọc ghi thông thường (Xem danh sách sản phẩm, đăng bài viết)?
│   └──► CHỌN: Read Committed (Mặc định - Hiệu năng cao nhất, không lo lỗi 40001)
│
├── Báo cáo phân tích doanh thu tháng đọc qua hàng chục bảng liên quan?
│   └──► CHỌN: Repeatable Read (Đảm bảo số liệu giữa các câu query không bị lệch)
│
└── Trừ tiền số dư ví điện tử, đặt chỗ ghế máy bay, đấu giá ngược?
    ├── Chấp nhận dùng khóa bi quan thủ công:
    │   └──► Read Committed kết hợp: SELECT ... FOR UPDATE (Khóa dòng)
    └── Không muốn khóa dòng, muốn đảm bảo toán học tuyệt đối:
        └──► CHỌN: Serializable (Bắt buộc phải bọc trong Retry Loop)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cấp Độ Cô Lập | Khả Năng Xảy Ra Dị Thường | Độ Trễ (Latency) | Khả Năng Gặp Lỗi 40001 | Mức Tiêu Tốn CPU/RAM |
| :--- | :--- | :--- | :--- | :--- |
| **Read Committed** | Bị Non-repeatable, Phantom Read | Cực thấp (Tối ưu nhất) | Hoàn toàn không bao giờ bị| Thấp nhất |
| **Repeatable Read**| Chỉ bị Write Skew | Thấp | Có thể bị nếu sửa cùng dòng| Lưu giữ Snapshot lâu hơn |
| **Serializable** | Miễn nhiễm $100\\%$ mọi dị thường | Cao hơn (Theo dõi SSI) | Thường xuyên nếu tải cao | Tốn RAM lưu SIREAD lock graph |
`,
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class FinancialTransactionService {
  private readonly logger = new Logger(FinancialTransactionService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Thực thi giao dịch ở mức SERIALIZABLE có bọc cơ chế tự động Retry chuẩn Enterprise
   */
  public async executeSerializableWithRetry<T>(
    operation: (manager: EntityManager) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');

      try {
        const result = await operation(queryRunner.manager);
        await queryRunner.commitTransaction();
        return result;
      } catch (error: any) {
        await queryRunner.rollbackTransaction();

        // 40001 là mã chuẩn SQL State cho lỗi Serialization Failure trong PostgreSQL
        if (error.code === '40001' && attempts < maxRetries) {
          const backoffMs = Math.floor(Math.random() * 50) + 10;
          this.logger.warn(
            \`[SERIALIZATION FAILURE] Lần \${attempts} thất bại. Đang thử lại sau \${backoffMs}ms...\`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    throw new Error('Đã vượt quá số lần thử lại tối đa cho giao dịch Serializable.');
  }
}
`,
      quiz: [
        {
          id: 'c6-l1-q1',
          question: 'Hiện tượng "Dirty Read" xảy ra khi nào và tại sao cơ sở dữ liệu PostgreSQL lại không bao giờ cho phép hiện tượng này xuất hiện?',
          options: [
            'Khi một giao dịch đọc dữ liệu chưa được commit của giao dịch khác; PostgreSQL không cho phép vì kiến trúc MVCC luôn yêu cầu snapshot hợp lệ.',
            'Khi một bảng dữ liệu bị xóa nhầm bởi người quản trị; PostgreSQL ngăn chặn bằng cách bắt buộc phải nhập mật khẩu hai lớp.',
            'Khi câu lệnh SQL chứa các ký tự đặc biệt nguy hiểm; PostgreSQL tự động lọc bỏ các ký tự này thông qua bộ tiền xử lý.',
            'Khi bộ nhớ đệm CPU L2 bị tràn dữ liệu; PostgreSQL tự động chuyển toàn bộ các giao dịch sang lưu trữ tạm thời ngoài đĩa cứng.'
          ],
          correctIndex: 0,
          explanation: 'Dirty Read là hiện tượng Transaction A đọc phải dữ liệu đang được sửa đổi dở dang bởi Transaction B (chưa commit). Trong PostgreSQL, kiến trúc MVCC dựa trên việc kiểm tra tính khả kiến (Tuple Visibility) của xmin. Một tuple chỉ khả kiến khi transaction tạo ra nó đã COMMIT thành công. Do đó, PostgreSQL hoàn toàn miễn nhiễm với Dirty Read ở mọi cấp độ.'
        },
        {
          id: 'c6-l1-q2',
          question: 'Hiện tượng "Non-repeatable Read" khác biệt cơ bản với hiện tượng "Phantom Read" ở điểm mấu chốt nào sau đây?',
          options: [
            'Non-repeatable Read liên quan đến việc một dòng có sẵn bị sửa đổi giá trị, còn Phantom Read liên quan đến việc xuất hiện các dòng mới được thêm vào.',
            'Phantom Read chỉ xảy ra trên các khóa chính số nguyên, trong khi Non-repeatable Read chỉ xảy ra trên các cột dữ liệu dạng chuỗi ký tự.',
            'Non-repeatable Read làm sập toàn bộ máy chủ cơ sở dữ liệu ngay lập tức, còn Phantom Read chỉ làm chậm tốc độ của mạng nội bộ.',
            'Cả hai hiện tượng này thực chất là một và được đặt tên khác nhau tùy theo quy chuẩn của từng nhà sản xuất phần mềm thương mại.'
          ],
          correctIndex: 0,
          explanation: 'Điểm khác biệt cốt lõi: Non-repeatable Read xảy ra khi cùng 1 dòng dữ liệu (cùng ID) bị sửa đổi (UPDATE) hoặc xóa (DELETE) bởi transaction khác, khiến 2 lần đọc ra 2 giá trị khác nhau. Trong khi đó, Phantom Read xảy ra khi một tập hợp điều kiện (như WHERE age > 18) xuất hiện thêm các dòng hoàn toàn mới (INSERT) do transaction khác chèn vào.'
        },
        {
          id: 'c6-l1-q3',
          question: 'Hiện tượng dị thường "Write Skew" (Lệch ghi) là gì và cấp độ cô lập nào là cấp độ tối thiểu bắt buộc để ngăn chặn được nó?',
          options: [
            'Xảy ra khi hai giao dịch đọc cùng một tập dữ liệu rồi ghi đè lên hai dòng khác nhau vi phạm ràng buộc chung; chỉ có Serializable mới chặn được.',
            'Xảy ra khi đĩa cứng bị mất điện đột ngột trong lúc đang ghi tệp tin; chỉ có cấp độ Read Committed mới có thể khắc phục được sự cố.',
            'Xảy ra khi lập trình viên quên không gọi lệnh commit transaction; chỉ có cấp độ Repeatable Read mới tự động ghi đè dữ liệu.',
            'Xảy ra khi hai tiến trình cùng cố gắng tạo ra hai bảng có tên giống hệt nhau trong cùng một schema cơ sở dữ liệu quan hệ.'
          ],
          correctIndex: 0,
          explanation: 'Write Skew xảy ra khi 2 transaction đồng thời đọc cùng một trạng thái (ví dụ kiểm tra số bác sĩ đang trực >= 2), sau đó Transaction 1 cập nhật dòng A, Transaction 2 cập nhật dòng B. Cả 2 cập nhật đều hợp lệ khi đứng riêng lẻ, nhưng kết hợp lại thì vi phạm quy tắc toàn vẹn của hệ thống. Repeatable Read không chặn được Write Skew, bắt buộc phải dùng Serializable (hoặc khóa bi quan SELECT FOR UPDATE).'
        },
        {
          id: 'c6-l1-q4',
          question: 'Khi triển khai cấp độ cô lập SERIALIZABLE trong NestJS, tại sao mã nguồn bắt buộc phải cài đặt thêm cơ chế tự động thử lại (Retry Loop)?',
          options: [
            'Vì PostgreSQL áp dụng cơ chế lạc quan và sẽ chủ động hủy giao dịch với mã lỗi 40001 nếu phát hiện có xung đột phụ thuộc giữa các giao dịch.',
            'Vì chuẩn SERIALIZABLE chỉ cho phép một giao dịch thành công trong mỗi chu kỳ một giờ đồng hồ theo giờ máy chủ.',
            'Vì các trình điều khiển kết nối TypeORM tự động ngắt kết nối mạng sau mỗi lần thực thi câu lệnh SQL ở mức cao.',
            'Vì giao thức TCP bắt buộc phải thiết lập lại quá trình bắt tay ba bước mỗi khi người dùng gọi lệnh commit dữ liệu.'
          ],
          correctIndex: 0,
          explanation: 'PostgreSQL sử dụng Serializable Snapshot Isolation (SSI). Thay vì khóa cứng toàn bộ bảng, nó cho phép các transaction chạy song song và duy trì một đồ thị phụ thuộc (SIREAD locks). Nếu phát hiện chu trình phụ thuộc có nguy cơ gây dị thường, PostgreSQL sẽ chủ động ném lỗi "40001 serialization_failure" để hủy giao dịch có rủi ro, buộc tầng ứng dụng phải Retry lại.'
        }
      ],
      codeChallenge: {
        id: 'c6-l1-c1',
        title: 'Mô Phỏng Transaction Retry Runner Chống Lỗi Serialization (40001)',
        description: 'Hiện thực hàm \`runWithRetry<T>(action: () => T, maxRetries: number): T\`. Hàm thực thi \`action()\`. Nếu \`action()\` ném ra Error có \`message === "40001"\`, hàm phải bắt lỗi và thử lại tối đa \`maxRetries\` lần. Nếu lần chạy nào trả về kết quả thành công, trả về kết quả đó ngay. Nếu thử hết \`maxRetries\` lần mà vẫn lỗi, ném ra Error cuối cùng.',
        starterCode: `
export function runWithRetry<T>(action: () => T, maxRetries: number): T {
  // TODO: Hiện thực cơ chế Retry khi gặp lỗi 40001
  return action();
}
`,
        solution: `
export function runWithRetry<T>(action: () => T, maxRetries: number): T {
  let attempts = 0;
  let lastError: unknown;

  while (attempts <= maxRetries) {
    try {
      return action();
    } catch (err: any) {
      lastError = err;
      if (err?.message === '40001' && attempts < maxRetries) {
        attempts++;
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
`,
        testCases: [
          {
            name: 'Thực thi thành công ngay lần đầu',
            input: [() => 'SUCCESS', 3],
            expected: 'SUCCESS'
          },
          {
            name: 'Thử lại 2 lần lỗi 40001 và thành công ở lần thứ 3',
            input: [
              (() => {
                let count = 0;
                return () => {
                  count++;
                  if (count < 3) throw new Error('40001');
                  return 'RECOVERED';
                };
              })(),
              3
            ],
            expected: 'RECOVERED'
          }
        ]
      }
    },
    {
      id: 'c6-l2',
      title: 'Bài 02: Multi-Version Concurrency Control (MVCC): Thuộc Tính xmin/xmax, Tuple Visibility & AutoVacuum',
      duration: '60 phút',
      tag: 'MVCC & AutoVacuum Internals',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: CUỐN SỔ BẢN THẢO VĂN BẢN VS NGƯỜI LAO CÔNG DỌN PHÒNG

Một trong những phát minh vĩ đại nhất của công nghệ cơ sở dữ liệu hiện đại: **"Người đọc không bao giờ chặn người ghi, và người ghi không bao giờ chặn người đọc (Readers never block Writers, Writers never block Readers)"**:
* **Tư duy cũ (Khóa bàn đọc sách):** Bạn đang ngồi đọc một cuốn sách. Có người khác muốn sửa chữa một từ trong cuốn sách đó. Họ giật cuốn sách khỏi tay bạn và đuổi bạn ra ngoài cho đến khi họ sửa xong! Hệ thống bị tắc nghẽn hoàn toàn.
* **Cơ chế MVCC (Mỗi lần sửa là in một bản sao mới):** Khi bạn đang đọc cuốn sách phiên bản số 10 (\`xmin = 10\`), một người khác muốn cập nhật giá tiền. Họ **KHÔNG HỀ CHẠM VÀO bản sách bạn đang cầm!** Họ in một trang sách mới toanh có số hiệu phiên bản 11 (\`xmin = 11\`), đồng thời đóng một con dấu đỏ nhỏ lên trang cũ: "Bản này bị thay thế bởi phiên bản 11 (\`xmax = 11\`)". Bạn vẫn an nhiên đọc bản sách số 10 của mình mà không hề bị làm phiền!
* **AutoVacuum (Người lao công dọn phòng lúc nửa đêm):** Sau khi bạn đọc xong và rời đi, bản sách cũ số 10 giờ đây không còn bất kỳ ai trên đời đọc tới nữa. Nó chính thức trở thành **Bản ghi chết (Dead Tuple)**. Người lao công (AutoVacuum) xuất hiện, quét dọn bản ghi chết đó đi để giải phóng chỗ trống cho các bản sách mới tiếp theo.

---

# 2. BẢN CHẤT KỸ THUẬT: HAI CỘT ẨN XMIN VÀ XMAX TRONG TUPLE HEADER

Trong PostgreSQL, mỗi dòng bản ghi (Tuple) đều có một Header cố định 23 bytes chứa 2 thông số quyết định tính khả kiến:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CẤU TRÚC ẨN CỦA HEAP TUPLE HEADER                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ xmin (4 bytes): Transaction ID của giao dịch đã TẠO RA dòng bản ghi này.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ xmax (4 bytes): Transaction ID của giao dịch đã XÓA hoặc CẬP NHẬT dòng này. │
│                 (Nếu dòng vẫn còn hiệu lực, xmax = 0).                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ t_ctid (6 bytes): Con trỏ trỏ tới phiên bản mới hơn nếu dòng bị cập nhật.   │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Bản Chất Của Lệnh UPDATE Dưới Tầng Vật Lý
Trong PostgreSQL: **UPDATE THỰC CHẤT LÀ MỘT LỆNH DELETE KẾT HỢP VỚI MỘT LỆNH INSERT!**
\`\`\`sql
-- Khi chạy lệnh:
UPDATE users SET balance = 500 WHERE id = 1;
\`\`\`
1. PostgreSQL **không hề ghi đè** lên vùng nhớ cũ!
2. Dòng cũ: Gán giá trị \`xmax = current_tx_id\` (Đánh dấu đã bị xóa).
3. Dòng mới: Chèn một Heap Tuple mới toanh vào cuối Page với \`xmin = current_tx_id\` và \`xmax = 0\`.
4. Cập nhật con trỏ \`t_ctid\` của dòng cũ trỏ sang địa chỉ vật lý của dòng mới.

---

# 3. NỖI ÁM ẢNH TABLE BLOAT & VAI TRÒ CỦA TIẾN TRÌNH AUTOVACUUM

Vì mọi lệnh UPDATE và DELETE đều để lại các Dead Tuples trên đĩa cứng:
* Nếu một bảng có 1 triệu dòng, mỗi ngày có 10 triệu lượt UPDATE: Nếu không dọn dẹp, dung lượng bảng sẽ phình to từ 100MB lên **50 Gigabytes** toàn là xác bản ghi chết (**Hiện tượng Table Bloat**)!
* Tốc độ quét bảng (Seq Scan) chậm đi hàng trăm lần vì phải đọc qua hàng triệu xác chết vô nghĩa.

\`\`\`diagram
[ DATA PAGE 8KB BAN ĐẦU ]
┌─────────────────────────────────────────────────────────────────────────────┐
│ [ Tuple 1: SỐNG ]  [ Tuple 2: ĐÃ CHẾT ]  [ Tuple 3: ĐÃ CHẾT ]  [ Tuple 4 ] │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼ Tiến trình VACUUM quét qua
[ SAU KHI CHẠY VACUUM THƯỜNG (Chỉ đánh dấu tái sử dụng) ]
┌─────────────────────────────────────────────────────────────────────────────┐
│ [ Tuple 1: SỐNG ]  [ TRỐNG ĐỂ TÁI DÙNG ] [ TRỐNG ĐỂ TÁI DÙNG ] [ Tuple 4 ] │
└─────────────────────────────────────────────────────────────────────────────┘
(Dung lượng tệp tin trên hệ điều hành VẪN KHÔNG ĐỔI, nhưng chỗ trống được tái sử dụng)
\`\`\`

### 3.1 Phân Biệt VACUUM Thường vs VACUUM FULL
1. **VACUUM (Tiến trình AutoVacuum chạy ngầm):** Chỉ dọn dẹp các Dead Tuples và cập nhật Free Space Map (FSM) để các lệnh INSERT tương lai chèn đè vào các khoảng trống đó. **Hoàn toàn KHÔNG khóa bảng**, ứng dụng vẫn đọc ghi bình thường.
2. **VACUUM FULL:** Sao chép toàn bộ các dòng còn sống sang một tệp tin mới trên đĩa và giải phóng triệt để dung lượng trả lại cho OS. **CỰC KỲ NGUY HIỂM:** Chiếm giữ khóa độc quyền cấp cao (\`ACCESS EXCLUSIVE LOCK\`), khóa cứng toàn bộ bảng, cấm tiệt mọi câu lệnh đọc ghi của ứng dụng cho đến khi chạy xong!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Kiểm Tra Tính Khả Kiến (Visibility Check Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                     QUY TẮC XÁC ĐỊNH TUPLE CÓ ĐƯỢC NHÌN THẤY?               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. ĐIỀU KIỆN 1 (Được sinh ra trước khi Snapshot bắt đầu):                  │
│    └── Giao dịch xmin PHẢI ĐÃ COMMIT và xmin < Snapshot.xmin                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. ĐIỀU KIỆN 2 (Chưa bị xóa trước khi Snapshot bắt đầu):                    │
│    ├── xmax = 0 (Chưa từng bị ai xóa) ──► TUPLE KHẢ KIẾN (HIỂN THỊ)         │
│    ├── Giao dịch xmax ĐÃ ROLLBACK ──────► TUPLE KHẢ KIẾN (VẪN CÒN SỐNG)     │
│    └── Giao dịch xmax ĐÃ COMMIT ────────► TUPLE VÔ HIỆU (BẢN GHI ĐÃ CHẾT!)  │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Tiến Hóa Của Tuple Qua Các Phiên Bản (Tuple Evolution Lifecycle)
\`\`\`diagram
1. INSERT: Tạo Tuple A (xmin: 100, xmax: 0)
   │
2. UPDATE lần 1:
   ├── Đánh dấu Tuple A (xmin: 100, xmax: 105) ──► Trở thành Dead Tuple sau khi tx 105 commit
   └── Tạo Tuple B mới (xmin: 105, xmax: 0)
   │
3. UPDATE lần 2:
   ├── Đánh dấu Tuple B (xmin: 105, xmax: 110) ──► Trở thành Dead Tuple sau khi tx 110 commit
   └── Tạo Tuple C mới (xmin: 110, xmax: 0)    ──► Tuple đang sống duy nhất!
   │
4. AutoVacuum thức giấc: Dọn dẹp xác của Tuple A và B, trả khoảng trống lại cho FSM
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Hiện Tượng Table Bloat (Bloat Mitigation Tree)
\`\`\`diagram
PHÁT HIỆN BẢNG DỮ LIỆU BỊ PHÌNH TO DUNG LƯỢNG (BLOAT > 40%)?
│
├── Bảng đang phục vụ Production có lưu lượng truy cập 24/7?
│   ├── TUYỆT ĐỐI CẤM CHẠY: VACUUM FULL (Sẽ gây treo cứng toàn bộ hệ thống!)
│   └──► SỬ DỤNG CÔNG CỤ ONLINE: pg_repack (Tái cấu trúc bảng ngầm không khóa)
│
├── Cần ngăn ngừa Bloat tái diễn trong tương lai?
│   └──► CẤU HÌNH LẠI THAM SỐ AUTOVACUUM RIÊNG CHO BẢNG ĐÓ:
│        ALTER TABLE orders SET (
│          autovacuum_vacuum_scale_factor = 0.05, -- Chỉ cần 5% bản ghi chết là dọn ngay
│          autovacuum_vacuum_cost_limit = 1000    -- Cho phép dọn dẹp nhanh hơn
│        );
│
└── Có Transaction nào bị treo (Idle in transaction) ngăn cản dọn dẹp không?
    └──► TÌM VÀ KILL NGAY: SELECT pg_terminate_backend(pid) FROM pg_stat_activity
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược Dọn Rác | Mức Độ Khóa Bảng (Locking) | Trả Lại Dung Lượng Cho Ổ Cứng | Ảnh Hưởng Hiệu Năng Hệ Thống | Ứng Dụng Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **AutoVacuum (Mặc định)**| $0\\%$ (Không khóa bảng) | Không (Giữ cho DB tái dùng) | Rất nhẹ, chạy background | Duy trì hệ thống vận hành 24/7 |
| **VACUUM FULL** | Khóa độc quyền toàn bảng | Có ($100\\%$ dung lượng dư) | Gây gián đoạn dịch vụ nghiêm trọng| Chỉ chạy trong lịch bảo trì ban đêm |
| **pg_repack** | Chỉ khóa vài mili giây cuối | Có ($100\\%$ dung lượng dư) | Tăng tải CPU và I/O tạm thời | Chuẩn cứu hộ Production không downtime |
| **HOT (Heap-Only Tuples)**| $0\\%$ (Tự dọn trong Page) | Giữ nguyên trong Page | Siêu nhanh ($0$ sửa Index) | Tự động khi UPDATE cột không có Index |
`,
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseVacuumDiagnosticsService {
  private readonly logger = new Logger(DatabaseVacuumDiagnosticsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Giám sát số lượng Dead Tuples và phát hiện các bảng có nguy cơ Bloat nghiêm trọng
   */
  public async inspectDeadTuplesAndBloat(): Promise<unknown[]> {
    const query = \`
      SELECT 
        schemaname,
        relname AS table_name,
        n_live_tup AS live_tuples,
        n_dead_tup AS dead_tuples,
        ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup + 0.0001)) * 100, 2) AS dead_tuple_ratio,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE (n_live_tup + n_dead_tup) > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 10;
    \`;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      if (parseFloat(row.dead_tuple_ratio) > 20) {
        this.logger.warn(
          \`[BLOAT ALERT] Bảng \${row.table_name} có tỉ lệ Dead Tuples cao: \${row.dead_tuple_ratio}% (\${row.dead_tuples} dead tuples)! Cần điều chỉnh tham số AutoVacuum.\`
        );
      }
    }

    return results;
  }
}
`,
      quiz: [
        {
          id: 'c6-l2-q1',
          question: 'Trong cơ chế Multi-Version Concurrency Control (MVCC) của PostgreSQL, điều gì thực sự xảy ra ở cấp độ vật lý khi thực thi một câu lệnh UPDATE?',
          options: [
            'Dòng dữ liệu cũ được đánh dấu đã bị xóa bằng cách ghi giá trị xmax, và một dòng dữ liệu mới toanh được chèn vào bảng với xmin mới.',
            'Dữ liệu mới được ghi đè trực tiếp lên chính các byte bộ nhớ của dòng cũ giúp tiết kiệm tối đa dung lượng lưu trữ trên đĩa cứng.',
            'Cơ sở dữ liệu tạm thời di chuyển toàn bộ bảng dữ liệu vào bộ nhớ đệm RAM để thay đổi giá trị của cột rồi mới ghi ngược lại đĩa.',
            'Hệ điều hành tạo ra một bản sao lưu toàn bộ cơ sở dữ liệu sang một thư mục tạm thời trước khi tiến hành cập nhật bản ghi.'
          ],
          correctIndex: 0,
          explanation: 'Trong PostgreSQL, UPDATE được hiện thực bằng cách: 1) Dòng cũ được giữ nguyên, chỉ cập nhật xmax bằng ID của transaction hiện tại để đánh dấu đã bị thay thế; 2) Tạo ra một Heap Tuple mới chứa giá trị mới với xmin bằng transaction ID hiện tại. Điều này cho phép các transaction đang đọc trước đó vẫn nhìn thấy dòng cũ mà không bị gián đoạn.'
        },
        {
          id: 'c6-l2-q2',
          question: 'Vì sao việc một giao dịch bị rơi vào trạng thái "Idle in transaction" trong thời gian dài lại có thể gây tê liệt khả năng dọn dẹp của tiến trình AutoVacuum?',
          options: [
            'Vì AutoVacuum không thể dọn dẹp bất kỳ Dead Tuple nào có xmax lớn hơn xmin của giao dịch đang treo đó vì nó vẫn có thể cần đọc dữ liệu.',
            'Vì hệ điều hành Linux sẽ tự động khóa cứng toàn bộ các tiến trình nền khi phát hiện có một kết nối mạng đang nhàn rỗi.',
            'Vì các tệp tin nhật ký WAL sẽ tự động ngừng ghi dữ liệu khiến cho dung lượng bộ nhớ chia sẻ Shared Buffers bị đầy tràn.',
            'Vì tiến trình AutoVacuum bắt buộc phải xin phép người dùng thông qua giao diện dòng lệnh mỗi khi muốn dọn dẹp các bảng lớn.'
          ],
          correctIndex: 0,
          explanation: 'Một transaction mở nhưng bị treo (Idle in transaction) giữ một Snapshot với Transaction ID cũ. AutoVacuum bắt buộc phải tôn trọng Snapshot này: Nó tuyệt đối không được phép dọn dẹp bất kỳ Dead Tuple nào sinh ra sau thời điểm transaction đó bắt đầu, vì transaction đó vẫn có quyền đọc chúng. Kết quả là Dead Tuples tích tụ khổng lồ, gây Bloat toàn bộ DB.'
        },
        {
          id: 'c6-l2-q3',
          question: 'Sự khác biệt mang tính sống còn giữa câu lệnh VACUUM thông thường và câu lệnh VACUUM FULL trong môi trường Production là gì?',
          options: [
            'VACUUM thường không khóa bảng và chỉ đánh dấu tái sử dụng khoảng trống, còn VACUUM FULL chiếm giữ Exclusive Lock khóa cứng toàn bộ bảng.',
            'VACUUM thường chỉ dọn dẹp các cột số nguyên, trong khi VACUUM FULL có khả năng dọn dẹp toàn bộ các cột chứa định dạng văn bản JSON.',
            'VACUUM thường bắt buộc phải khởi động lại máy chủ cơ sở dữ liệu, còn VACUUM FULL có thể chạy ngầm hoàn toàn không tốn tài nguyên CPU.',
            'VACUUM FULL chỉ xóa bỏ các tệp tin log nhật ký giao dịch cũ mà không can thiệp vào bất kỳ tệp dữ liệu chính nào của bảng.'
          ],
          correctIndex: 0,
          explanation: 'VACUUM thông thường chạy online, không chặn các thao tác SELECT/INSERT/UPDATE/DELETE, chỉ gom chỗ trống để bảng tái sử dụng. Ngược lại, VACUUM FULL tạo ra một tệp bảng mới và copy dữ liệu sang để trả lại dung lượng cho OS; nó đòi hỏi ACCESS EXCLUSIVE LOCK, chặn đứng mọi thao tác đọc/ghi của người dùng, có thể làm sập hệ thống Production nếu bảng lớn.'
        },
        {
          id: 'c6-l2-q4',
          question: 'Cơ chế tối ưu Heap-Only Tuple (HOT) trong PostgreSQL giúp tiết kiệm chi phí tài nguyên nào lớn nhất khi cập nhật dữ liệu?',
          options: [
            'Loại bỏ hoàn toàn việc phải cập nhật các cây chỉ mục B-Tree nếu dòng mới được đặt vừa vặn trong cùng một Page 8KB với dòng cũ.',
            'Tự động giải phóng toàn bộ bộ nhớ RAM của máy chủ và chuyển sang sử dụng bộ nhớ đệm ảo trên các dịch vụ đám mây.',
            'Cho phép thực hiện các phép toán nhân ma trận trực tiếp bên trong nhân hệ điều hành mà không cần thông qua V8 engine.',
            'Tự động chuyển đổi các bảng dữ liệu quan hệ sang định dạng tệp tin nhị phân không thể giải mã để nâng cao tính bảo mật.'
          ],
          correctIndex: 0,
          explanation: 'Thông thường mỗi khi có tuple mới, tất cả các Index của bảng đều phải chèn thêm con trỏ trỏ tới tuple mới đó. Kỹ thuật HOT (Heap-Only Tuple) cho phép: Nếu câu UPDATE không làm thay đổi các cột có đánh Index và Page 8KB hiện tại còn chỗ trống, PostgreSQL sẽ đặt dòng mới ngay trong Page đó và nối con trỏ từ dòng cũ sang dòng mới, hoàn toàn không cần chạm vào Index!'
        }
      ],
      codeChallenge: {
        id: 'c6-l2-c1',
        title: 'Bộ Thẩm Định Tính Khả Kiến Của Bản Ghi (MVCC Visibility Evaluator)',
        description: 'Hiện thực hàm \`isTupleVisible(tuple: { xmin: number; xmax: number }, snapshotXmin: number, activeTxIds: number[]): boolean\`. Một tuple được coi là khả kiến (visible) đối với snapshot nếu: 1. \`tuple.xmin < snapshotXmin\` VÀ \`tuple.xmin\` không nằm trong danh sách các transaction đang chạy (\`activeTxIds\`). 2. VÀ (tuple chưa bị xóa: \`tuple.xmax === 0\` HOẶC giao dịch xóa nó sinh ra sau snapshot: \`tuple.xmax >= snapshotXmin\` HOẶC giao dịch xóa nó vẫn đang chạy dở: \`activeTxIds.includes(tuple.xmax)\`). Trả về \`true\` nếu thỏa mãn, ngược lại \`false\`.',
        starterCode: `
export function isTupleVisible(
  tuple: { xmin: number; xmax: number },
  snapshotXmin: number,
  activeTxIds: number[]
): boolean {
  // TODO: Kiểm tra tính khả kiến theo quy tắc MVCC
  return false;
}
`,
        solution: `
export function isTupleVisible(
  tuple: { xmin: number; xmax: number },
  snapshotXmin: number,
  activeTxIds: number[]
): boolean {
  // 1. Kiểm tra transaction tạo ra tuple đã hoàn tất trước snapshot chưa
  const isCreatedCommitted =
    tuple.xmin < snapshotXmin && !activeTxIds.includes(tuple.xmin);

  if (!isCreatedCommitted) {
    return false;
  }

  // 2. Kiểm tra xem tuple đã bị xóa chưa
  if (tuple.xmax === 0) {
    return true; // Chưa từng bị xóa
  }

  // Nếu bị xóa bởi transaction sau thời điểm snapshot hoặc transaction xóa đang chạy dở
  const isDeletedAfterOrInProgress =
    tuple.xmax >= snapshotXmin || activeTxIds.includes(tuple.xmax);

  return isDeletedAfterOrInProgress;
}
`,
        testCases: [
          {
            name: 'Tuple hợp lệ chưa từng bị xóa (xmin = 50, xmax = 0, snapshot = 100)',
            input: [{ xmin: 50, xmax: 0 }, 100, []],
            expected: true
          },
          {
            name: 'Tuple đã bị xóa trước thời điểm snapshot (xmin = 50, xmax = 80, snapshot = 100)',
            input: [{ xmin: 50, xmax: 80 }, 100, []],
            expected: false
          },
          {
            name: 'Tuple bị xóa bởi transaction đang chạy dở chưa commit (xmax = 90 nằm trong activeTxIds)',
            input: [{ xmin: 50, xmax: 90 }, 100, [90]],
            expected: true
          }
        ]
      }
    },
    {
      id: 'c6-l3',
      title: 'Bài 03: Locking Chiến Lược: Pessimistic Locking (SELECT FOR UPDATE) vs Optimistic Locking & Deadlock Resolution',
      duration: '60 phút',
      tag: 'Locking Strategies & Deadlocks',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: Ổ KHÓA CỬA PHÒNG THỬ ĐỒ VS PHIẾU HẸN SỐ THỨ TỰ

Bài toán kinh điển: Hai người dùng cùng nhìn thấy một chiếc vé máy bay duy nhất còn lại và cùng bấm nút "Đặt vé" tại cùng một mili giây:
* **Khóa bi quan (Pessimistic Locking - Ổ khóa cài then cửa phòng thử đồ):** Bạn bước vào phòng thử đồ, bạn tin rằng thế giới bên ngoài đầy rẫy sự tranh giành ("Pessimistic - Bi quan"). Bạn lập tức gài then chốt cửa lại (\`SELECT ... FOR UPDATE\`). Bất kỳ ai khác muốn bước vào đều phải đứng ngoài cửa chờ đợi trong im lặng. Khi bạn thử đồ xong và bước ra (Commit Transaction), người tiếp theo mới được phép bước vào. An toàn tuyệt đối, nhưng nếu bạn ngủ quên trong phòng, cả hàng dài người phía sau bị tắc nghẽn!
* **Khóa lạc quan (Optimistic Locking - Phiếu hẹn số thứ tự):** Bạn tin rằng thế giới rất hòa bình ("Optimistic - Lạc quan"). Bạn không khóa bất kỳ thứ gì cả. Bạn cầm chiếc áo và tờ phiếu ghi "Phiên bản số 5 (\`version = 5\`)". Bạn ra quầy thanh toán và nói: "Tôi mua chiếc áo phiên bản 5 và đổi phiếu thành phiên bản 6 (\`UPDATE ... WHERE version = 5\`)". Nếu người khác đã nhanh chân mua trước và đổi thành bản 6, hệ thống thông báo: "Chiếc áo này đã bị thay đổi, xin mời thử lại!". Không ai phải chờ đợi ai, tốc độ đọc tối đa, nhưng nếu tranh chấp quá gay gắt, nhiều người sẽ bị thất bại liên tục!

---

# 2. KHÓA BI QUAN (PESSIMISTIC LOCKING) & CÁC BIẾN THỂ

Trong SQL chuẩn, khóa bi quan được thực hiện bằng mệnh đề khóa hàng (Row-level Locks):

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CÁC CẤP ĐỘ KHÓA HÀNG CỦA POSTGRESQL                 │
├─────────────────────┬──────────────────┬────────────────────────────────────┤
│ Cú Pháp Lệnh        │ Loại Khóa        │ Tác Động Lên Các Giao Dịch Khác    │
├─────────────────────┼──────────────────┼────────────────────────────────────┤
│ SELECT FOR UPDATE   │ Exclusive Lock   │ Chặn mọi UPDATE, DELETE và các     │
│                     │                  │ câu lệnh FOR UPDATE/SHARE khác.    │
├─────────────────────┼──────────────────┼────────────────────────────────────┤
│ SELECT FOR SHARE    │ Shared Lock      │ Cho phép người khác cùng đọc       │
│                     │                  │ (FOR SHARE) nhưng chặn UPDATE/DEL. │
├─────────────────────┼──────────────────┼────────────────────────────────────┤
│ FOR UPDATE NOWAIT   │ Non-blocking     │ Nếu dòng đang bị ai khóa, ném lỗi  │
│                     │                  │ ngay lập tức thay vì đứng chờ.     │
├─────────────────────┼──────────────────┼────────────────────────────────────┤
│ FOR UPDATE          │ Skip Locked Rows │ Bỏ qua các dòng đang bị khóa, chỉ  │
│ SKIP LOCKED         │                  │ lấy các dòng rảnh (Tuyệt đỉnh Queue│
└─────────────────────┴──────────────────┴────────────────────────────────────┘
\`\`\`

### 2.1 Vũ Khí Tối Thượng Cho Hàng Đợi Message: FOR UPDATE SKIP LOCKED
Khi xây dựng hệ thống Job Queue bằng cơ sở dữ liệu quan hệ (chẳng hạn nhiều Worker cùng tranh nhau lấy công việc từ bảng \`tasks\`):
\`\`\`sql
SELECT * FROM tasks 
WHERE status = 'PENDING' 
ORDER BY id ASC 
LIMIT 1 
FOR UPDATE SKIP LOCKED;
\`\`\`
Nếu 10 Worker chạy cùng lúc: Worker 1 khóa Task 1, Worker 2 thấy Task 1 bị khóa liền **tự động nhảy qua Task 2 mà không hề bị block 1 mili giây nào!** 10 Worker xử lý song song 10 Task với hiệu năng tương đương Redis Queue!

---

# 3. HIỂM HỌA DEADLOCK & NGUYÊN TẮC PHÒNG CHỐNG

Deadlock (Khóa chết) xảy ra khi có sự phụ thuộc vòng tròn giữa 2 hoặc nhiều giao dịch:

\`\`\`diagram
[ TRANSACTION 1 ]                                       [ TRANSACTION 2 ]
       │                                                       │
       ├── 1. Khóa thành công Tài khoản A                      ├── 1. Khóa thành công Tài khoản B
       │      (UPDATE accounts SET balance... WHERE id = A)    │      (UPDATE accounts SET balance... WHERE id = B)
       │                                                       │
       ├── 2. Cố gắng khóa Tài khoản B ──────────────┐         ├── 2. Cố gắng khóa Tài khoản A ──────────────┐
       │      (BỊ TREO CHỜ TRANSACTION 2 GIẢI PHÓNG)│         │      (BỊ TREO CHỜ TRANSACTION 1 GIẢI PHÓNG)│
       │                                             ▼         │                                             ▼
       │                                       [ DEADLOCK ] ───┴─────────────────────────────────────────────┘
       │                                (CẢ HAI CÙNG TREO CHỜ NHAU MÃI MÃI!)
       │                                             │
       ▼                                             ▼
[ PostgreSQL Deadlock Detector thức giấc ] ──► Tự động hủy 1 giao dịch và ném lỗi 40P01 !
\`\`\`

### 3.1 Nguyên Tắc Vàng Phòng Chống Deadlock: SẮP XẾP THỨ TỰ KHÓA (LOCK ORDERING)
Để triệt tiêu Deadlock $100\\%$ trong các bài toán chuyển tiền giữa 2 tài khoản (A chuyển cho B):
> **Quy Tắc Bất Di Bất Dịch:** Luôn luôn sắp xếp thứ tự các khóa cần chiếm giữ theo chiều tăng dần của ID (\`id_min\` khóa trước, \`id_max\` khóa sau)!
\`\`\`typescript
const firstId = Math.min(fromAccountId, toAccountId);
const secondId = Math.max(fromAccountId, toAccountId);

// Dù A chuyển cho B hay B chuyển cho A, cả 2 giao dịch đều bắt buộc phải khóa firstId trước!
// Không bao giờ có thể xảy ra chu trình vòng tròn -> TRIỆT TIÊU HOÀN TOÀN DEADLOCK!
await manager.findOne(Account, { where: { id: firstId }, lock: { mode: 'pessimistic_write' } });
await manager.findOne(Account, { where: { id: secondId }, lock: { mode: 'pessimistic_write' } });
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Khóa Hệ Thống (Lock Hierarchy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CÁC CẤP ĐỘ KHÓA TRONG DATABASE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. TABLE-LEVEL LOCKS (Khóa cấp bảng)                                        │
│    ├── AccessShareLock (SELECT thông thường - Không chặn ai)                │
│    ├── RowExclusiveLock (INSERT, UPDATE, DELETE)                            │
│    └── AccessExclusiveLock (ALTER TABLE, VACUUM FULL - Khóa sạch toàn bộ)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. ROW-LEVEL LOCKS (Khóa cấp dòng)                                          │
│    ├── For Update (Độc quyền ghi)                                           │
│    ├── For Share (Chia sẻ quyền đọc)                                        │
│    └── For No Key Update / For Key Share (Tối ưu ràng buộc khóa ngoại)       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ADVISORY LOCKS (Khóa ứng dụng tùy biến do lập trình viên tự quản lý)      │
│    └── pg_advisory_xact_lock(bigint): Khóa logic mà không cần dòng trong DB │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: So Sánh Dòng Chảy Lạc Quan vs Bi Quan (Optimistic vs Pessimistic Flow)
\`\`\`diagram
KHÓA BI QUAN (PESSIMISTIC):
Client A: SELECT ... FOR UPDATE ──► [ GIỮ KHÓA HÀNG ]
Client B: SELECT ... FOR UPDATE ──► [ BỊ BLOCK, ĐỨNG CHỜ CLIENT A COMMIT ]
Client A: UPDATE ... ──► COMMIT ──► [ GIẢI PHÓNG KHÓA ]
Client B: Hết bị block, tiếp tục thực thi an toàn.

KHÓA LẠC QUAN (OPTIMISTIC):
Client A: Đọc sản phẩm (version = 1) ──► Tính toán logic...
Client B: Đọc sản phẩm (version = 1) ──► Tính toán logic...
Client A: UPDATE ... SET version = 2 WHERE version = 1 ──► [ THÀNH CÔNG! ]
Client B: UPDATE ... SET version = 2 WHERE version = 1 ──► [ THẤT BÀI (0 dòng bị sửa)! ]
Client B: Ném ngoại lệ OptimisticLockException ──► Bắt buộc thử lại hoặc báo lỗi người dùng.
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Chiến Lược Khóa (Locking Decision Tree)
\`\`\`diagram
BẠN ĐANG XỬ LÝ TRANH CHẤP DỮ LIỆU ĐỒNG THỜI?
│
├── Tỉ lệ xung đột rất thấp (Nhiều người đọc, hiếm khi sửa cùng lúc)?
│   └──► CHỌN: Khóa lạc quan (Optimistic Locking với cột @VersionColumn)
│        (Ưu điểm: Không tốn chi phí khóa dòng, throughput cực cao)
│
├── Tỉ lệ xung đột cực kỳ cao (Flash sale 100 chiếc iPhone cho 50,000 người tranh mua)?
│   └──► CHỌN: Khóa bi quan (Pessimistic Locking: SELECT FOR UPDATE)
│        (Tránh việc hàng chục nghìn transaction bị rollback lãng phí tài nguyên)
│
└── Hệ thống Worker cần nhặt việc từ bảng Queue?
    └──► CHỌN: SELECT ... FOR UPDATE SKIP LOCKED
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược Khóa | Mức Độ Khóa DB | Khả Năng Mở Rộng (Throughput) | Nguy Cơ Gây Deadlock | Kịch Bản Lý Tưởng |
| :--- | :--- | :--- | :--- | :--- |
| **Pessimistic (FOR UPDATE)** | Khóa dòng vật lý | Thấp hơn khi tranh chấp cao | Có nguy cơ nếu không sắp thứ tự | Ngân hàng, trừ tiền, vé máy bay |
| **Optimistic (@Version)** | $0\\%$ Khóa DB | Tối đa cho việc đọc dữ liệu | Hoàn toàn $0\\%$ Deadlock | Quản lý Profile, bài viết CMS |
| **SKIP LOCKED** | Khóa các dòng được chọn | Cực cao cho đa luồng | Hầu như không có | Message Queue trên PostgreSQL |
| **Advisory Locks** | Khóa định danh logic | Rất cao, linh hoạt | Tùy thuộc lập trình viên | Cron job cluster, migrate dữ liệu |
`,
      realCodeSnippet: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HighConcurrencyTransferService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Chuyển tiền giữa hai tài khoản với Khóa Bi Quan và Sắp xếp thứ tự khóa để triệt tiêu Deadlock 100%
   */
  public async transferMoney(
    fromAccountId: number,
    toAccountId: number,
    amount: number
  ): Promise<void> {
    if (fromAccountId === toAccountId) {
      throw new Error('Tài khoản gửi và nhận không thể trùng nhau.');
    }

    // NGUYÊN TẮC SẮP XẾP THỨ TỰ KHÓA ĐỂ CHỐNG DEADLOCK
    const firstLockId = Math.min(fromAccountId, toAccountId);
    const secondLockId = Math.max(fromAccountId, toAccountId);

    await this.dataSource.transaction(async (manager) => {
      // 1. Khóa theo thứ tự ID tăng dần một cách nhất quán
      const firstAccount = await manager.query(
        \`SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE\`,
        [firstLockId]
      );
      const secondAccount = await manager.query(
        \`SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE\`,
        [secondLockId]
      );

      const sender = fromAccountId === firstLockId ? firstAccount[0] : secondAccount[0];
      const receiver = toAccountId === firstLockId ? firstAccount[0] : secondAccount[0];

      if (!sender || !receiver) {
        throw new Error('Tài khoản không tồn tại.');
      }

      if (sender.balance < amount) {
        throw new Error('Số dư không đủ để thực hiện giao dịch.');
      }

      // 2. Thực hiện trừ và cộng tiền
      await manager.query(
        \`UPDATE accounts SET balance = balance - $1 WHERE id = $2\`,
        [amount, fromAccountId]
      );
      await manager.query(
        \`UPDATE accounts SET balance = balance + $1 WHERE id = $2\`,
        [amount, toAccountId]
      );
    });
  }
}
`,
      quiz: [
        {
          id: 'c6-l3-q1',
          question: 'Vì sao kỹ thuật "Sắp xếp thứ tự khóa" (Lock Ordering: Math.min / Math.max) lại có thể triệt tiêu hoàn toàn nguy cơ Deadlock trong nghiệp vụ chuyển tiền giữa hai tài khoản?',
          options: [
            'Vì nó phá vỡ điều kiện chờ đợi vòng tròn bằng cách ép buộc mọi giao dịch đều phải chiếm giữ tài nguyên theo cùng một chiều duy nhất.',
            'Vì hàm Math.min trong JavaScript có khả năng tự động liên lạc với nhân Linux để hủy bỏ các tiến trình đang bị nghẽn mạng.',
            'Vì cơ sở dữ liệu sẽ tự động chuyển đổi các câu lệnh cập nhật số dư thành các phép tính toán song song trên card đồ họa.',
            'Vì các tài khoản có số ID nhỏ hơn luôn có số dư lớn hơn giúp giao dịch không bao giờ gặp phải lỗi thiếu tiền.',
          ],
          correctIndex: 0,
          explanation: 'Deadlock chỉ có thể xảy ra khi thỏa mãn điều kiện Chờ đợi vòng tròn (Circular Wait - Giao dịch 1 giữ A chờ B, Giao dịch 2 giữ B chờ A). Bằng cách sắp xếp ID tăng dần (khóa Min trước, Max sau), tất cả mọi giao dịch dù chuyển tiền theo chiều nào cũng đều phải yêu cầu khóa tài nguyên theo cùng một trật tự xác định, phá vỡ hoàn toàn chu trình khép kín, triệt tiêu Deadlock 100%.'
        },
        {
          id: 'c6-l3-q2',
          question: 'Mệnh đề "SELECT ... FOR UPDATE SKIP LOCKED" đem lại giải pháp đột phá nào khi hiện thực hệ thống hàng đợi công việc (Job Queue) trên cơ sở dữ liệu quan hệ?',
          options: [
            'Cho phép nhiều worker đọc đồng thời mà không bị block lẫn nhau vì mỗi worker tự động bỏ qua các dòng đã bị worker khác khóa.',
            'Tự động tăng tốc độ xử lý của CPU máy chủ lên gấp mười lần bằng cách vô hiệu hóa hoàn toàn cơ chế ghi log nhật ký WAL.',
            'Giúp các tác vụ công việc bị lỗi tự động được sửa đổi dữ liệu thành công mà không cần lập trình viên viết mã xử lý ngoại lệ.',
            'Cho phép các worker có thể đọc được dữ liệu của nhau ngay cả khi giao dịch của worker khác đã bị rollback thất bại.',
          ],
          correctIndex: 0,
          explanation: 'Nếu chỉ dùng "FOR UPDATE", các Worker đến sau sẽ bị treo cứng (blocked) chờ Worker đầu tiên xử lý xong dòng đó. Với "SKIP LOCKED", PostgreSQL kiểm tra các dòng thỏa mãn điều kiện: dòng nào đang bị khóa bởi Worker khác sẽ được tự động bỏ qua (skip), và trả về ngay dòng tự do tiếp theo. Nhờ đó hàng chục Worker có thể lấy các task khác nhau đồng thời mà không hề bị nghẽn.'
        },
        {
          id: 'c6-l3-q3',
          question: 'Trong trường hợp nào sau đây, việc sử dụng Khóa Lạc Quan (Optimistic Locking) sẽ trở nên KÉM HIỆU QUẢ hơn hẳn so với Khóa Bi Quan (Pessimistic Locking)?',
          options: [
            'Khi mức độ tranh chấp dữ liệu cực kỳ cao ví dụ như hàng chục nghìn người cùng tranh mua một số lượng hàng tồn kho rất nhỏ trong Flash Sale.',
            'Khi ứng dụng chỉ thực hiện các thao tác đọc dữ liệu thống kê báo cáo và rất hiếm khi có người dùng sửa đổi thông tin cá nhân.',
            'Khi hệ thống được triển khai trên duy nhất một máy chủ vật lý và không sử dụng bất kỳ mạng phân tán nào từ bên ngoài.',
            'Khi bảng dữ liệu có số lượng cột ít hơn mười trường và tất cả các trường đều có kiểu dữ liệu là số nguyên nguyên thủy.',
          ],
          correctIndex: 0,
          explanation: 'Trong kịch bản xung đột cực cao (High Contention như Flash Sale), nếu dùng Khóa Lạc Quan, 99.9% giao dịch sẽ bị lỗi xung đột phiên bản (OptimisticLockException) ở bước cuối cùng sau khi đã tốn rất nhiều tài nguyên tính toán logic, buộc phải rollback và retry liên tục gây lãng phí CPU. Dùng Khóa Bi Quan (SELECT FOR UPDATE) xếp hàng ngay từ đầu sẽ hiệu quả hơn nhiều.'
        },
        {
          id: 'c6-l3-q4',
          question: 'Cơ chế phát hiện Deadlock nội bộ của PostgreSQL (Deadlock Detector) hoạt động dựa trên nguyên lý nào khi phát hiện có chu trình bế tắc giữa các giao dịch?',
          options: [
            'Duyệt đồ thị chờ đợi khóa (Lock Wait-For Graph), nếu phát hiện chu trình sau khoảng thời gian deadlock_timeout sẽ chủ động hủy một giao dịch.',
            'Tự động ngắt kết nối internet của toàn bộ máy chủ để ép buộc tất cả các client phải thực hiện đăng nhập lại từ đầu.',
            'Tự động gộp dữ liệu của hai giao dịch bị nghẽn thành một giao dịch tổng thể duy nhất và commit vào lúc nửa đêm.',
            'Chuyển đổi toàn bộ cơ sở dữ liệu sang chế độ chỉ đọc vĩnh viễn cho đến khi có sự can thiệp thủ công của quản trị viên hệ thống.',
          ],
          correctIndex: 0,
          explanation: 'PostgreSQL có một tiến trình Deadlock Detector. Sau một khoảng thời gian chờ đợi (mặc định tham số deadlock_timeout = 1s), tiến trình này sẽ quét đồ thị chờ khóa (Lock Wait-For Graph). Nếu phát hiện một chu trình phụ thuộc khép kín (A đợi B, B đợi A), nó sẽ chọn một giao dịch làm "vật hy sinh", chủ động ROLLBACK giao dịch đó và trả về lỗi "40P01 deadlock_detected" để giải phóng các giao dịch còn lại.'
        }
      ],
      codeChallenge: {
        id: 'c6-l3-c1',
        title: 'Bộ Sắp Xếp Cặp Khóa An Toàn Chống Deadlock (Lock Ordering Pair Sorter)',
        description: 'Hiện thực hàm \`getOrderedLockPairs(accountA: number, accountB: number): [number, number]\`. Hàm nhận vào 2 ID tài khoản bất kỳ. Nếu 2 ID trùng nhau, ném ra Error \`"IDENTICAL_ACCOUNTS"\`. Ngược lại, luôn luôn trả về một mảng tuple 2 phần tử được sắp xếp theo thứ tự số nguyên tăng dần \`[minId, maxId]\` để đảm bảo thứ tự khóa chống Deadlock.',
        starterCode: `
export function getOrderedLockPairs(
  accountA: number,
  accountB: number
): [number, number] {
  // TODO: Hiện thực sắp xếp cặp khóa chống deadlock
  return [accountA, accountB];
}
`,
        solution: `
export function getOrderedLockPairs(
  accountA: number,
  accountB: number
): [number, number] {
  if (accountA === accountB) {
    throw new Error('IDENTICAL_ACCOUNTS');
  }

  return accountA < accountB ? [accountA, accountB] : [accountB, accountA];
}
`,
        testCases: [
          {
            name: 'Sắp xếp khi A < B (ID 10 và ID 20)',
            input: [10, 20],
            expected: [10, 20]
          },
          {
            name: 'Sắp xếp khi A > B (ID 50 và ID 15) đảo ngược trật tự',
            input: [50, 15],
            expected: [15, 50]
          },
          {
            name: 'Ném lỗi khi 2 ID trùng nhau (ID 99 và ID 99)',
            input: [99, 99],
            expected: 'THREW_ERROR'
          }
        ]
      }
    }
  ]
};
