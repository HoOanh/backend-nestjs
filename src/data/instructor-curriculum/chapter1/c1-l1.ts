import type { InstructorLessonPlan, InstructorSlide } from '../types';
import { guidedSlide } from '../guidedSlide';
import { c1l1Storyboards } from './c1-l1-storyboards';

function teach(input: Parameters<typeof guidedSlide>[0]): InstructorSlide {
  return guidedSlide({ ...input, storyboard: c1l1Storyboards[input.id] });
}

/** Same case throughout: a clinic API serving two tenants and many waiting sockets.
 * On-screen evidence is deliberately shorter than the spoken explanation.
 * Section IDs remain stable because saved classroom checkpoints reference them.
 */
function overview(input: Parameters<typeof teach>[0]): InstructorSlide {
  const slide = teach(input);
  return {
    ...slide,
    presentationRole: 'overview'
  };
}

export const instructor_c1_l1: InstructorLessonPlan = {
  lessonId: 'c1-l1',
  title: 'Từ một request đặt lịch đến cách Node.js phục vụ nhiều kết nối',
  durationMinutes: 90,
  opening: overview({
    id: 'opening-incident',
    title: 'Chỉ có vài người đặt lịch, vì sao API vẫn trả chậm?',
    subtitle: 'Theo một ứng dụng phòng khám từ lúc chạy đến lúc gặp sự cố',
    lead: 'Một API đặt lịch: lúc chạy đúng, lúc trả chậm, có lúc đọc nhầm dữ liệu phòng khám.',
    intro: 'Hãy hình dung mình vừa đưa một API đặt lịch khám lên server. Người dùng gửi yêu cầu, ứng dụng đọc database rồi trả về các khung giờ còn trống. Khi thử một mình, mọi thứ có vẻ đúng. Nhưng khi hai phòng khám cùng sử dụng, có lúc dữ liệu bị lẫn, có lúc chờ rất lâu. Mình chưa vội tăng cấu hình máy. Ta sẽ lần theo chính yêu cầu đặt lịch để biết điều gì đang diễn ra.',
    exhibit: { label: 'Ca xuyên suốt' },
    steps: [
      { title: 'Ai đang giữ dữ liệu?', detail: 'File chương trình, process và service không có cùng vòng đời.', speech: 'Trước hết, ta cần biết thứ gì đang chạy và dữ liệu đang nằm ở đâu. File được deploy không phải bản thân server đang sống. Cũng không phải cứ có request mới là hệ điều hành tạo một server mới. Nếu hiểu nhầm điều này, mình rất dễ đặt dữ liệu của một người dùng vào nơi nhiều người cùng dùng.' },
      { title: 'Thời gian đã đi đâu?', detail: 'Tách thời gian chạy code khỏi thời gian chờ database.', speech: 'Tiếp theo, mình tách hai việc rất hay bị gọi chung là xử lý request. Có lúc CPU thực sự đang chạy code. Có lúc ứng dụng chỉ đang chờ database hoặc mạng. Hai loại thời gian này cần hai cách sửa khác nhau. Một máy có CPU còn rảnh vẫn có thể trả lời rất chậm.' },
      { title: 'Đọc bằng chứng trước khi sửa', detail: 'Dùng trace, số request chờ và số liệu bộ nhớ để kiểm chứng.', speech: 'Cuối cùng, mình sẽ đưa ra một bộ số liệu rồi cùng chọn bước kiểm tra tiếp theo. Không cần thuộc hết tên công cụ ngay từ đầu. Mỗi thuật ngữ chỉ xuất hiện khi ta cần nó để giải thích một hiện tượng đã thấy trong ví dụ.' }
    ],
    takeaway: 'Câu hỏi xuyên suốt: request đang chạy, đang chờ, hay đang dùng nhầm dữ liệu?',
    conclusion: 'Kết thúc bài, mục tiêu không phải là đọc lại định nghĩa Node.js. Mục tiêu là giải thích được vì sao API trong ví dụ sai hoặc chậm, và đề xuất một phép đo cụ thể để kiểm tra cách hiểu của mình.'
  }),
  roadmap: overview({
    id: 'lesson-roadmap', title: 'Mỗi chặng trả lời một câu hỏi',
    subtitle: 'Đi từ hiện tượng quen thuộc đến cơ chế bên trong',
    lead: 'Mình giữ nguyên một API và thay đổi từng điều kiện để quan sát kết quả.',
    intro: 'Ta không bắt đầu bằng một danh sách dài thuật ngữ. Mình sẽ đi theo bốn câu hỏi, và câu trả lời trước sẽ làm nền cho câu tiếp theo.',
    exhibit: { label: 'Lộ trình' },
    steps: [
      { title: 'Chạy server nghĩa là gì?', detail: 'Program → process → thread → tài nguyên.', speech: 'Đầu tiên, chạy server thực sự tạo ra những gì? Mình sẽ mở hai lần cùng một chương trình, nhìn mã tiến trình, rồi phân biệt phần nào được dùng chung và phần nào thuộc riêng từng lần chạy.' },
      { title: 'Hai request có đụng nhau không?', detail: 'Theo từng dòng code qua một lần await.', speech: 'Sau đó, hai request có thể đụng nhau như thế nào dù JavaScript thường chạy trên một main thread? Mình sẽ đi từng dòng qua một lần chờ, thay vì chỉ nói chung rằng trạng thái dùng chung là nguy hiểm.' },
      { title: 'Chờ nhiều có cần nhiều thread?', detail: 'CPU, event loop, socket và hàng đợi.', speech: 'Kế tiếp, khi hàng nghìn kết nối đang chờ, ai theo dõi chúng? Từ đó ta mới cần đến event loop, cơ chế theo dõi I/O và cách tính số request còn nằm trong hệ thống.' },
      { title: 'Sửa gì trước trong production?', detail: 'Đọc latency, pool, CPU và bộ nhớ cùng nhau.', speech: 'Cuối cùng, mình ghép các mảnh lại để xử lý sự cố. Mỗi chặng có một câu hỏi áp dụng. Hãy thử đoán kết quả trước khi xem lời giải, vì đoán sai ở đây giúp mình thấy chính xác chỗ mô hình tư duy còn thiếu.' }
    ],
    takeaway: 'Quan sát → dự đoán → lần theo cơ chế → kiểm chứng → rút quy tắc.',
    conclusion: 'Ta bắt đầu với thao tác quen thuộc nhất, gõ lệnh chạy ứng dụng. Chưa cần biết epoll hay V8 hoạt động chi tiết ra sao. Trước tiên, hãy xác định ai đang sở hữu socket và dữ liệu của server.'
  }),
  sections: [
    {
      id: 'process-model', title: 'Chạy server thực sự tạo ra những gì?', durationMinutes: 11,
      objective: 'Từ hai lần chạy cùng một file, phân biệt program, process, thread và tài nguyên của từng process.',
      slides: [
        teach({
          id: 'program-to-process', title: 'Cùng một file, hai lần chạy khác nhau',
          subtitle: 'Bắt đầu bằng một thí nghiệm có thể tự làm trong terminal',
          lead: 'Program là bản mã lưu trên đĩa; process là một lần chạy của bản mã đó.',
          intro: 'Mình có file server.mjs đã được viết xong. Khi file còn nằm trên đĩa, nó chưa nhận request và chưa giữ một kết nối database nào. Hãy mở hai terminal và chạy lần lượt hai câu lệnh trên bảng. Hai cổng khác nhau giúp cả hai lần chạy cùng tồn tại mà không tranh một cổng lắng nghe.',
          exhibit: { label: 'server.mjs · Node.js built-in HTTP', language: 'javascript', code: "import { createServer } from 'node:http';\nconst port = Number(process.env.PORT ?? 3000);\ncreateServer((_req, res) => {\n  res.end(`PID=${process.pid}`);\n}).listen(port);\n\n// Terminal A: PORT=3000 node server.mjs\n// Terminal B: PORT=3001 node server.mjs\n// curl localhost:3000 ; curl localhost:3001" },
          steps: [
            { title: 'Một program', detail: 'Hai lệnh đều đọc cùng file server.mjs.', lines: [1, 2], speech: 'Dòng đầu lấy bộ tạo HTTP server có sẵn trong Node.js. Dòng hai đọc cổng từ biến môi trường. Cả hai terminal vẫn dùng cùng nội dung file. Ta gọi bản mã tĩnh này là chương trình, hay program. Đến đây chưa có lý do gì để cho rằng hai lần chạy phải dùng chung một object trong RAM.' },
            { title: 'Hai process', detail: 'Mỗi lần chạy có PID và trạng thái riêng.', lines: [3, 4, 5], speech: 'Khi thực thi lệnh, hệ điều hành tạo tiến trình, hay process. Gửi request tới mỗi cổng, mình sẽ thấy hai mã PID khác nhau. Mỗi process có ngữ cảnh tài nguyên của riêng nó. Nếu process A tạo một object mới, điều đó không tự tạo object tương ứng trong process B. Dùng chung file trên đĩa không có nghĩa dùng chung heap.' },
            { title: 'Kiểm chứng ranh giới', detail: 'Dừng A rồi gọi lại cả hai cổng.', lines: [7, 8, 9], speech: 'Bây giờ dừng terminal A bằng tổ hợp Control C. Cổng ba nghìn không còn được server A phục vụ, trong khi cổng ba nghìn lẻ một vẫn trả lời. Đây là bằng chứng đơn giản cho hai vòng đời khác nhau. Nếu thấy lỗi cổng đã được sử dụng khi chạy cùng cổng, đó là tranh tài nguyên lắng nghe, không phải hai lệnh đã nhập thành một process.' }
          ],
          takeaway: 'Một artefact có thể được chạy thành nhiều process; điều tra lần chạy bằng PID và cổng.',
          conclusion: 'Khi vận hành, mình phải hỏi bản mã nào đang được chạy và process nào đang nhận request. Deploy file mới và khởi động lại process là hai thao tác liên quan nhưng không đồng nhất. Tiếp theo, ta nhìn vào bên trong một process.'
        }),
        teach({
          id: 'process-and-thread', title: 'Một nơi giữ tài nguyên, một nơi thực thi lệnh',
          subtitle: 'Tách câu hỏi “dữ liệu ở đâu?” khỏi “ai đang chạy?”',
          lead: 'Process cung cấp ranh giới tài nguyên; thread mang ngữ cảnh thực thi được bộ lập lịch quản lý.',
          intro: 'Trong ví dụ hai terminal, mỗi process giống một lần mở xưởng làm việc độc lập. Nhưng hình ảnh cái xưởng chưa giải thích ai đang thực hiện từng lệnh. Ta cần thêm khái niệm luồng thực thi, hay thread. Phép ví von chỉ để phân biệt vai trò, không thay thế mô hình bộ nhớ thật.',
          exhibit: { label: 'Bên trong process A', rows: [{ label: 'Dùng chung trong process', value: 'không gian địa chỉ, tài nguyên' }, { label: 'Mỗi OS thread', value: 'registers + stack' }, { label: 'JavaScript ứng dụng thông thường', value: 'main thread của một isolate' }, { label: 'Node.js còn có', value: 'thread nền, worker pool' }] },
          steps: [
            { title: 'Process giữ ranh giới', detail: 'Các thread cùng process có thể truy cập vùng nhớ chung.', speech: 'Process có không gian địa chỉ ảo và các tham chiếu tới tài nguyên hệ điều hành. Trong mô hình thread thông thường, những thread cùng process nhìn vào cùng không gian địa chỉ. Vì vậy, khi một thread sửa vùng nhớ chia sẻ, thread khác có thể quan sát thay đổi nếu truy cập và đồng bộ đúng. Hai process khác nhau không tự có quyền như vậy.' },
            { title: 'Thread giữ vị trí đang chạy', detail: 'Thanh ghi và stack cho biết đang thực thi tới đâu.', speech: 'Mỗi thread có trạng thái thanh ghi và stack riêng. Khi bộ lập lịch đổi thread đang chạy trên lõi CPU, nó phải bảo toàn ngữ cảnh để sau đó tiếp tục đúng chỗ. Nhiều thread không đồng nghĩa tất cả luôn chạy đồng thời. Số lõi, tải hệ thống và chính sách lập lịch quyết định điều gì thực sự diễn ra.' },
            { title: 'Đọc đúng câu “Node đơn luồng”', detail: 'Một main thread chạy JS không có nghĩa process chỉ có một thread.', speech: 'Khi nói Node.js đơn luồng, thường ta đang nói phần JavaScript ứng dụng trên một isolate. Cả process vẫn có thread phục vụ runtime và một số công việc nền. Worker Threads còn tạo isolate JavaScript riêng. Chúng không tự chia sẻ các object JavaScript thông thường; muốn chia sẻ dữ liệu phải dùng cơ chế như truyền thông điệp hoặc SharedArrayBuffer. Đừng suy từ bộ nhớ process sang việc mọi object đều dùng chung giữa các worker.' }
          ],
          takeaway: 'Nhìn process để hỏi về ownership; nhìn thread và isolate để hỏi về thực thi và chia sẻ dữ liệu.',
          conclusion: 'Trong bài này, hai request đặt lịch chủ yếu chạy trên cùng main thread và cùng service của một ứng dụng NestJS. Mình sẽ tập trung vào trường hợp đó trước, thay vì đưa thêm nhiều worker vào khi chưa có nhu cầu.'
        }),
        teach({
          id: 'thread-context', title: 'Hai request, cùng một object service',
          subtitle: 'Mô hình cần dùng để hiểu lỗi ở phần tiếp theo',
          lead: 'Request mới không có nghĩa là service singleton được tạo mới.',
          intro: 'Giả sử NestJS đã khởi tạo một AppointmentService. Hai người dùng gửi hai request liên tiếp tới controller. Mỗi lần gọi phương thức tạo một ngữ cảnh gọi riêng, nhưng cả hai vẫn có thể gọi lên đúng một object service đã được khởi tạo từ trước.',
          exhibit: { label: 'Hai lần gọi lên cùng service', language: 'typescript', code: "class AppointmentService {\n  lastTenant = '';\n  list(tenantId: string) {\n    const requestedTenant = tenantId;\n    this.lastTenant = tenantId;\n    return requestedTenant;\n  }\n}\nconst service = new AppointmentService();\nservice.list('saigon');\nservice.list('hanoi');" },
          steps: [
            { title: 'Tham số thuộc lần gọi', detail: 'tenantId được nhận riêng cho mỗi invocation.', lines: [3, 4], speech: 'Nhìn vào tham số tenantId và biến requestedTenant. Lần gọi của Sài Gòn nhận giá trị Sài Gòn; lần gọi của Hà Nội nhận giá trị Hà Nội. Ta có thể truyền ngữ cảnh nghiệp vụ như vậy mà không ghi nó lên object service. Đây là ranh giới dễ nhìn thấy ngay trên chữ ký hàm.' },
            { title: 'Thuộc tính thuộc object', detail: 'this.lastTenant chỉ có một vị trí trên service đang dùng.', lines: [2, 5, 9], speech: 'Ngược lại, lastTenant là thuộc tính của object được tạo ở dòng chín. Hai lần gọi cùng ghi vào một vị trí đó. Sau hai lần gọi, giá trị cuối cùng là Hà Nội. Trong đoạn đồng bộ ngắn này chưa có dữ liệu trả sai, nhưng mình đã xác định được nơi có thể bị ghi đè khi những lần gọi chạy xen kẽ.' },
            { title: 'Đừng suy vị trí vật lý từ cú pháp', detail: 'Vòng đời của biến quan trọng hơn hình dung “mọi biến cục bộ đều ở stack”.', speech: 'Mình dùng khái niệm phạm vi lần gọi để giải thích ownership, không khẳng định mọi biến JavaScript đều nằm vật lý trên stack. Closure và hàm async có thể giữ dữ liệu sống trên heap. Điểm cần giữ ở đây là hai tham số độc lập không tự biến thành một thuộc tính dùng chung.' }
          ],
          takeaway: 'Phân biệt dữ liệu của lần gọi với dữ liệu của object sống qua nhiều lần gọi.',
          conclusion: 'Ở phần tiếp theo, mình chỉ cần thêm một lần await để biến rủi ro ghi đè vừa thấy thành một bug có thể tái hiện được. Trước đó, ta hoàn thiện ranh giới giữa hai process.'
        }),
        teach({
          id: 'virtual-address-space', title: 'Vì sao cùng một địa chỉ chưa chắc cùng dữ liệu?',
          subtitle: 'Giải thích địa chỉ ảo từ một phép so sánh cụ thể',
          lead: 'Một địa chỉ chỉ có nghĩa trong ngữ cảnh ánh xạ của process đang dùng nó.',
          intro: 'Hãy nghĩ tới số phòng hai không một. Hai toà nhà đều có thể có phòng mang số đó, nhưng không phải cùng một căn phòng. Tương tự, một giá trị địa chỉ trong process A và một giá trị giống hệt trong process B chưa đủ để kết luận chúng trỏ tới cùng dữ liệu vật lý.',
          exhibit: { label: 'Mô hình giản lược · không phải địa chỉ lấy từ máy thật', rows: [{ label: 'Process A · địa chỉ ảo 0x1000', value: 'ánh xạ → trang vật lý X' }, { label: 'Process B · địa chỉ ảo 0x1000', value: 'ánh xạ → trang vật lý Y' }, { label: 'Page table', value: 'mô tả ánh xạ' }, { label: 'MMU', value: 'dịch địa chỉ khi truy cập' }] },
          steps: [
            { title: 'Địa chỉ ứng dụng thấy là địa chỉ ảo', detail: 'Không đọc một con trỏ như số thứ tự trực tiếp của ô RAM.', speech: 'Ứng dụng thông thường sử dụng địa chỉ ảo. Hệ điều hành thiết lập ánh xạ, còn phần cứng quản lý bộ nhớ, gọi là MMU, tham gia dịch địa chỉ khi truy cập. Cùng một con số có thể ánh xạ tới hai trang vật lý khác nhau trong hai process.' },
            { title: 'Ánh xạ có quyền truy cập', detail: 'Cô lập còn dựa trên quyền đọc, ghi, thực thi.', speech: 'Ánh xạ không chỉ nói dữ liệu ở đâu. Nó còn có quyền truy cập, chẳng hạn trang được đọc nhưng không được ghi. Nhờ vậy, một process không được tuỳ ý đọc hoặc sửa dữ liệu của process khác chỉ bằng cách đoán địa chỉ. Chia sẻ bộ nhớ giữa process cần cơ chế được thiết lập rõ.' },
            { title: 'Bộ nhớ ảo không bằng RAM đang dùng', detail: 'Reserve địa chỉ chưa chắc đã có đủ trang resident.', speech: 'Một vùng địa chỉ được dành trước không có nghĩa toàn bộ dung lượng đó đã nằm trong RAM. Một số trang được cấp theo nhu cầu; một số trang đọc có thể được chia sẻ. Vì thế, số bộ nhớ ảo lớn không tự chứng minh máy đang dùng từng ấy RAM. Điều này sẽ giúp ta tránh đọc sai chỉ số RSS ở cuối bài.' }
          ],
          takeaway: 'Tách ba thứ: địa chỉ ảo, ánh xạ và các trang thực sự resident trong RAM.',
          conclusion: 'Mình chưa cần đi sâu vào cấu trúc từng cấp page table. Ta chỉ cần đủ mô hình để hiểu vì sao hai process có vùng riêng và vì sao một chỉ số bộ nhớ không thể kể hết mọi thứ.'
        }),
        teach({
          id: 'file-descriptor-ownership', title: 'Một kết nối đang mở nằm ở đâu?',
          subtitle: 'Nối lại từ process tới request đặt lịch',
          lead: 'Ứng dụng giữ handle tới socket; kernel giữ trạng thái của kết nối.',
          intro: 'Khi trình duyệt kết nối tới API, mình thường chỉ nhìn thấy một object request trong code. Nhưng bên dưới còn có socket và trạng thái mạng do kernel quản lý. Trên hệ điều hành kiểu Unix, process thao tác với nhiều tài nguyên thông qua mô tả tập tin, gọi là file descriptor, hay FD.',
          exhibit: { label: 'Ví dụ quan sát trên Linux · số FD chỉ là minh hoạ', code: '$ ls -l /proc/1234/fd\n0 -> /dev/null\n1 -> pipe:[...]\n7 -> socket:[...]\n8 -> socket:[...]\n\n# PID 1234 phải là process cần điều tra' },
          steps: [
            { title: 'FD là một số tra cứu', detail: 'Số 7 có nghĩa trong bảng FD của process đó.', speech: 'FD là số nguyên dùng để tra một mục trong bảng tài nguyên của process. Số bảy ở process A không nhất thiết là cùng tài nguyên với số bảy ở process B. Kernel dùng mục được tra để biết mình muốn thao tác với socket hay tập tin nào.' },
            { title: 'Kết nối chờ vẫn tốn tài nguyên', detail: 'Socket, buffer và metadata vẫn có vòng đời.', speech: 'Một socket không có dữ liệu mới vẫn có thể cần bộ nhớ, buffer và các cấu trúc quản lý. Chờ không tốn CPU chạy code liên tục, nhưng không miễn phí. Đây là lý do giữ nhiều kết nối có thể chạm giới hạn FD hoặc bộ nhớ trước khi CPU lên cao.' },
            { title: 'Công cụ phụ thuộc môi trường', detail: '/proc là ví dụ Linux; macOS có công cụ khác.', speech: 'Lệnh trên dùng hệ thống tập tin proc của Linux và cần quyền đọc phù hợp. Nếu đang dùng macOS, mình có thể quan sát process và socket bằng công cụ khác như lsof. Đừng sao chép lệnh rồi coi việc không có thư mục proc là lỗi của Node.js. Ta đang học loại bằng chứng cần tìm, không học thuộc một đường dẫn.' }
          ],
          takeaway: 'Process sống lâu sẽ giữ tài nguyên sống lâu; phải đóng và giới hạn chúng theo đúng vòng đời.',
          conclusion: 'Đến đây, mình đã xác định được nơi dữ liệu và socket tồn tại. Bây giờ quay về AppointmentService để xem hai request trong cùng process có thể làm sai dữ liệu ra sao.'
        })
      ],
      check: { id: 'c1-l1-live-process-q1', question: 'Hai lần chạy cùng server.mjs trên hai cổng có PID khác nhau. Điều gì hợp lý nhất?', options: ['Dùng chung file không khiến heap hai process tự dùng chung.', 'Cùng file nên thay object ở A sẽ tự thay object ở B.', 'Khác cổng khiến mọi request có một OS thread riêng.', 'Cùng runtime nên hai PID thực chất là một process.'], correctIndex: 0, explanation: 'Program là artefact tĩnh, còn mỗi process là một lần thực thi với ranh giới tài nguyên riêng. Muốn chia sẻ dữ liệu giữa hai process phải có cơ chế rõ ràng, không thể suy từ việc dùng chung file.' },
      explanation: 'Dùng PID xác định lần chạy; phân biệt trạng thái của request, object service và tài nguyên của process.'
    },
    {
      id: 'long-running-state', title: 'Theo hai request để tìm lỗi lẫn dữ liệu', durationMinutes: 13,
      objective: 'Tự truy vết lỗi tenant trên singleton, sửa bằng tham số và kiểm chứng bằng thứ tự thực thi có kiểm soát.',
      slides: [
        teach({
          id: 'server-lifetime', title: 'Sau request đầu tiên, service vẫn còn đó', subtitle: 'Một app khởi động một lần và phục vụ nhiều lần gọi',
          lead: 'Trong NestJS, provider mặc định là singleton của application context.',
          intro: 'Một lần đặt lịch kết thúc không có nghĩa ứng dụng bị xoá rồi khởi động lại từ đầu. Server thường tiếp tục lắng nghe request kế tiếp. Trong NestJS, provider mặc định được tạo và tái sử dụng trong vòng đời application context. Đây là điều ta muốn với những dependency tốn công khởi tạo.',
          exhibit: { label: 'So sánh vòng đời', rows: [{ label: 'Application context', value: 'khởi tạo → phục vụ → shutdown' }, { label: 'AppointmentService mặc định', value: 'tái sử dụng qua nhiều request' }, { label: 'Request A', value: 'bắt đầu → trả lời → kết thúc' }, { label: 'Request B', value: 'bắt đầu → trả lời → kết thúc' }] },
          steps: [
            { title: 'Chia sẻ dependency là hữu ích', detail: 'Ví dụ database pool và cấu hình bất biến.', speech: 'Nếu mỗi request tự mở một pool database mới, chi phí kết nối và số kết nối có thể tăng rất nhanh. Một pool có thiết kế quản lý truy cập rõ ràng có thể được dùng chung. Cấu hình chỉ đọc cũng có thể dùng chung. Vì thế, singleton tự nó không phải một lỗi thiết kế.' },
            { title: 'Dữ liệu người dùng có vòng đời khác', detail: 'tenantId thuộc request đang được xác thực.', speech: 'Nhưng phòng khám của người đang gọi là ngữ cảnh của request đó. Ghi nó lên một thuộc tính currentTenant của singleton có nghĩa mình đang dùng một ô nhớ chung để biểu diễn nhiều người. Tên biến có chữ current không tạo ra sự cô lập nào.' },
            { title: 'Đặt câu hỏi ownership', detail: 'Ai sở hữu dữ liệu, và nó phải sống tới khi nào?', speech: 'Mỗi khi thêm thuộc tính vào service, hãy hỏi dữ liệu này thuộc về hạ tầng dùng chung hay một lần gọi cụ thể. Nếu câu trả lời là một người dùng, một lượt tính tiền hoặc một request, cần có ranh giới phù hợp. Phần tiếp theo sẽ cho thấy hậu quả bằng bốn mốc rất cụ thể.' }
          ], takeaway: 'Chia sẻ dependency dài hạn; giữ ngữ cảnh từng request riêng.',
          conclusion: 'Đừng sửa bằng cách cấm mọi singleton. Ta chỉ cần bỏ phần trạng thái có ownership không phù hợp ra khỏi object dùng chung.'
        }),
        teach({
          id: 'data-bleed-trace', title: 'Dự đoán: request Sài Gòn sẽ đọc tenant nào?', subtitle: 'Dừng suy đoán ở từng dòng code và ghi lại trạng thái',
          lead: 'A đang chờ audit; B có thể chạy và ghi đè cùng thuộc tính.',
          intro: 'Nhìn đoạn code ngắn trên bảng. Mình có một service singleton và một hàm list. Trước khi nghe lời giải, hãy thử đoán điều gì xảy ra nếu request Sài Gòn chờ audit lâu hơn request Hà Nội. Audit ở đây chỉ là một lời gọi I/O bất đồng bộ để tạo điểm chờ trong ví dụ.',
          exhibit: { label: 'appointments.service.ts · thiết kế sai', language: 'typescript', code: "private currentTenant = '';\n\nasync list(tenantId: string) {\n  this.currentTenant = tenantId;\n  await this.audit.record(tenantId);\n  return this.repo.find(this.currentTenant);\n}" },
          steps: [
            { title: 'A ghi saigon rồi chờ', detail: 'Thuộc tính chung hiện mang giá trị saigon.', lines: [4, 5], speech: 'Request A nhận saigon ở tham số. Dòng bốn ghi nó lên thuộc tính currentTenant. Dòng năm chờ audit trả kết quả. Với Promise chưa hoàn tất, hàm tạm dừng phần tiếp theo và trả quyền điều khiển về runtime. Điều đó không khoá service và cũng không tạo bản sao của thuộc tính.' },
            { title: 'B ghi hanoi trong lúc A chờ', detail: 'Cùng object, cùng thuộc tính, giá trị mới.', lines: [1, 4], speech: 'Trong lúc A chờ, runtime có thể xử lý request B. B nhận hanoi rồi cũng chạy dòng bốn trên đúng object service ấy. Giá trị currentTenant bây giờ là hanoi. A vẫn giữ tham số riêng là saigon, nhưng code của mình lại không dùng tham số đó ở dòng truy vấn.' },
            { title: 'A tiếp tục và đọc hanoi', detail: 'Bug nằm ở lần đọc trạng thái chung sau await.', lines: [6], speech: 'Khi audit của A xong, A chạy tiếp dòng sáu. Nó đọc thuộc tính tại thời điểm hiện tại, nên có thể lấy hanoi và truy vấn nhầm phòng khám. Không cần hai dòng JavaScript chạy song song mới có lỗi. Chỉ cần hai luồng công việc xen kẽ ở điểm chờ là đủ.' }
          ], takeaway: 'await không cô lập trạng thái; luôn kiểm tra thứ được đọc lại sau điểm chờ.',
          conclusion: 'Bây giờ mình giải thích được chính xác ai ghi gì và lúc nào. Câu “Node.js chỉ có một main thread nên không có race” đã bỏ qua sự xen kẽ của các tác vụ bất đồng bộ.'
        }),
        teach({
          id: 'stateless-repair', title: 'Sửa bằng cách giữ đúng dữ liệu của lần gọi', subtitle: 'Thay một dependency ngầm bằng tham số tường minh',
          lead: 'A cần dùng tenantId của A, không đọc một thuộc tính “hiện tại” của service.',
          intro: 'Ta không cần đổi cả kiến trúc ứng dụng để sửa ví dụ vừa rồi. Trước hết, bỏ thuộc tính currentTenant và dùng tham số tenantId xuyên suốt lời gọi. Mình giữ audit và repository là dependency dùng chung, còn dữ liệu của request được truyền tường minh.',
          exhibit: { label: 'appointments.service.ts · sửa ownership', language: 'typescript', code: "async list(tenantId: string) {\n  await this.audit.record(tenantId);\n  return this.repo.find(tenantId);\n}\n\n// tenantId phải lấy từ context đã xác thực.\n// Truy vấn vẫn phải lọc tenant ở repository." },
          steps: [
            { title: 'Tham số tồn tại qua await', detail: 'Ngữ cảnh async giữ giá trị của lần gọi đang tiếp tục.', lines: [1, 2, 3], speech: 'A nhận saigon và giữ ngữ cảnh của lần gọi đó qua điểm await. B nhận hanoi trong một lần gọi khác. Khi A tiếp tục, nó truyền saigon xuống repository. Việc B chạy xen không tự thay giá trị tham số của A. Đây là điều ta có thể nhìn rõ ngay từ code.' },
            { title: 'Truyền đúng chưa đủ để phân quyền', detail: 'Nguồn tenant phải được xác thực và câu truy vấn phải dùng nó.', lines: [6, 7], speech: 'Tuy nhiên, không được lấy một tenant bất kỳ từ body rồi tin rằng đã an toàn. Controller hoặc guard phải xác định quyền truy cập phù hợp. Repository cũng phải đưa tenant vào điều kiện truy vấn. Bản sửa trên giải quyết lỗi giữ trạng thái chung, không thay thế toàn bộ kiểm tra phân quyền.' },
            { title: 'Vẫn giữ dependency dùng chung', detail: 'Không cần tạo lại pool chỉ để tách dữ liệu người dùng.', speech: 'Audit client và repository có thể tiếp tục là dependency singleton nếu thiết kế của chúng phù hợp. Mình không phải tạo một database pool cho mỗi request. Ta đã tách hai vòng đời, thay vì dùng một cấu hình scope để che mờ vấn đề ownership.' }
          ], takeaway: 'Một hàm nhận rõ context sẽ dễ kiểm tra hơn một hàm đọc trạng thái dùng chung ngầm.',
          conclusion: 'Bước tiếp theo là chứng minh bản sửa bằng kiểm thử có thứ tự xen kẽ rõ ràng. Chạy hai request ngẫu nhiên rồi thấy chưa lỗi chưa phải bằng chứng chắc chắn.'
        }),
        teach({
          id: 'data-bleed-test', title: 'Một test phải buộc lỗi có cơ hội xảy ra', subtitle: 'Điều khiển điểm chờ thay vì trông vào may rủi thời gian',
          lead: 'Cho A dừng đúng trước lần đọc, cho B ghi đè, rồi mới cho A tiếp tục.',
          intro: 'Nếu chỉ gửi hai request đồng thời, tốc độ máy và database có thể khiến bug lúc xuất hiện lúc không. Một phép thử tốt cần điều khiển được điểm chờ. Trên bảng là lịch thực thi của test, không phải mốc thời gian đo được từ production.',
          exhibit: { label: 'Lịch kiểm thử có kiểm soát', rows: [{ label: 'Bước 1', value: 'A vào audit → giữ Promise chưa resolve' }, { label: 'Bước 2', value: 'B vào service với tenant hanoi' }, { label: 'Bước 3', value: 'Resolve audit của A' }, { label: 'Kỳ vọng', value: 'A truy vấn saigon; B truy vấn hanoi' }] },
          steps: [
            { title: 'Giữ một Promise làm cổng', detail: 'Fake audit cho test quyền cho A tiếp tục.', speech: 'Trong test, fake audit trả một Promise chưa được resolve cho request A. Test giữ hàm resolve. Như vậy mình biết chắc A đã ghi trạng thái và đang chờ, thay vì đoán bằng cách sleep vài mili giây.' },
            { title: 'Cho B chạy trong khoảng trống', detail: 'Tái hiện đúng điều kiện ghi đè thuộc tính.', speech: 'Sau khi xác nhận A tới điểm chờ, test cho B gọi service với hanoi. Với code sai, B đã thay giá trị thuộc tính chung. Với code đúng, B chỉ có ngữ cảnh riêng. Hai phiên bản khác nhau ở ownership, không khác ở số thread.' },
            { title: 'Mở cổng và kiểm tra đầu vào repository', detail: 'Quan sát dữ liệu được truyền, không chỉ HTTP status.', speech: 'Cuối cùng, resolve Promise của A và kiểm tra repository đã nhận tenant nào. Nếu chỉ kiểm tra status hai trăm, test vẫn có thể pass dù dữ liệu trả sai phòng khám. Kỳ vọng phải gắn với invariant nghiệp vụ, tức mỗi request chỉ truy vấn tenant đã được xác thực của chính nó.' }
          ], takeaway: 'Test concurrency nên kiểm soát thứ tự xen kẽ và kiểm tra dữ liệu tại ranh giới gây lỗi.',
          conclusion: 'Đó là cách biến một mô tả “thỉnh thoảng bị lẫn” thành một test có thể lặp lại. Mình không cần tải lớn để bắt đầu chứng minh nguyên nhân.'
        }),
        teach({
          id: 'async-request-context', title: 'Khi nào cần request scope hoặc async context?', subtitle: 'Chọn công cụ sau khi đã hiểu dữ liệu thuộc về ai',
          lead: 'Tham số là mặc định rõ ràng; scope và async context giải những nhu cầu khác.',
          intro: 'Sau ví dụ vừa rồi, có thể nảy ra câu hỏi liệu cứ đổi toàn bộ service sang request scope có nhanh hơn không. Cách đó có chỗ dùng, nhưng trước hết mình phân biệt ba lựa chọn và mục đích của từng lựa chọn.',
          exhibit: { label: 'Chọn theo nhu cầu', rows: [{ label: 'Dữ liệu nghiệp vụ của một lời gọi', value: 'truyền tham số' }, { label: 'Instance cần vòng đời theo request', value: 'request-scoped provider' }, { label: 'traceId xuyên chuỗi async', value: 'AsyncLocalStorage có kiểm chứng' }] },
          steps: [
            { title: 'Ưu tiên chữ ký hàm dễ đọc', detail: 'list(tenantId) bộc lộ dependency nghiệp vụ.', speech: 'Nếu service chỉ cần tenant để truy vấn, truyền tham số thường đơn giản nhất. Test cấp tenant giả mà không phải dựng cả request context. Người đọc biết hàm cần gì ngay từ chữ ký, thay vì phải tìm một biến môi trường ngầm.' },
            { title: 'Request scope có chi phí và sự lan truyền', detail: 'Dependency graph có thể phải tạo instance theo từng request.', speech: 'Request scope phù hợp khi bản thân instance cần gắn với một request. Nhưng nó làm thay đổi vòng đời và có thể kéo các consumer sang vòng đời đó. Việc tạo và phân giải dependency theo request có chi phí. Không nên chọn nó chỉ để giữ một chuỗi tenantId mà tham số đã giải quyết tốt.' },
            { title: 'Async context dùng có chủ đích', detail: 'Khởi tạo tại boundary, kiểm tra thư viện có giữ context.', speech: 'AsyncLocalStorage của Node.js hữu ích cho metadata như traceId xuyên nhiều tầng. Mình cần khởi tạo context ở ranh giới request và kiểm tra các tích hợp callback có bảo toàn context. Đây không phải lý do để nhét mọi trạng thái mutable vào một chỗ “global nhưng có vẻ an toàn”.' }
          ], takeaway: 'Chọn công cụ theo ownership, lifetime và khả năng kiểm thử; không chọn theo tên nghe tiện.',
          conclusion: 'Ta đã hiểu vì sao hai request có thể xen vào nhau. Giờ mình hỏi điều kiện nào giúp request khác có cơ hội được chạy, và điều gì xảy ra khi main thread không trả quyền.'
        })
      ],
      check: { id: 'c1-l1-live-process-q2', question: 'A chờ audit, B ghi hanoi, rồi A đọc this.currentTenant. Bản sửa trực tiếp nhất là gì?', options: ['Thêm async vào mọi phương thức của service.', 'Truyền tenant đã xác thực qua tham số tới repository.', 'Tăng số process nhưng giữ nguyên thuộc tính chung.', 'Tăng heap để A giữ thuộc tính lâu hơn B.'], correctIndex: 1, explanation: 'Bỏ dependency vào thuộc tính mutable giúp mỗi lần gọi tiếp tục dùng đúng context của nó sau await. Tăng tài nguyên hoặc thêm async không thay đổi ownership của thuộc tính dùng chung.' },
      explanation: 'Muốn sửa race qua await, hãy theo lần ghi và lần đọc trạng thái; dùng test điều khiển Promise để chứng minh.'
    },
    {
      id: 'event-loop', title: 'Vì sao chờ database khác với tính toán nặng?', durationMinutes: 14,
      objective: 'Phân biệt I/O wait với CPU work, dự đoán callback bị trì hoãn và chọn cách tách việc phù hợp.',
      slides: [
        teach({
          id: 'cooperative-runtime', title: 'Trong lúc A chờ, CPU của Node làm gì?', subtitle: 'Một quầy xử lý có thể nhận việc khác khi đang đợi kết quả',
          lead: 'I/O có thể còn đang diễn ra dù JavaScript của request đó chưa chạy tiếp.',
          intro: 'Mình trở lại lời gọi audit ở ví dụ cũ. Giả sử một dịch vụ mạng mất hai trăm mili giây mới trả lời. Main thread có phải dành đủ hai trăm mili giây chỉ để đứng nhìn request A không? Với I/O bất đồng bộ thông thường, câu trả lời là không.',
          exhibit: { label: 'Dòng thời gian giản lược · số liệu minh hoạ', rows: [{ label: '0–2 ms', value: 'A chuẩn bị và gửi I/O' }, { label: '2–200 ms', value: 'A chờ; main thread có thể xử lý B' }, { label: '200 ms', value: 'I/O của A đã sẵn sàng' }, { label: 'Lượt được thực thi', value: 'A tiếp tục đoạn sau await' }] },
          steps: [
            { title: 'Đăng ký việc rồi nhường quyền', detail: 'Chờ Promise chưa hoàn tất cho phép call stack hiện tại rút đi.', speech: 'A gửi yêu cầu qua API bất đồng bộ rồi gặp await với Promise chưa hoàn tất. Phần tiếp theo của hàm được giữ để chạy sau. Khi callback hiện tại kết thúc, runtime có thể xử lý công việc khác. Ví dụ người phục vụ nhận order rồi chuyển xuống bếp là cách hình dung sự chờ, nhưng kernel và runtime mới là cơ chế thực tế.' },
            { title: 'I/O không cần JS liên tục canh', detail: 'Network readiness thường do kernel theo dõi.', speech: 'Trong trường hợp socket mạng, kernel theo dõi trạng thái I/O và runtime nhận thông báo phù hợp. Không có một vòng JavaScript liên tục hỏi database đã xong chưa. Với một số API khác như thao tác filesystem hoặc crypto, Node còn dùng worker pool. Không được gộp tất cả bất đồng bộ thành “đều chạy trong thread pool”.' },
            { title: 'Sẵn sàng chưa chắc chạy ngay', detail: 'Callback vẫn đợi main thread có thể thực thi.', speech: 'Khi dữ liệu đã về, phần JavaScript tiếp tục của A vẫn phải được chạy trên main thread phù hợp. Nếu lúc đó main thread đang bận một vòng lặp dài, A chưa thể tiếp tục ngay. Vì vậy, thời gian request không chỉ là thời gian database trả lời.' }
          ], takeaway: 'I/O đang chờ và JavaScript đang chạy là hai trạng thái khác nhau.',
          conclusion: 'Điểm mạnh này cho phép một main thread phối hợp nhiều request chờ I/O. Nó không làm main thread chạy nhiều đoạn JavaScript đồng bộ cùng lúc.'
        }),
        teach({
          id: 'blocking-main-thread', title: 'Một vòng lặp làm chậm cả /health', subtitle: 'Thí nghiệm hai request để quan sát sự chặn',
          lead: 'Một handler giữ main thread lâu sẽ trì hoãn cả những handler rất nhẹ.',
          intro: 'Hãy thêm một nhánh slow vào HTTP server. Để minh hoạ sự chặn, mình cố ý dùng vòng lặp chờ bận nửa giây. Đây là code thí nghiệm, không phải cách tạo delay trong ứng dụng. Trong một terminal gọi slow, rồi terminal khác gọi health ngay sau đó.',
          exhibit: { label: 'Ví dụ chặn · chỉ chạy trong môi trường thử nghiệm', language: 'javascript', code: "if (req.url === '/slow') {\n  const until = performance.now() + 500;\n  while (performance.now() < until) {}\n}\nres.end('ok');\n\n// Terminal A: curl localhost:3000/slow\n// Terminal B: curl localhost:3000/health" },
          steps: [
            { title: 'Dòng while không trả quyền', detail: 'Main thread bận kiểm tra điều kiện tới khi hết thời gian.', lines: [2, 3], speech: 'Trong nửa giây này, main thread liên tục chạy vòng lặp. Nó không gặp một điểm chờ I/O để trả quyền cho runtime. Dù hệ điều hành vẫn có thể lập lịch những thread khác, main thread của ứng dụng chưa sẵn sàng chạy callback health.' },
            { title: 'Health nhẹ nhưng vẫn phải đợi', detail: 'Request đã đến không có nghĩa handler đã bắt đầu chạy.', lines: [5, 8], speech: 'Health chỉ cần trả một chuỗi ngắn, nhưng nó vẫn chia sẻ nơi thực thi JavaScript với slow. Độ trễ nhìn từ client gồm cả thời gian đợi tới lượt. Nếu health đến khi slow còn khoảng bốn trăm mili giây, nó có thể phải đợi xấp xỉ phần thời gian còn lại, cộng các chi phí khác.' },
            { title: 'Đo rồi thay một điều kiện', detail: 'Bỏ vòng lặp và so sánh lại trong cùng điều kiện tải.', speech: 'Mình đo latency trước, bỏ vòng lặp rồi đo lại. Đừng chạy thí nghiệm trên production hoặc kết luận chỉ từ một lần đo. Trong hệ thống thật, JSON lớn, regex xấu hoặc xử lý đồng bộ dài có thể đóng vai vòng lặp này mà nhìn qua code không rõ ràng bằng.' }
          ], takeaway: 'Handler nhẹ vẫn chậm nếu phải đợi một main thread bị chiếm lâu.',
          conclusion: 'Bây giờ ta thử một cách sửa rất thường gặp nhưng không có tác dụng, chỉ thêm từ async vào hàm tính toán.'
        }),
        teach({
          id: 'async-versus-parallel', title: 'Thêm async không chuyển vòng lặp sang lõi khác', subtitle: 'Thay hình thức trả kết quả không thay nơi thực thi',
          lead: 'async làm hàm trả Promise; phần tính toán đồng bộ vẫn chạy tại nơi được gọi.',
          intro: 'Nếu mình bọc hàm tính checksum bằng async rồi await nó, liệu health có hết chậm không? Hãy nhìn kỹ phần nào của code thực sự nhường quyền và phần nào vẫn đang dùng CPU.',
          exhibit: { label: 'Sai lầm thường gặp', language: 'typescript', code: "async function checksum(values: number[]) {\n  let sum = 0;\n  for (const value of values) sum += value;\n  return sum;\n}\nconst result = await checksum(largeArray);" },
          steps: [
            { title: 'Vòng lặp vẫn chạy đồng bộ', detail: 'Không có bước offload trong thân hàm.', lines: [1, 2, 3], speech: 'Khi gọi checksum, thân hàm bắt đầu chạy trên main thread của mình. Từ async không tạo thread mới. Vòng lặp vẫn phải chạy xong trước khi hàm trả kết quả. Một Promise bọc kết quả không chứng minh công việc đã được đưa sang worker.' },
            { title: 'Concurrency khác parallelism', detail: 'Xen kẽ công việc khác với thực thi thật trên nhiều lõi.', lines: [6], speech: 'Đồng thời, hay concurrency, là nhiều công việc có khoảng đời chồng lấp và được phối hợp. Song song, hay parallelism, là thực thi tại cùng thời điểm trên tài nguyên phù hợp. Chờ I/O giúp xen kẽ nhiều request, nhưng muốn tính toán nặng song song cần cơ chế thực thi khác.' },
            { title: 'Chọn theo workload', detail: 'Giảm việc, chia lô có yield, hoặc dùng worker pool có giới hạn.', speech: 'Nếu việc nhỏ, trước hết giảm lượng dữ liệu và thuật toán thừa. Nếu chia được thành lô, có thể trả quyền giữa các lô để cải thiện khả năng đáp ứng, nhưng tổng CPU vẫn phải được trả. Nếu thực sự cần tách tính toán, dùng một pool Worker Threads hoặc hệ thống job phù hợp. Tạo worker mới cho từng request có thể đưa thêm chi phí khởi tạo và truyền dữ liệu.' }
          ], takeaway: 'Muốn biết code có chặn hay không, đọc công việc thực tế chứ không chỉ đọc từ async.',
          conclusion: 'Ta đã tách được chạy code, chờ I/O và chạy song song. Còn một bẫy nhỏ là tưởng cứ await Promise đã resolve thì I/O khác sẽ được phục vụ ngay.'
        }),
        teach({
          id: 'microtask-starvation', title: 'Nhường cho microtask chưa chắc đã nhường cho I/O', subtitle: 'Hiểu đủ để tránh một cách chia lô sai',
          lead: 'Một chuỗi microtask liên tục có thể trì hoãn cơ hội xử lý I/O.',
          intro: 'Giả sử mình đã quyết định chia việc thành các lô. Sau mỗi lô, mình viết await Promise.resolve và nghĩ rằng event loop đã được nghỉ. Điểm cần kiểm tra là phần tiếp theo được đưa vào loại hàng đợi nào.',
          exhibit: { label: 'Ví dụ chia lô CPU · so sánh điểm yield', language: 'typescript', code: "// Chưa bảo đảm I/O có cơ hội được xử lý:\nawait Promise.resolve();\n\n// Yield qua một lượt lập lịch phù hợp trong Node:\nawait new Promise<void>((resolve) => {\n  setImmediate(resolve);\n});" },
          steps: [
            { title: 'Promise continuation dùng microtask', detail: 'Promise đã resolve vẫn không có nghĩa là poll I/O ngay.', lines: [1, 2], speech: 'Phần tiếp theo sau await được lập lịch theo cơ chế Promise. Nếu công việc liên tục tự nối dài microtask, runtime có thể mất rất lâu mới tới cơ hội xử lý các sự kiện I/O khác. Thêm nhiều await không tự tạo ra tính công bằng.' },
            { title: 'Yield phải có mục đích', detail: 'setImmediate có thể trả cơ hội cho các lượt xử lý khác.', lines: [4, 5, 6, 7], speech: 'Với tác vụ CPU chia được thành những lô nhỏ, setImmediate có thể giúp mình trả quyền qua lượt lập lịch khác. Nhưng không có một kích thước lô thần kỳ cho mọi máy. Phải đo độ trễ và tổng thời gian hoàn tất, rồi điều chỉnh theo yêu cầu của workload.' },
            { title: 'Không cần thuộc thứ tự mọi queue hôm nay', detail: 'Giữ invariant: mỗi lượt JS phải đủ ngắn.', speech: 'Các pha event loop và thứ tự nextTick với Promise sẽ được học sâu riêng. Ở đây, nguyên tắc cần giữ là không để một luồng công việc liên tục chiếm cơ hội của request khác. Việc chia lô cải thiện fairness, không biến công việc CPU thành miễn phí.' }
          ], takeaway: 'Đánh giá điểm yield bằng hành vi quan sát được của I/O, không bằng số lượng await.',
          conclusion: 'Trong vận hành, mình sẽ nối điều này với event-loop delay và CPU profile, thay vì cứ nhìn thấy async là loại trừ khả năng block.'
        })
      ],
      check: { id: 'c1-l1-live-process-q3', question: 'Hàm async có vòng lặp CPU 500 ms và không offload. /health trên cùng isolate bị ảnh hưởng thế nào?', options: ['Tự chạy song song vì hàm đã trả kiểu Promise.', 'Có thể chờ vì vòng lặp vẫn chiếm main thread.', 'Không bị ảnh hưởng vì /health không đọc database.', 'Tự được chuyển sang libuv worker pool.'], correctIndex: 1, explanation: 'async không di chuyển công việc đồng bộ sang thread khác. Một callback nhẹ vẫn bị trì hoãn nếu main thread đang chạy vòng lặp chưa kết thúc.' },
      explanation: 'Tách CPU time khỏi I/O wait; xác minh điểm nhường quyền và nơi công việc thực sự được thực thi.'
    },
    {
      id: 'hardware-latency', title: 'Tự tính số request đang chờ', durationMinutes: 10,
      objective: 'Đổi đúng đơn vị để dùng định luật Little, phân biệt số trung bình với percentile và kiểm tra queueing.',
      slides: [
        teach({
          id: 'latency-scale', title: 'Một request 200 ms có thể chỉ dùng vài ms CPU', subtitle: 'Nhìn timeline trước khi đọc phần trăm CPU',
          lead: 'Thời gian phản hồi là thời gian trôi qua, không chỉ thời gian CPU thực thi.',
          intro: 'Ta đo từ lúc API nhận request đến lúc trả xong mất hai trăm mili giây. Nếu kết luận CPU đã bận hai trăm mili giây thì mình có thể sửa sai tầng. Hãy tách một timeline giả định thành các phần dễ nhìn.',
          exhibit: { label: 'Một request minh hoạ · các chặng tuần tự', rows: [{ label: 'Validate và chuẩn bị', value: '2 ms CPU' }, { label: 'Chờ pool và database', value: '195 ms elapsed' }, { label: 'Xử lý kết quả và trả lời', value: '3 ms CPU' }, { label: 'Tổng', value: '200 ms elapsed' }] },
          steps: [
            { title: 'CPU time chỉ là một phần', detail: 'Trong ví dụ, phần JS cần khoảng 5 ms.', speech: 'Hai mili giây đầu và ba mili giây cuối là phần minh hoạ main thread thực thi. Phần giữa chủ yếu là chờ. Số liệu thật sẽ phức tạp hơn và có thể có xử lý song song, nhưng việc tách elapsed time với CPU time vẫn giữ nguyên giá trị.' },
            { title: 'Khoảng cách phần cứng giải thích vì sao chờ đáng kể', detail: 'Cache, RAM, storage và network có thang độ trễ khác nhau.', speech: 'CPU lấy dữ liệu từ cache nhanh hơn nhiều so với đi ra mạng. Dữ liệu càng xa nơi tính toán, giao thức và thiết bị trung gian càng có thể thêm thời gian. Không nên học một bảng nano giây như hằng số mọi máy, nhưng phải hiểu vì sao chờ database không thể được suy ra từ một phép cộng trên RAM.' },
            { title: 'CPU rảnh không có nghĩa request rảnh', detail: 'Request vẫn giữ context, buffer và vị trí trong hàng đợi.', speech: 'Dù CPU không bận trong lúc chờ, request vẫn tồn tại. Nó có thể giữ object, buffer, socket và timeout. Khi thời gian chờ tăng, rất nhiều request có thể cùng bị giữ lại, khiến bộ nhớ tăng ngay khi phần trăm CPU còn thấp.' }
          ], takeaway: 'CPU thấp vẫn có thể đi cùng latency và số request đang chờ rất cao.',
          conclusion: 'Ta sẽ định lượng phần “rất nhiều” bằng một phép tính đơn giản, nhưng phải đổi đơn vị đúng trước.'
        }),
        teach({
          id: 'little-law-worked-example', title: '1.000 request/giây × 0,2 giây bằng bao nhiêu?', subtitle: 'Một phép tính từng bước, dùng số trung bình cùng ranh giới',
          lead: 'Trong hệ thống ổn định, L = λ × W với cùng ranh giới đo.',
          intro: 'Mình đang đo ở ranh giới API, hệ thống nhận và hoàn tất trung bình một nghìn request mỗi giây. Thời gian từ nhận đến hoàn tất trung bình là hai trăm mili giây. Ta muốn biết trung bình có bao nhiêu request còn nằm trong API.',
          exhibit: { label: 'Định luật Little · ví dụ ổn định', rows: [{ label: 'λ · tốc độ trung bình', value: '1.000 request/s' }, { label: 'W · thời gian trung bình', value: '200 ms = 0,2 s' }, { label: 'L = λ × W', value: '1.000 × 0,2 = 200 request' }, { label: 'Nếu W tăng thành 2 s', value: 'L = 2.000 request' }] },
          steps: [
            { title: 'Đổi ms thành giây', detail: '200 / 1.000 = 0,2 giây.', speech: 'Trước hết đổi hai trăm mili giây thành không phẩy hai giây. Tốc độ đang tính theo request trên giây, nên thời gian cũng phải tính bằng giây. Nhân một nghìn với hai trăm mà quên đơn vị sẽ cho kết quả sai một nghìn lần.' },
            { title: 'Nhân và kiểm tra đơn vị', detail: 'request/s × s = request.', speech: 'Tiếp theo, một nghìn request mỗi giây nhân không phẩy hai giây bằng hai trăm request. Đơn vị giây triệt tiêu, còn đơn vị request. Đây là số đang nằm trong ranh giới hệ thống trung bình, không phải số thread, cũng không phải số socket TCP luôn bằng nó.' },
            { title: 'Thay một biến để dự đoán', detail: 'Giữ λ, tăng W mười lần thì L tăng mười lần.', speech: 'Giả sử dependency chậm khiến thời gian trung bình thành hai giây, còn tốc độ vẫn được duy trì trong trạng thái ổn định phù hợp. Kết quả thành hai nghìn request. Nếu mỗi request giữ thêm dữ liệu, memory pressure có thể tăng mạnh mà CPU chưa tăng tương ứng.' }
          ], takeaway: 'Little liên hệ tốc độ, thời gian lưu lại và số lượng trung bình; không dự đoán tất cả giới hạn sức chứa.',
          conclusion: 'Trong quá tải liên tục, đầu vào có thể vượt tốc độ hoàn tất và hàng đợi cứ tăng. Khi đó không được lấy một snapshot ngắn rồi giả vờ hệ thống đang ổn định. Cần đo thêm backlog và sự thay đổi theo thời gian.'
        }),
        teach({
          id: 'latency-waterfall', title: 'Đừng thay W trung bình bằng p95', subtitle: 'Hai câu hỏi thống kê khác nhau',
          lead: 'Little dùng trung bình; p95 nói về phần đuôi phân bố latency.',
          intro: 'Dashboard thường đặt p95 thật nổi bật, nên ta dễ lấy nó đưa thẳng vào phép tính vừa học. Nhưng p95 và trung bình không trả lời cùng một câu hỏi. Hãy giữ hai đại lượng tách biệt.',
          exhibit: { label: 'Cùng một tập request minh hoạ', rows: [{ label: 'Latency trung bình', value: '200 ms' }, { label: 'p95 latency', value: '900 ms' }, { label: 'L theo Little với λ = 1.000/s', value: '200 request trung bình' }, { label: 'Không được suy ra', value: 'L = 900 chỉ từ p95' }] },
          steps: [
            { title: 'Mean phục vụ phép tính trung bình', detail: 'W và λ phải đo cùng khoảng và cùng boundary.', speech: 'Định luật Little liên hệ các đại lượng trung bình. Mình phải chọn cùng khoảng đo và cùng phạm vi, chẳng hạn từ lúc API nhận đến lúc API hoàn tất. Đo throughput của toàn API rồi dùng thời gian riêng một query sẽ trộn hai ranh giới.' },
            { title: 'p95 phục vụ đọc trải nghiệm đuôi', detail: 'Khoảng 95% mẫu có latency không vượt mốc đó.', speech: 'p95 cho một ngưỡng percentile của tập mẫu, giúp thấy các request chậm ở phần đuôi. Nó không phải thời gian trung bình của mọi request. Khi p95 tăng mà mean ít thay đổi, có thể chỉ một nhóm request bị ảnh hưởng; cần phân nhóm theo endpoint, tenant hoặc dependency.' },
            { title: 'Không cộng percentile các chặng', detail: 'Tổng p95 từng span không tự bằng p95 toàn request.', speech: 'Tương tự, không cộng p95 của pool, database và serialize rồi gọi đó là p95 end-to-end. Các mẫu ở đuôi mỗi chặng có thể thuộc những request khác nhau. Muốn biết request nào chậm ở đâu, hãy xem trace và thời lượng các span của chính request đó.' }
          ], takeaway: 'Dùng mean để tính lượng công việc trung bình; dùng percentile và trace để điều tra phần đuôi.',
          conclusion: 'Một công thức chỉ hữu ích khi mình biết đại lượng đầu vào thực sự đo gì. Tiếp theo, ta quay lại nhiều kết nối để phân biệt thêm connection với request đang thực thi.'
        })
      ],
      check: { id: 'c1-l1-live-process-q4', question: 'API ổn định hoàn tất 500 request/s; mean latency là 400 ms. L trung bình bằng bao nhiêu?', options: ['1.250 request, vì phải chia tốc độ cho thời gian.', '200.000 request, vì thời gian đo bằng mili giây.', '200 request, vì 500 × 0,4 giây = 200.', 'Không thể tính nếu chưa biết số thread.'], correctIndex: 2, explanation: 'Đổi 400 ms thành 0,4 s rồi dùng L = λW với cùng ranh giới và khoảng đo. Kết quả là request trung bình trong hệ thống, không phải số connection hay thread.' },
      explanation: 'Kiểm tra đơn vị, dùng mean đúng ranh giới và không thay percentile vào một công thức dành cho trung bình.'
    },
    {
      id: 'c10k', title: 'Nhiều kết nối chờ không cần một thread cho từng kết nối', durationMinutes: 15,
      objective: 'Phân biệt connection với công việc sẵn sàng, giải thích interest/ready list và chỉ ra giới hạn epoll không giải quyết.',
      slides: [
        teach({
          id: 'thread-per-connection-cost', title: 'Một khách giữ kết nối không có nghĩa đang đặt lịch', subtitle: 'Phân biệt socket đang mở và request đang cần CPU',
          lead: '50.000 socket mở, chỉ 10 socket sẵn sàng đọc: hai con số mô tả hai việc khác nhau.',
          intro: 'Hãy mở rộng ứng dụng thành màn hình cập nhật lịch theo thời gian thực. Nhiều trình duyệt giữ kết nối lâu nhưng chỉ thỉnh thoảng có dữ liệu mới. Lúc này tổng kết nối đang mở khác xa số công việc JavaScript cần chạy ngay.',
          exhibit: { label: 'Snapshot minh hoạ · không phải benchmark', rows: [{ label: 'Socket đang mở', value: '50.000' }, { label: 'Socket vừa sẵn sàng đọc', value: '10' }, { label: 'Socket khác trong snapshot', value: '49.990' }, { label: 'Câu hỏi thiết kế', value: 'làm sao chờ mà không canh từng socket?' }] },
          steps: [
            { title: 'Connection là quan hệ còn tồn tại', detail: 'Nó có thể sống qua nhiều request hoặc thông điệp.', speech: 'Một connection TCP có thể tồn tại dù tại thời điểm này không có request mới cần chạy. Trong HTTP keep-alive, kết nối còn có thể được tái sử dụng. Vì thế, lấy số connection làm số request in-flight mà không hiểu giao thức sẽ dẫn tới phép tính sai.' },
            { title: 'Thread riêng có chi phí quản lý', detail: 'Stack ảo, trang thực dùng và ngữ cảnh lập lịch.', speech: 'Nếu mỗi connection có một OS thread chờ riêng, ta phải trả chi phí thread và tài nguyên liên quan. Ví dụ giả sử reserve một MiB stack cho mỗi thread, mười nghìn thread tương ứng khoảng chín phẩy tám GiB không gian stack ảo. Đó chưa phải kết luận rằng ngần ấy RAM đã resident. Kích thước và cách cấp stack phụ thuộc nền tảng.' },
            { title: 'Chỉ xử lý thứ đang cần xử lý', detail: 'Giữ đăng ký quan tâm, nhận những sự kiện sẵn sàng.', speech: 'Mình cần một cơ chế chờ chung và biết socket nào có thể thực hiện I/O. Đó là bài toán điều phối, không phải yêu cầu tạo ra một lõi CPU cho từng khách. Từ đây ta mới đưa vào khái niệm I/O multiplexing, hay ghép kênh theo dõi nhiều nguồn I/O.' }
          ], takeaway: 'Đếm connection, request in-flight và công việc ready riêng; chúng không thay thế nhau.',
          conclusion: 'Trên Linux, epoll là một cơ chế quan trọng hỗ trợ kiểu điều phối này. Mình sẽ giải thích nó bằng hai danh sách và ba thao tác.'
        }),
        teach({
          id: 'multiplexing', title: 'epoll: danh sách quan tâm và danh sách sẵn sàng', subtitle: 'Hai danh sách giúp hiểu việc kernel đang làm',
          lead: 'Đăng ký socket cần theo dõi khác với nhận các socket đã sẵn sàng.',
          intro: 'Nếu phải tự đi hỏi từng socket trong một tập lớn sau mỗi lượt chờ, ứng dụng dễ làm nhiều việc chỉ để phát hiện rằng đa số chưa có gì. epoll cho phép duy trì tập quan tâm trong kernel và nhận các sự kiện sẵn sàng. Mô hình trên bảng cố ý giản lược để nhìn rõ vai trò.',
          exhibit: { label: 'Linux epoll · mô hình khái niệm', code: 'epoll_create1(...)       // tạo instance\nepoll_ctl(..., ADD, fd)  // đăng ký quan tâm\nepoll_wait(...)         // đợi sự kiện ready\n\ninterest: [fd7, fd8, fd9, ...]\nready:    [fd8, fd42, ...]' },
          steps: [
            { title: 'Đăng ký quan tâm', detail: 'interest list chứa các FD cần theo dõi.', lines: [1, 2, 5], speech: 'Ứng dụng tạo một epoll instance rồi dùng epoll_ctl để thêm, sửa hoặc xoá đăng ký quan tâm. Kernel duy trì tập này. Không phải sau mỗi lượt đợi ứng dụng đều phải gửi lại toàn bộ danh sách theo cách poll nhận mảng FD.' },
            { title: 'Đợi các sự kiện ready', detail: 'epoll_wait có thể chặn thread gọi khi chưa có sự kiện.', lines: [3, 6], speech: 'Khi chưa có sự kiện phù hợp, lời gọi đợi có thể để thread gọi ngủ thay vì chạy vòng lặp bận. Khi có socket ready, kernel trả các sự kiện để runtime tiếp tục. Đây không phải JavaScript tự chạy một vòng for qua năm mươi nghìn socket liên tục.' },
            { title: 'Ready là khả năng thực hiện I/O', detail: 'Không đồng nghĩa đã có đủ một thông điệp ứng dụng.', speech: 'Một socket ready để đọc có thể chỉ có một phần dữ liệu, có thể báo EOF hoặc tình trạng lỗi phù hợp. Runtime vẫn phải đọc và parser vẫn phải ráp dữ liệu theo giao thức. epoll không tự biến một gói byte thành request HTTP hoàn chỉnh hay kết quả query.' }
          ], takeaway: 'epoll thông báo readiness; runtime vẫn chịu trách nhiệm đọc, parse và lập lịch xử lý.',
          conclusion: 'Ta dùng epoll để giải thích Linux. Trên macOS có cơ chế như kqueue, trên Windows có mô hình I/O khác. libuv cung cấp lớp trừu tượng, nên không được khẳng định Node.js trên mọi hệ điều hành đều gọi epoll.'
        }),
        teach({
          id: 'socket-event-trace', title: 'Theo một phản hồi database từ mạng tới await', subtitle: 'Mỗi tầng làm một việc khác nhau',
          lead: 'Kernel nhận byte không có nghĩa câu lệnh sau await đã chạy.',
          intro: 'Mình quay về request đặt lịch A đang đợi database. Giả sử không có lỗi mạng và truy vấn đã hoàn thành. Ta theo dữ liệu quay lại process qua ba mốc, để tránh gộp mọi thứ thành một câu “event loop chạy request”.',
          exhibit: { label: 'Đường trở về của một query · mô hình giản lược', rows: [{ label: 'Kernel', value: 'nhận dữ liệu → socket ready' }, { label: 'Runtime và driver', value: 'đọc byte → parse phản hồi' }, { label: 'Promise của lời gọi DB', value: 'được hoàn tất theo driver' }, { label: 'JavaScript tiếp tục', value: 'chạy khi có cơ hội được thực thi' }] },
          steps: [
            { title: 'Socket có dữ liệu', detail: 'Kernel theo dõi trạng thái tài nguyên mạng.', speech: 'Dữ liệu đến socket tạo điều kiện để I/O có thể tiến triển. Kernel và cơ chế thông báo hỗ trợ runtime biết việc đó. Tầng này không biết điều kiện phân quyền phòng khám của ứng dụng mình.' },
            { title: 'Driver hiểu giao thức', detail: 'Đọc và ráp dữ liệu thành kết quả có nghĩa.', speech: 'Runtime và thư viện database đọc dữ liệu rồi xử lý theo giao thức. Một phản hồi lớn có thể cần nhiều lần đọc. Chỉ khi đủ điều kiện hoàn thành mà API quy định, Promise hoặc callback của query mới được hoàn tất.' },
            { title: 'Continuation vẫn cần CPU', detail: 'Mapping dữ liệu và serialize có thể làm main thread bận.', speech: 'Sau await, ứng dụng còn có thể map hàng chục nghìn dòng rồi serialize JSON. Dù query đã xong, phần CPU này vẫn có thể trì hoãn request khác. Vì thế, tối ưu đường đọc socket không thay được việc giới hạn lượng kết quả và công việc sau query.' }
          ], takeaway: 'Tách readiness, hoàn tất giao thức và thực thi JavaScript khi đọc trace.',
          conclusion: 'Đến đây ta hiểu Node.js có thể giữ nhiều I/O chờ mà không cần một thread chạy JS cho từng socket. Nhưng số lượng kết nối vẫn có những giới hạn vật lý và cấu hình.'
        }),
        teach({
          id: 'connection-capacity-limits', title: 'epoll không làm server có sức chứa vô hạn', subtitle: 'Mỗi tầng vẫn có giới hạn cần đo',
          lead: 'Theo dõi readiness hiệu quả không xoá chi phí socket, buffer, CPU và downstream.',
          intro: 'Giả sử mình đã dùng cơ chế I/O phù hợp nhưng server vẫn quá tải. Kết luận epoll hỏng sẽ là quá sớm. Nó giải bài toán chờ và nhận sự kiện, không giải mọi giới hạn khác của hệ thống.',
          exhibit: { label: 'Các giới hạn cần đối chiếu', rows: [{ label: 'FD limit và socket', value: 'có thể hết khả năng mở thêm' }, { label: 'Buffer và bộ nhớ', value: 'tăng theo dữ liệu bị giữ' }, { label: 'Main thread', value: 'callback và serialize vẫn dùng CPU' }, { label: 'Database pool', value: 'số query thực thi đồng thời hữu hạn' }] },
          steps: [
            { title: 'Đo đúng tài nguyên đã đầy', detail: 'CPU thấp không loại trừ hết FD hoặc pool.', speech: 'Một process có thể gặp giới hạn FD ngay khi CPU rảnh. Một ứng dụng cũng có thể giữ nhiều request chỉ để chờ pool database. Mỗi tín hiệu dẫn tới một phép đo khác nhau, nên mình không dùng một con số CPU để đại diện sức khoẻ toàn server.' },
            { title: 'Giới hạn lượng công việc đang giữ', detail: 'Bound concurrency, timeout và backpressure.', speech: 'Khi downstream chậm, nhận thêm vô hạn chỉ làm nhiều người cùng chờ và giữ thêm dữ liệu. Cần giới hạn concurrency hoặc hàng đợi, đặt timeout theo ngân sách request và xử lý backpressure. Khi hết sức chứa, trả lỗi có kiểm soát có thể tốt hơn giữ mọi request tới khi process hết bộ nhớ.' },
            { title: 'Không gắn nhãn O(1) cho mọi chi phí', detail: 'Chi phí vẫn phụ thuộc sự kiện, đăng ký và workload.', speech: 'Ta không nên diễn đạt epoll là luôn xử lý mọi thứ trong thời gian hằng số. Số sự kiện trả về vẫn cần được duyệt, việc đăng ký có chi phí và callback vẫn phải chạy. Điều hữu ích là cơ chế duy trì tập quan tâm và trả sự kiện ready phù hợp với nhiều socket đang chờ.' }
          ], takeaway: 'Multiplexing giúp quản lý chờ; capacity planning vẫn cần đo và giới hạn các tài nguyên còn lại.',
          conclusion: 'Nếu đã thấy request chờ tích lại, chỉ số bộ nhớ thường là manh mối tiếp theo. Mình sẽ đọc nó cẩn thận để không nhầm mọi phần tăng với leak JavaScript.'
        })
      ],
      check: { id: 'c1-l1-live-process-q5', question: 'epoll trả socket ready nhưng API vẫn chậm. Kết luận nào đúng?', options: ['Ready bảo đảm request HTTP đã được xử lý xong.', 'epoll tự phân phối callback JS lên mọi lõi CPU.', 'Cần đo tiếp main thread, driver, pool và lượng dữ liệu.', 'Không còn khả năng tắc nghẽn ở tầng ứng dụng.'], correctIndex: 2, explanation: 'Readiness chỉ cho biết I/O có thể tiến triển, không phải toàn bộ request đã hoàn tất. Parsing, continuation, database pool và xử lý kết quả vẫn có thể gây chậm.' },
      explanation: 'Connection mở, I/O ready và callback được thực thi là các trạng thái riêng; mỗi trạng thái có chi phí riêng.'
    },
    {
      id: 'process-memory', title: 'Đọc bộ nhớ mà không kết luận vội là leak', durationMinutes: 10,
      objective: 'Phân biệt RSS, V8 heap, external và arrayBuffers; nối số liệu process với giới hạn container đúng ranh giới.',
      slides: [
        teach({
          id: 'memory-regions', title: 'RSS và heapUsed không đo cùng một thứ', subtitle: 'Đọc tên chỉ số trước khi cộng các con số',
          lead: 'process.memoryUsage() trả nhiều góc nhìn; chúng không phải các ngăn độc lập để cộng hết lại.',
          intro: 'Khi API giữ nhiều request chờ, dashboard báo bộ nhớ tăng. Trước khi chụp heap snapshot, mình đọc từng chỉ số đang có. Ví dụ trên bảng dùng MiB và số giả định, không phải phép đo được lấy từ một server cụ thể.',
          exhibit: { label: 'Snapshot minh hoạ · MiB', rows: [{ label: 'rss', value: '240' }, { label: 'heapTotal / heapUsed', value: '96 / 60' }, { label: 'external', value: '80' }, { label: 'arrayBuffers', value: '64 · nằm trong external' }] },
          steps: [
            { title: 'heapUsed là phần V8 heap đang dùng', detail: 'heapTotal là phần heap V8 đã cấp, không phải toàn bộ process.', speech: 'V8 quản lý nhiều object JavaScript trên heap. heapUsed phản ánh phần đang dùng; heapTotal phản ánh dung lượng heap đã được cấp theo cách runtime báo cáo. Chúng không bao gồm mọi vùng nhớ của process. Đọc heapUsed ổn định rồi kết luận tổng bộ nhớ ổn định là bước nhảy quá xa.' },
            { title: 'Buffer có phần dữ liệu ngoài heap JS', detail: 'external và arrayBuffers có quan hệ bao hàm.', speech: 'Buffer và ArrayBuffer có thể giữ backing memory được báo trong các chỉ số tương ứng. Trong API này, arrayBuffers được tính trong external, nên không cộng hai số như hai ngăn rời. Wrapper JavaScript nhỏ có thể giữ một khối dữ liệu lớn mà chỉ nhìn số object sẽ khó nhận ra.' },
            { title: 'RSS nhìn các trang resident của process', detail: 'Còn có code, stack và cấp phát native.', speech: 'RSS nhìn rộng hơn phần heap JavaScript, gồm các trang resident thuộc nhiều vùng của process. Code, stack và cấp phát native cũng có thể góp vào đó. Nhưng cũng không được coi RSS là tổng đơn giản của những dòng trên bảng, vì các phạm vi đo và quan hệ bao hàm không cho phép cộng tùy ý.' }
          ], takeaway: 'Đọc định nghĩa từng metric và quan hệ bao hàm trước khi suy nguyên nhân hoặc tính tổng.',
          conclusion: 'Giờ mình so sánh hai thời điểm và hỏi phần tăng có thể đến từ dữ liệu nào trong ví dụ request đang chờ.'
        }),
        teach({
          id: 'memory-metric-triage', title: 'Heap ổn định nhưng Buffer đang tích lại', subtitle: 'Nối thay đổi metric với một giả thuyết có thể kiểm tra',
          lead: 'RSS tăng, arrayBuffers tăng, in-flight tăng: kiểm tra dữ liệu đang bị giữ trong request chờ.',
          intro: 'Giả sử heapUsed gần như đi ngang, nhưng RSS và arrayBuffers cùng tăng trong lúc database chậm. Đây là gợi ý điều tra, chưa phải bằng chứng kết luận. Mình cần tìm nơi đang giữ tham chiếu tới các dữ liệu đó.',
          exhibit: { label: 'Hai thời điểm minh hoạ · MiB trừ dòng in-flight', rows: [{ label: 'heapUsed', value: '60 → 64' }, { label: 'arrayBuffers', value: '64 → 180' }, { label: 'RSS', value: '240 → 370' }, { label: 'Request in-flight', value: '200 → 2.000' }] },
          steps: [
            { title: 'Đưa ra giả thuyết cụ thể', detail: 'Body, kết quả query hoặc buffer có thể đang được giữ.', speech: 'Trong API của mình, request đang chờ có thể vẫn giữ body, context hoặc kết quả từ một chặng trước. Nếu số request tăng mười lần, dữ liệu bị giữ cũng có thể tăng. Mình sẽ kiểm tra kích thước body, cách buffer response và vị trí hàng đợi, thay vì chỉ tăng giới hạn V8 heap.' },
            { title: 'Thay điều kiện rồi quan sát', detail: 'Khi downstream hồi phục và backlog giảm, memory có giảm theo không?', speech: 'Cho downstream hồi phục trong môi trường thử nghiệm, theo dõi in-flight và lượng dữ liệu được giải phóng. Nếu lượng giữ giảm theo backlog, đó là bằng chứng khác với trường hợp object cứ bị giữ sau khi request xong. RSS có thể không giảm ngay do allocator và các yếu tố native, nên phải đọc xu hướng nhiều chỉ số.' },
            { title: 'Chưa được loại trừ native memory', detail: 'Không phải mọi native allocation đều được external phản ánh đầy đủ.', speech: 'Nếu RSS tiếp tục tăng còn các chỉ số khác không giải thích được, cần điều tra sâu hơn về allocator, fragmentation và thư viện native. Một snapshot không đủ để phân biệt tất cả trường hợp. Quan trọng là mình nêu rõ bằng chứng nào đang có và giả thuyết nào chưa được kiểm tra.' }
          ], takeaway: 'Memory tăng có thể là công việc đang tích lại; leak là một giả thuyết cần thêm bằng chứng.',
          conclusion: 'Tiếp theo, mình đặt những số liệu này vào giới hạn container để hiểu vì sao tăng heap không phải cách cứu mọi lần OOM.'
        }),
        teach({
          id: 'container-memory-budget', title: 'Container 512 MiB không dành trọn 512 MiB cho heap', subtitle: 'Giới hạn áp dụng ở cgroup, không chỉ ở một biến V8',
          lead: 'Heap chỉ là một phần của lượng bộ nhớ được tính vào giới hạn container.',
          intro: 'Giả sử container có giới hạn bộ nhớ năm trăm mười hai MiB. Mình không thể đặt heap tối đa đúng con số đó rồi cho rằng đã dùng tài nguyên tối ưu. Trong container còn có các vùng và kiểu bộ nhớ khác cần được tính tới.',
          exhibit: { label: 'Ngân sách minh hoạ · phải đo workload thật', rows: [{ label: 'Giới hạn cgroup', value: '512 MiB' }, { label: 'Heap budget giả định', value: '256 MiB' }, { label: 'Phần còn lại', value: 'Buffer, native, stack, code, headroom' }, { label: 'Bằng chứng OOM', value: 'container status + cgroup events' }] },
          steps: [
            { title: 'Heap flag không giới hạn tổng process', detail: '--max-old-space-size không phải trần RSS.', speech: 'Flag giới hạn old space của V8 không phải trần cho mọi cấp phát bộ nhớ. Buffer, thread stack và thư viện native vẫn cần chỗ. Một process có thể còn xa heap limit nhưng container đã chịu áp lực bộ nhớ.' },
            { title: 'Cgroup accounting khác process RSS', detail: 'Có thể tính nhiều process và các loại memory khác.', speech: 'Giới hạn container được thực thi theo cgroup, không đơn giản là lấy một lần đọc RSS của Node rồi so với ngưỡng. Cgroup có thể bao gồm nhiều process và các khoản memory được tính theo cơ chế của hệ điều hành. Vì thế, cần xem metric container cùng với metric của process.' },
            { title: 'Xác minh lý do bị kill', detail: 'Exit 137 một mình không chứng minh OOM.', speech: 'Nếu container kết thúc với mã một trăm ba mươi bảy, đừng tự động kết luận OOM. Nó có thể phản ánh bị SIGKILL vì nguyên nhân khác. Hãy đối chiếu trạng thái OOMKilled hoặc sự kiện cgroup và log của môi trường chạy. Giữ headroom theo số đo workload thay vì dùng phần trăm cố định như một định luật.' }
          ], takeaway: 'Đặt budget cho toàn workload và kiểm chứng OOM bằng bằng chứng của môi trường chạy.',
          conclusion: 'Mình đã có đủ mô hình để xử lý một sự cố hoàn chỉnh. Ta sẽ dùng thứ tự chẩn đoán để tránh tăng sai tài nguyên.'
        })
      ],
      check: { id: 'c1-l1-live-process-q6', question: 'RSS và arrayBuffers tăng, heapUsed ít đổi, request in-flight tăng. Bước tiếp theo hợp lý nhất?', options: ['Kết luận không có vấn đề vì heapUsed ổn định.', 'Cộng arrayBuffers vào external để tính tổng.', 'Kiểm tra buffer và dữ liệu đang bị giữ theo backlog.', 'Tăng old-space limit tới đúng memory limit container.'], correctIndex: 2, explanation: 'Các xu hướng gợi ý kiểm tra memory ngoài heap và công việc đang chờ, chưa chứng minh một loại leak cụ thể. arrayBuffers đã thuộc external; giới hạn container cũng không chỉ tính V8 heap.' },
      explanation: 'Nối các metric theo cùng thời điểm và cùng workload; kiểm chứng giả thuyết giữ dữ liệu trước khi tăng giới hạn.'
    },
    {
      id: 'production-application', title: 'Ghép các manh mối để xử lý một ca thật', durationMinutes: 13,
      objective: 'Đề xuất phép đo, thay đổi có giới hạn và tiêu chí kiểm chứng cho tình huống API chậm do downstream.',
      slides: [
        teach({
          id: 'guided-production-case', title: 'API chậm nhưng CPU chỉ 20%: bắt đầu từ đâu?', subtitle: 'Không chọn cách sửa chỉ từ một chỉ số',
          lead: 'Đọc cùng lúc latency, pool wait, in-flight, CPU và bộ nhớ.',
          intro: 'Mình đưa ra một ca giả lập để tổng hợp bài. Trước sự cố, API hoàn tất một nghìn request mỗi giây với thời gian trung bình hai trăm mili giây. Sau đó database chậm hơn, request bắt đầu tích lại. Hãy thử nêu một giả thuyết trước khi nghe lời giải.',
          exhibit: { label: 'Ca giả lập · so trước và trong sự cố', rows: [{ label: 'CPU process', value: 'quanh 20%' }, { label: 'DB latency và pool wait', value: 'đều tăng' }, { label: 'Request in-flight', value: '200 → 2.000' }, { label: 'RSS / heapUsed', value: 'RSS tăng / heap gần ổn định' }] },
          steps: [
            { title: 'Nêu giả thuyết, chưa kết luận', detail: 'Ứng dụng có vẻ đang chờ nhiều hơn là tính toán nhiều hơn.', speech: 'CPU thấp và thời gian chờ pool tăng phù hợp với khả năng ứng dụng bị chặn ở downstream. Nhưng đây chưa chứng minh database là nguyên nhân duy nhất. Một CPU tổng trung bình cũng có thể che khuất một thread bận, nên mình cần thêm metric của process và event-loop delay.' },
            { title: 'Lấy một trace chậm', detail: 'Tách pool acquisition, query và xử lý sau query.', speech: 'Chọn request chậm và đọc từng span. Nó chờ lấy connection bao lâu, query chạy bao lâu, rồi serialize bao lâu? Nếu phần lớn thời gian nằm ở pool acquisition, mình kiểm tra pool đang được giữ bởi ai. Nếu query mới là phần tăng, xem query plan, lock wait và tải database tương ứng.' },
            { title: 'Nối backlog với memory', detail: 'Đo kích thước dữ liệu mỗi request đang giữ.', speech: 'Tiếp theo, so in-flight với memory theo thời gian. Nếu nhiều request đang giữ buffer trong lúc chờ, RSS có thể tăng dù heap ít đổi. Mình không vội gọi đó là leak, cũng không coi tăng heap là cách làm database nhanh hơn.' }
          ], takeaway: 'Một chẩn đoán tốt nói rõ hiện tượng, giả thuyết và phép đo phân biệt các nguyên nhân.',
          conclusion: 'Bây giờ mình chọn một thay đổi nhỏ có thể kiểm chứng, thay vì cùng lúc đổi pool, heap, thread và số instance.'
        }),
        teach({
          id: 'diagnostic-decision-order', title: 'Sửa một điều kiện, giữ một tiêu chí thành công', subtitle: 'Ngăn queue phình ra trước khi tối ưu mù quáng',
          lead: 'Tăng lượng công việc vào một dependency đang quá tải có thể làm sự cố nặng hơn.',
          intro: 'Giả sử trace và metric đã cho thấy hàng đợi pool tăng vì database thực thi chậm. Một phản xạ thường gặp là tăng pool thật lớn. Nhưng nếu database đã bão hoà, làm nhiều query chạy đồng thời hơn có thể tăng contention và latency.',
          exhibit: { label: 'Kế hoạch thử có kiểm soát', rows: [{ label: 'Giả thuyết', value: 'downstream chậm → backlog tăng' }, { label: 'Can thiệp đầu', value: 'giới hạn concurrency / queue' }, { label: 'Ngân sách request', value: 'timeout phù hợp và hủy có hỗ trợ' }, { label: 'Đo lại', value: 'latency, throughput, errors, in-flight' }] },
          steps: [
            { title: 'Chặn tích lũy vô hạn', detail: 'Bound queue và số việc có thể thực thi đồng thời.', speech: 'Trước hết bảo vệ hệ thống bằng giới hạn rõ. Khi đã tới ngưỡng, xử lý từ chối hoặc chờ có giới hạn theo yêu cầu sản phẩm. Backpressure nghĩa là phía tạo việc phải phản ứng khi phía nhận không theo kịp, chứ không cứ đẩy thêm vào RAM.' },
            { title: 'Timeout phải gắn với vòng đời công việc', detail: 'Client ngừng chờ chưa chắc query đã dừng.', speech: 'Đặt timeout giúp giới hạn thời gian chờ của một tầng, nhưng cần biết công việc bên dưới có bị huỷ thật không. Nếu API trả timeout mà query vẫn tiếp tục chạy hàng phút, tài nguyên vẫn bị giữ. Cơ chế huỷ phải được driver và database hỗ trợ, và cần được kiểm tra thay vì giả định.' },
            { title: 'So cùng workload và đọc trade-off', detail: 'Không ăn mừng p95 giảm nếu lỗi tăng mất kiểm soát.', speech: 'Đo lại dưới tải tương đương, ghi cả throughput, tỷ lệ lỗi, backlog và bộ nhớ. Nếu mình chủ động từ chối sớm một phần request để giữ hệ thống sống, đó là một trade-off cần báo rõ. Giảm latency bằng cách bỏ phần lớn request không đồng nghĩa mọi người dùng đã được phục vụ tốt hơn.' }
          ], takeaway: 'Mỗi thay đổi cần giả thuyết, phạm vi ảnh hưởng và metric xác minh.',
          conclusion: 'Sau khi ổn định được sự cố, mới tiếp tục tối ưu query, dữ liệu trả về hoặc phân bổ tài nguyên dựa trên bottleneck đã xác minh.'
        }),
        teach({
          id: 'lesson-recap', title: 'Tự giải thích lại đường đi của một request', subtitle: 'Dùng mô hình để dự đoán, không chỉ để nhớ tên',
          lead: 'Một request đi qua nhiều vòng đời và nhiều loại thời gian.',
          intro: 'Mình quay lại request đặt lịch đầu bài. Lần này, hãy tự mô tả nó bằng các ranh giới vừa học. Nếu có đoạn chưa giải thích được, đó chính là phần nên xem lại.',
          exhibit: { label: 'Ba câu tự kiểm tra', rows: [{ label: 'Dữ liệu nằm ở đâu?', value: 'request context hay singleton?' }, { label: 'Thời gian mất ở đâu?', value: 'CPU, I/O hay queue?' }, { label: 'Tài nguyên bị giữ là gì?', value: 'socket, pool slot, object, buffer?' }] },
          steps: [
            { title: 'Theo ownership', detail: 'Xác thực tenant rồi truyền đúng context.', speech: 'Trước hết, process đang nhận request và service đang phục vụ nó có thể sống lâu hơn request. Tenant của người gọi phải được xác thực và giữ theo ngữ cảnh lần gọi. Một lần await không tự tạo vùng riêng cho thuộc tính mutable trên singleton.' },
            { title: 'Theo công việc thực thi', detail: 'JS chạy ngắn; I/O chờ; kết quả ready vẫn phải được xử lý.', speech: 'Sau đó, main thread chuẩn bị I/O và có thể nhận việc khác trong lúc chờ. Socket readiness được theo dõi bằng cơ chế phù hợp của nền tảng. Dữ liệu quay về vẫn cần được đọc, parse và xử lý. Một vòng lặp CPU dài ở bất kỳ request nào có thể trì hoãn cơ hội đó.' },
            { title: 'Theo lượng công việc còn giữ', detail: 'Dùng mean đúng đơn vị và đối chiếu memory.', speech: 'Cuối cùng, nếu thời gian lưu lại tăng ở cùng tốc độ xử lý ổn định, số request trung bình trong hệ thống sẽ tăng. Những request ấy có thể giữ thêm dữ liệu. Mình đọc RSS, heap và memory ngoài heap theo định nghĩa, rồi đo bottleneck trước khi chọn cách sửa.' }
          ], takeaway: 'Muốn sửa đúng, hãy giải thích được dữ liệu của ai, đang chờ gì và giữ tài nguyên nào.',
          conclusion: 'Đó là mô hình nền để học V8, event loop và NestJS sâu hơn. Ta không cần giải mọi bài toán vận hành hôm nay, nhưng cần đủ khả năng đặt đúng câu hỏi và làm một phép thử để kiểm chứng.'
        })
      ],
      check: { id: 'c1-l1-live-process-q7', question: 'Pool wait tăng, DB chậm, in-flight và RSS cùng tăng. Hành động nào có căn cứ nhất?', options: ['Tăng heap trước vì request luôn chậm do thiếu heap.', 'Đọc trace, kiểm tra pool/DB và giới hạn backlog có đo lại.', 'Tạo một Worker Thread mới cho mỗi request đang chờ.', 'Tăng pool vô hạn để request nào cũng có connection.'], correctIndex: 1, explanation: 'Các tín hiệu cần được nối với trace để xác định chặng chờ và tài nguyên bị giữ. Giới hạn backlog bảo vệ sức chứa; việc tăng pool hoặc heap chỉ có ý nghĩa khi có giả thuyết và phép đo phù hợp.' },
      explanation: 'Tách dữ liệu dùng chung, thời gian CPU và I/O wait; chọn một can thiệp có thể quan sát và kiểm chứng.'
    }
  ],
  closing: overview({
    id: 'closing-recap', title: 'Bài tập nhỏ: quan sát một API của chính mình',
    subtitle: 'Biến mô hình vừa học thành một kết quả có thể giải thích',
    lead: 'Chọn một endpoint đọc database và ghi lại điều mình quan sát được.',
    intro: 'Để kết thúc, mình muốn người học mang theo một bài tập nhỏ có thể làm trên ứng dụng quen thuộc. Không cần tạo tải lớn và cũng không cần can thiệp production. Hãy làm trong môi trường thử nghiệm có quyền kiểm soát.',
    exhibit: { label: 'Bài tập sau buổi học' },
    steps: [
      { title: 'Vẽ vòng đời', detail: 'Đánh dấu process, singleton, request và context.', speech: 'Vẽ request đi qua controller, service và repository. Với mỗi dữ liệu được giữ lại, ghi ai sở hữu và nó phải sống tới lúc nào. Nếu thấy currentUser hoặc currentTenant trên singleton, hãy theo lần ghi và đọc quanh các điểm await.' },
      { title: 'Tạo hai tình huống chậm', detail: 'Một I/O chậm; một CPU task dài có kiểm soát.', speech: 'So một dependency giả chậm với một phép tính dài trong môi trường thử. Quan sát một endpoint nhẹ thứ hai và giải thích vì sao hành vi khác nhau. Không suy từ phần trăm CPU duy nhất; hãy ghi thêm latency và số request đang chờ.' },
      { title: 'Viết giả thuyết và bằng chứng', detail: 'Nêu cách đo để bác bỏ hoặc củng cố kết luận.', speech: 'Cuối cùng, viết một đoạn ngắn nêu hiện tượng, nguyên nhân mình nghi ngờ và phép đo cần thêm. Một kết luận tốt có thể bị kiểm chứng là sai. Điều đó giúp mình tiến bộ hơn việc thuộc một khẩu hiệu như cứ async là nhanh.' }
    ],
    takeaway: 'Giải thích bằng một ví dụ chạy được và một phép đo có thể lặp lại.',
    conclusion: 'Ở bài sau, mình đi sâu hơn vào cách V8 thực thi và tối ưu JavaScript. Mô hình process, main thread và ownership hôm nay sẽ là nền để hiểu những gì runtime làm bên trong.'
  })
};
