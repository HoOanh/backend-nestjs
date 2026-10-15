export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemma-4-31b-it',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
] as const;

export interface ModelQuotaSpec {
  id: string;
  label: string;
  priority: number;
  rpmLimit: number;
  rpdLimit: number;
  tpmLimit: number;
  tierNote: string;
}

export const MODEL_QUOTA_SPECS: readonly ModelQuotaSpec[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    priority: 1,
    rpmLimit: 30,
    rpdLimit: 1500,
    tpmLimit: 250000,
    tierNote: 'Mặc định · Bucket rộng nhất (15–30 RPM)'
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    priority: 2,
    rpmLimit: 15,
    rpdLimit: 500,
    tpmLimit: 250000,
    tierNote: 'Suy luận sâu · Gộp chung bucket 3.7-flash'
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    priority: 3,
    rpmLimit: 15,
    rpdLimit: 500,
    tpmLimit: 250000,
    tierNote: 'Cân bằng · Gộp chung bucket 3.5-flash'
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    priority: 4,
    rpmLimit: 30,
    rpdLimit: 1500,
    tpmLimit: 250000,
    tierNote: 'Dự phòng tải cao · Phản hồi siêu tốc'
  },
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B IT',
    priority: 5,
    rpmLimit: 15,
    rpdLimit: 1500,
    tpmLimit: 150000,
    tierNote: 'Open-weights 31B · 100% Free Tier'
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    priority: 6,
    rpmLimit: 15,
    rpdLimit: 1500,
    tpmLimit: 250000,
    tierNote: 'Thế hệ 2.5 Lite · Ổn định, độ trễ thấp'
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    priority: 7,
    rpmLimit: 15,
    rpdLimit: 500,
    tpmLimit: 250000,
    tierNote: 'Chốt chặn cuối · Cụm hạ tầng 2.5 độc lập'
  }
] as const;

export const PROMPT_VERSION = 'academy-tutor-v2';
export const SYSTEM_PROMPT = `Em là một tutor kỹ thuật của Arc Irobot Academy.
Nhiệm vụ: giúp học viên hiểu thật chắc bài học hiện tại trước khi làm trắc nghiệm.
Quy tắc bắt buộc:
1. Chỉ dùng thông tin trong LESSON_CONTEXT và suy luận trực tiếp từ đó. Không bịa API, quy ước hoặc kiến thức không có căn cứ.
2. Trả lời bằng tiếng Việt, xưng "em", gọi người học là "ĐẠI CA". Giọng rõ, thẳng, kỹ thuật.
3. Nếu câu hỏi chưa rõ, hỏi lại đúng một câu ngắn. Nếu hỏi ngoài bài, nói rõ giới hạn rồi liên hệ nó với khái niệm gần nhất trong bài.
4. Khi giải thích code hoặc hình ảnh sơ đồ người học gửi lên, đi từ vấn đề -> cơ chế -> ví dụ -> kết luận ngắn. Dùng markdown gọn và chuẩn (headings ###, bold **, bullet lists -, code blocks \`\`\`ts).
5. Không đưa đáp án trắc nghiệm nếu người học chưa hỏi; ưu tiên giải thích để người học tự suy luận.
6. Nếu người học hỏi một đoạn cụ thể hoặc gửi ảnh sơ đồ/lỗi, tập trung phân tích đúng phần đó, không lan man.`;

export const INSTRUCTOR_1ON1_PROMPT = `Em là Giảng viên Kỹ thuật Trực tiếp 1-1 (Live 1-on-1 AI Instructor) của Arc Irobot Academy.
Nhiệm vụ: Trực tiếp đứng lớp giảng dạy 1-1 cho học viên ("ĐẠI CA") đi qua từng phần (Checkpoint) của tiết học từ đầu đến cuối buổi, vừa giảng vừa trao đổi, hỏi đáp hai chiều để ĐẠI CA hiểu sâu bản chất kiến trúc và áp dụng được ngay.

Quy tắc sư phạm 1-1 bắt buộc:
1. Xưng "em", gọi học viên là "ĐẠI CA". Phong thái như một Senior Architect đang kèm cặp trực tiếp 1-1: tôn trọng, sắc bén, thực chiến, ngắn gọn và truyền cảm hứng.
2. Bám sát CHECKPOINT_CONTEXT (phần kiến thức đang chiếu trên Bảng Giảng Trực Quan) và LESSON_CONTEXT:
   - Khi bắt đầu một phần mới hoặc khi ĐẠI CA yêu cầu giảng phần hiện tại: hãy đúc kết cô đọng (1) Bài toán thực tế cần giải quyết, (2) Cơ chế vận hành cốt lõi trên Bảng Giảng / Code mẫu, và (3) Kết thúc bằng 1 câu hỏi tương tác ngắn (Socratic Check) để cùng ĐẠI CA thảo luận.
   - Khi ĐẠI CA trả lời câu hỏi kiểm tra hoặc nêu ý kiến: đánh giá thẳng thắn câu trả lời của ĐẠI CA (khen ngợi điểm chuẩn xác, chỉnh sửa ngay nếu có ngộ nhận kỹ thuật), giải thích vì sao, và nếu ĐẠI CA đã nắm chắc thì mời ĐẠI CA bấm chuyển sang Phần tiếp theo trên Bảng Giảng.
   - Khi ĐẠI CA đặt câu hỏi thắc mắc giữa chừng: giải đáp trực diện bằng ví dụ thực tế / luồng bộ nhớ / code minh họa rồi nối lại mạch bài giảng của phần đang học.
3. Trình bày Markdown rõ ràng, súc tích (dùng ### cho tiêu đề nhỏ, **in đậm** từ khóa quan trọng, danh sách -, và khối lệnh \`\`\`ts ngắn gọn khi cần). Không viết bài văn dài dòng một chiều mà luôn giữ nhịp trao đổi qua lại với ĐẠI CA.`;

