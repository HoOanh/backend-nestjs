import type { InstructorLessonPlan } from '../types.ts';

/**
 * Giáo trình lớp 1-1 cho một buổi liền mạch 90 phút, gồm giảng giải,
 * thời gian dừng trao đổi, bài tập có hướng dẫn và câu hỏi kiểm tra hiểu bài.
 */
export const instructor_c1_l1: InstructorLessonPlan = {
  lessonId: 'c1-l1',
  title: 'Từ phần cứng đến runtime: tiến trình dài hạn và bài toán C10K',
  durationMinutes: 90,
  opening: {
    id: 'opening-incident',
    title: '50.000 kết nối, chỉ 10 socket có dữ liệu mới',
    subtitle: 'Một tình huống production để đặt câu hỏi trước khi học cơ chế',
    narration:
      'Trong dashboard production, API đang giữ 50.000 kết nối TCP mở. Snapshot I/O báo chỉ 10 socket vừa có dữ liệu mới sẵn sàng. 49.990 kết nối còn lại vẫn tồn tại nhưng đang chờ, không cần CPU chạy liên tục. Nếu mỗi kết nối có một thread riêng, hàng chục nghìn stack và ngữ cảnh lập lịch vẫn phải được quản lý. Runtime nhận ra đúng socket cần xử lý bằng cách nào?',
    takeaway: 'Câu hỏi của buổi học: làm sao giữ nhiều kết nối mà không trả chi phí như thể tất cả đều đang chạy?',
    visual: {
      kind: 'text-slide',
      lead: 'Một server giữ nhiều kết nối cùng lúc; runtime chỉ cần xử lý những socket có dữ liệu mới.',
      metrics: [
        { value: '50.000', label: 'kết nối đang mở' },
        { value: '10', label: 'socket có dữ liệu mới' },
        { value: '49.990', label: 'socket còn lại đang chờ' }
      ],
      question: 'Ứng dụng phải trả chi phí gì để biết socket nào thực sự cần được xử lý?',
      note: 'Số liệu là ví dụ đặt vấn đề; chi phí thật phụ thuộc hệ điều hành, cấu hình và workload.'
    },
  },
  roadmap: {
    id: 'lesson-roadmap',
    title: 'Mình sẽ lần theo câu hỏi này từ trong ra ngoài',
    subtitle: 'Bốn chặng nối thành một bài học liền mạch',
    narration:
      'Ta sẽ giải câu hỏi production qua bốn lớp, mỗi lớp mở ra một manh mối của cùng một sự cố. Trước hết, phân biệt chương trình, process, thread và vùng nhớ mà hệ điều hành thực sự quản lý. Kế đó, xem server sống qua nhiều request ra sao và trạng thái nào đang được chia sẻ. Rồi lần theo một request qua main thread, event loop đến kernel I/O để tìm chỗ nó phải chờ. Cuối cùng, đối chiếu latency, request đang xử lý và memory metrics để quyết định cần kiểm tra gì trong production.',
    takeaway: 'Một bài xuyên suốt: từ process/thread đến runtime, I/O và quyết định vận hành.',
    visual: {
      kind: 'text-slide',
      eyebrow: 'LỘ TRÌNH BUỔI HỌC · 90 PHÚT',
      lead: 'Mình sẽ lần từ tài nguyên bên trong process ra tới hành vi của cả server.',
      points: [
        { title: 'Nền tảng thực thi', detail: 'Program, process, thread và không gian địa chỉ.' },
        { title: 'Vòng đời request', detail: 'Server singleton, trạng thái dùng chung và điểm await.' },
        { title: 'Runtime và I/O', detail: 'Main thread, event loop, độ trễ và socket readiness.' },
        { title: 'Đọc production', detail: 'Nối latency, CPU, in-flight request và memory metrics.' }
      ]
    },
  },
  sections: [
    {
      id: 'process-model',
      title: 'Chương trình, tiến trình và luồng',
      objective: 'Phân biệt file chương trình, tiến trình đang chạy và luồng được CPU lập lịch.',
      durationMinutes: 12,
      slides: [
        {
          id: 'program-to-process',
          title: 'Từ file trên đĩa đến tiến trình sống',
          subtitle: 'Một file không tự chạy; hệ điều hành phải cấp ngữ cảnh thực thi',
          narration:
            'Chương trình là nội dung tĩnh được lưu trên đĩa: mã đã biên dịch, thư viện và cấu hình. Khi chạy node dist/main.js, hệ điều hành tạo một tiến trình, gán PID, ánh xạ các trang bộ nhớ ảo và chuẩn bị tài nguyên như file descriptor. Runtime V8 và mã ứng dụng lúc này mới có không gian để thực thi. Vì vậy, xóa một file khỏi danh sách trên màn hình không đồng nghĩa tiến trình đã dừng; ngược lại, một tiến trình có thể vẫn chạy sau khi câu lệnh khởi động kết thúc ở terminal. Trong vận hành, cần phân biệt artefact được deploy với process đang giữ socket, heap và các kết nối thật.',
          takeaway: 'Program là bản mô tả tĩnh; process là thực thể đang chạy với PID và không gian tài nguyên riêng.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'KHÁI NIỆM NỀN · TĨNH KHÁC VỚI ĐANG CHẠY',
            lead: 'File chương trình là thứ được lưu trên đĩa. Process là lần chạy thật mà hệ điều hành đang quản lý.',
            points: [
              { title: 'Program', detail: 'Mã, thư viện và cấu hình; bản thân file không giữ socket đang mở.' },
              { title: 'Process', detail: 'Có PID, không gian địa chỉ, file descriptor và tài nguyên runtime.' },
              { title: 'Runtime', detail: 'V8 cùng ứng dụng thực thi bên trong vòng đời của process.' }
            ],
            question: 'Khi server đang chạy, mình cần điều tra file deploy hay process đang giữ kết nối?'
          }
        },
        {
          id: 'process-and-thread',
          title: 'Process sở hữu tài nguyên, thread thực thi lệnh',
          subtitle: 'Hai khái niệm khác nhau, phối hợp với nhau',
          narration:
            'Tiến trình là ranh giới quản lý tài nguyên và cô lập địa chỉ bộ nhớ. Luồng là đơn vị mà bộ lập lịch đưa lên lõi CPU. Một tiến trình thường có nhiều luồng; các luồng trong cùng process dùng chung heap và file descriptor, nhưng mỗi luồng có thanh ghi và call stack riêng. Khi debug, câu hỏi “request này ở process nào?” và “đoạn code này đang chạy trên thread nào?” dẫn tới hai loại nguyên nhân khác nhau: chia sẻ trạng thái giữa request liên quan heap; block đồng bộ liên quan thời gian thread giữ CPU hoặc không trả về event loop.',
          takeaway: 'Process chia sẻ vùng tài nguyên; mỗi thread có ngữ cảnh thực thi riêng.',
          visual: {
            kind: 'process-memory',
            regions: [
              { id: 'heap', title: 'Shared heap', detail: 'Đối tượng dùng chung trong process', position: [0, 1.4, 0], color: '#0f9f79' },
              { id: 'stack-a', title: 'Stack A', detail: 'Ngữ cảnh thực thi riêng', position: [-1.7, 0.6, 0.25], color: '#0284c7' },
              { id: 'stack-b', title: 'Stack B', detail: 'Ngữ cảnh thực thi riêng', position: [1.7, 0.6, 0.25], color: '#d97706' }
            ]
          },
        },
        {
          id: 'thread-context',
          title: 'Điều gì nằm riêng và điều gì được chia sẻ?',
          subtitle: 'Mô hình bộ nhớ tối thiểu để đọc bug concurrency',
          narration:
            'Hãy nhìn process như một vùng địa chỉ chung. Hai thread A và B cùng nhìn thấy object trên heap, vì thế một thread sửa thuộc tính dùng chung thì thread kia có thể quan sát giá trị mới. Nhưng mỗi thread có stack riêng để lưu biến cục bộ và chuỗi lời gọi hàm. Trong JavaScript trên Node.js, đa số callback ứng dụng chạy trên main thread; tuy vậy, I/O vẫn có thể chồng lấp theo thời gian vì main thread nhường quyền khi chờ bất đồng bộ. Chia sẻ bộ nhớ của process không tự biến mỗi request thành vùng độc lập. Ranh giới request phải được giữ bằng cách truyền dữ liệu qua tham số hoặc context an toàn.',
          takeaway: 'Biến cục bộ thuộc lần gọi; thuộc tính service singleton thuộc đối tượng dùng chung.',
          visual: {
            kind: 'memory-map',
            regions: [
              { id: 'heap', title: 'Shared heap', detail: 'Object và thuộc tính singleton' },
              { id: 'stack-a', title: 'Stack A', detail: 'Biến cục bộ của luồng A' },
              { id: 'stack-b', title: 'Stack B', detail: 'Biến cục bộ của luồng B' }
            ]
          },
        },
        {
          id: 'virtual-address-space',
          title: 'Không gian địa chỉ ảo tạo ranh giới cho process',
          subtitle: 'PID là danh tính; page table và MMU quyết định process nhìn thấy vùng nhớ nào',
          narration:
            'Mỗi process có không gian địa chỉ ảo riêng. Con trỏ trong chương trình không nhất thiết là địa chỉ RAM vật lý; MMU dịch địa chỉ ảo thông qua page table của process đang chạy. Điều đó cho phép hai process dùng cùng một giá trị địa chỉ ảo nhưng ánh xạ đến các trang vật lý khác nhau. Bản đồ thường có vùng mã thực thi, dữ liệu, heap, thư viện dùng chung được ánh xạ và stack của thread. Các vùng này không phải những chiếc hộp RAM cố định có kích thước bằng đúng phần dữ liệu đang dùng: kernel có thể reserve không gian ảo, cấp phát trang vật lý theo nhu cầu, chia sẻ trang read-only hoặc thu hồi trang. Khi process bị kill, kernel thu hồi các tài nguyên gắn với nó; khi chỉ một request lỗi, process vẫn tiếp tục chạy. Đây là lý do crash isolation và memory accounting cần nhìn ở ranh giới process, không chỉ nhìn một object JavaScript.',
          takeaway: 'Địa chỉ ảo được dịch qua MMU/page table; mỗi process có ranh giới ánh xạ và vòng đời tài nguyên riêng.',
          visual: {
            kind: 'memory-map',
            regions: [
              { id: 'text-region', title: 'Text / code', detail: 'Mã thực thi, thường có thể được chia sẻ read-only' },
              { id: 'heap-region', title: 'Heap', detail: 'Object runtime cấp phát và quản lý' },
              { id: 'shared-region', title: 'Mapped libraries', detail: 'Thư viện và vùng ánh xạ chung' },
              { id: 'stack-region', title: 'Thread stacks', detail: 'Ngữ cảnh lời gọi riêng của từng thread' }
            ]
          }
        },
        {
          id: 'file-descriptor-ownership',
          title: 'File descriptor là tay cầm của process tới tài nguyên kernel',
          subtitle: 'Socket, pipe và file đều được biểu diễn bằng descriptor trong process',
          narration:
            'File descriptor là một số nguyên nhỏ trong bảng descriptor của process, dùng để tham chiếu tới một open file description hoặc đối tượng kernel tương ứng. Socket số 41 trong process A không phải cùng một danh tính toàn hệ thống với số 41 của process B. Khi gọi accept, server nhận descriptor mới cho kết nối; runtime giữ mapping từ descriptor tới trạng thái socket và callback. Descriptor có thể bị đóng rồi con số đó được tái sử dụng, vì vậy log một con số FD mà không gắn vòng đời và process ID có thể gây nhầm. Nếu ứng dụng rò rỉ descriptor, số FD mở tăng dần dù heap không đổi; lỗi cuối cùng có thể là EMFILE khi chạm giới hạn. Đọc process model qua FD giúp nối phần hệ điều hành với bài toán socket readiness ở phần sau.',
          takeaway: 'FD là handle theo bảng của process; theo dõi cả vòng đời mở/đóng và giới hạn FD khi chẩn đoán.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'accept-socket', title: 'accept()', detail: 'Kernel trả descriptor cho kết nối mới' },
              { id: 'fd-table', title: 'Process FD table', detail: 'Số FD ánh xạ tới trạng thái kernel' },
              { id: 'runtime-handle', title: 'Runtime handle', detail: 'Node/libuv gắn callback và trạng thái' },
              { id: 'close-fd', title: 'close()', detail: 'Giải phóng descriptor; số có thể được tái dùng' }
            ]
          },
        }
      ],
      check: {
        id: 'c1-l1-live-process-q1',
        question: 'Hai thread thuộc cùng một process có chia sẻ heap không, và mỗi thread giữ riêng phần nào?',
        options: [
          'Có; mỗi thread có stack và bộ thanh ghi riêng.',
          'Không; mỗi thread có heap và file descriptor riêng.',
          'Có; nhưng toàn bộ stack cũng dùng chung.',
          'Không; process và thread đều là đơn vị lập lịch CPU.'
        ],
        correctIndex: 0,
        explanation: 'Các thread trong cùng process chia sẻ không gian địa chỉ, bao gồm heap và bảng file descriptor. Mỗi thread vẫn có stack và trạng thái thanh ghi riêng để lưu ngữ cảnh thực thi.'
      },
      explanation: 'Process sở hữu không gian địa chỉ và tài nguyên dùng chung; mỗi thread giữ stack cùng trạng thái thực thi riêng.'
    },
    {
      id: 'long-running-state',
      title: 'Máy chủ sống lâu và trạng thái request',
      objective: 'Nhận ra vì sao singleton giữ dữ liệu người dùng có thể gây nhiễm chéo request.',
      durationMinutes: 12,
      slides: [
        {
          id: 'server-lifetime',
          title: 'Server không khởi động lại sau mỗi request',
          subtitle: 'Một process phục vụ nhiều người dùng qua thời gian',
          narration:
            'Tab trình duyệt thường có vòng đời gắn với phiên của người dùng. Một Node.js server thì khác: process khởi động một lần và có thể tiếp nhận hàng triệu request trước lần deploy kế tiếp. NestJS mặc định giữ các provider singleton trong suốt vòng đời ứng dụng. Cách này tiết kiệm chi phí khởi tạo, nhưng thuộc tính mutable trên service tồn tại qua nhiều request. Mỗi request phải truyền ngữ cảnh của nó qua tham số, không gắn tạm clinicId, userId hay tenantId lên singleton rồi hy vọng request khác không chạy xen vào.',
          takeaway: 'Vòng đời singleton dài hơn request; trạng thái nghiệp vụ không được để trong thuộc tính mutable của singleton.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'VÒNG ĐỜI · MỘT PROCESS PHỤC VỤ NHIỀU REQUEST',
            lead: 'Server khởi động một lần, rồi nhiều request lần lượt hoặc đồng thời đi qua cùng một heap.',
            points: [
              { title: 'Dependency singleton', detail: 'Dùng chung được nếu trạng thái bên trong an toàn và có vòng đời phù hợp.' },
              { title: 'Dữ liệu request', detail: 'tenantId, userId và kết quả tạm thuộc đúng lần gọi hiện tại.' },
              { title: 'Rủi ro', detail: 'Thuộc tính mutable trên service có thể bị request khác ghi đè khi hàm đang await.' }
            ]
          }
        },
        {
          id: 'data-bleed-trace',
          title: 'Một lần await có thể mở cửa cho request khác',
          subtitle: 'Truy vết lỗi dùng chung trạng thái',
          narration:
            'Request A ghi clinic-saigon vào thuộc tính currentClinicId rồi chờ audit service qua mạng. Khi hàm đang chờ, main thread có thể xử lý request B; B ghi clinic-hanoi vào cùng thuộc tính. Khi A chạy tiếp, nó đọc clinic-hanoi và truy vấn nhầm dữ liệu. await không khóa singleton và cũng không tạo bản sao thuộc tính. Bản sửa là dùng clinicId như biến cục bộ, truyền nó xuyên suốt lời gọi. Với ngữ cảnh cần truy cập sâu, dùng cơ chế request context được thiết kế rõ ràng thay vì biến toàn cục mutable.',
          takeaway: 'await tạo điểm nhường lịch; trạng thái dùng chung có thể bị request khác ghi trước khi hàm tiếp tục.',
          visual: {
            kind: 'timeline',
            events: [
              { time: '0 ms', actor: 'Request A', action: 'Ghi clinic-saigon lên singleton' },
              { time: '2 ms', actor: 'Request A', action: 'await audit I/O; nhường main thread' },
              { time: '3 ms', actor: 'Request B', action: 'Ghi clinic-hanoi lên cùng thuộc tính' },
              { time: '8 ms', actor: 'Request A', action: 'Tiếp tục và đọc nhầm clinic-hanoi' }
            ]
          },
          focusPlan: ['highlight', 'highlight', 'circle', 'highlight']
        },
        {
          id: 'stateless-repair',
          title: 'Giữ ngữ cảnh trong phạm vi request',
          subtitle: 'Sửa nguyên nhân thay vì tăng số lượng instance',
          narration:
            'Có thể giảm rủi ro bằng request-scoped provider nhưng việc đó làm tăng chi phí tạo và phân giải dependency. Với dữ liệu như clinicId trong ví dụ, cách đơn giản và dễ kiểm chứng nhất là truyền tham số. Service singleton vẫn dùng tốt để giữ client kết nối database, cấu hình bất biến và dependency dùng chung an toàn. Quy tắc thiết kế không phải “cấm singleton”; đó là chỉ giữ trạng thái có vòng đời dài hơn hoặc bằng service, còn dữ liệu của một request phải nằm trong context của request.',
          takeaway: 'Giữ provider singleton; truyền dữ liệu thay đổi theo request qua tham số hoặc request context.',
          visual: {
            kind: 'comparison',
            columns: [
              { title: 'Sai: mutable singleton', points: ['this.currentTenant = tenantId', 'Request A và B ghi cùng vùng nhớ', 'Có thể trả dữ liệu sai tenant'] },
              { title: 'Đúng: dữ liệu cục bộ', points: ['generateReport(tenantId)', 'Mỗi lần gọi có tham số riêng', 'Dependency hạ tầng vẫn được chia sẻ'] }
            ]
          }
        },
        {
          id: 'singleton-lifetime',
          title: 'Singleton phù hợp cho dependency, không phù hợp cho trạng thái request',
          subtitle: 'Quyết định dựa trên vòng đời dữ liệu, không dựa trên tên provider',
          narration:
            'Trong NestJS, provider mặc định có scope singleton trong vòng đời của application context. Một database pool hay client HTTP có thể được chia sẻ vì bản chất của nó là dependency dài hạn có quản lý trạng thái nội bộ theo thiết kế. Ngược lại, currentUser, tenantId, giỏ hàng của người dùng hay dữ liệu request tạm thời thuộc một lần gọi. Đặt chúng vào thuộc tính singleton làm nhiều request cùng truy cập một vị trí trên heap. Chuyển provider sang request scope có thể giải quyết một số kiểu truy cập ngầm, nhưng cũng làm lan truyền phạm vi request qua dependency graph và tăng chi phí khởi tạo/resolution. Trước khi chọn scope, mình hãy hỏi ba điều: dữ liệu sống bao lâu, ai sở hữu nó, và cần chia sẻ cho những lời gọi nào? Nếu chỉ cần một service dùng tenantId để truy vấn, truyền tenantId vào tham số là ranh giới rõ và dễ kiểm thử nhất.',
          takeaway: 'Chọn scope theo ownership và lifetime; dữ liệu request nên được truyền qua call context rõ ràng.',
          visual: {
            kind: 'comparison',
            columns: [
              { title: 'Chia sẻ an toàn', points: ['Database pool có giới hạn', 'Cấu hình bất biến', 'Client hạ tầng có lifecycle rõ'] },
              { title: 'Giữ trong request', points: ['tenantId / userId', 'Kết quả tạm của một request', 'Mutable state không được gắn lên singleton'] }
            ]
          }
        },
        {
          id: 'async-request-context',
          title: 'Truyền request context tới nơi cần dùng',
          subtitle: 'Tham số tường minh là mặc định; AsyncLocalStorage là công cụ có chủ đích',
          narration:
            'Với luồng nghiệp vụ thông thường, hãy nhận tenantId ở controller hoặc guard, xác thực nó, rồi truyền qua các hàm service tới repository. Call signature khi đó cho thấy rõ dependency của hàm và việc kiểm thử có thể cấp context giả một cách trực tiếp. Một số hệ thống logging hoặc tracing cần correlationId ở nhiều tầng mà không muốn thêm tham số vào hàng chục API. Node.js AsyncLocalStorage có thể duy trì context theo chuỗi async đã được hỗ trợ, nhưng vẫn cần khởi tạo context ở ranh giới request, tránh lưu dữ liệu mutable không liên quan và kiểm tra thư viện native/callback có bảo toàn context hay không. Đây không phải một bộ nhớ toàn cục an toàn tuyệt đối. Dù dùng cách nào, mục tiêu là mỗi request đọc đúng dữ liệu của chính nó và có test tái hiện được hai request xen kẽ.',
          takeaway: 'Dùng tham số cho dependency nghiệp vụ; dùng async context có giới hạn cho metadata xuyên suốt như trace ID.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'request-boundary', title: 'Request boundary', detail: 'Xác thực userId, tenantId, traceId' },
              { id: 'explicit-context', title: 'Tham số rõ ràng', detail: 'Truyền context theo lời gọi service' },
              { id: 'request-logging', title: 'Logging / tracing', detail: 'AsyncLocalStorage cho metadata xuyên tầng' },
              { id: 'tenant-query', title: 'Repository', detail: 'Truy vấn đúng tenant của request hiện tại' }
            ]
          }
        }
      ],
      check: {
        id: 'c1-l1-live-process-q2',
        question: 'Trong ví dụ hai request xen kẽ qua await, vì sao Request A có thể truy vấn tenant của Request B?',
        options: [
          'Vì await làm process tạo heap mới cho Request B.',
          'Vì cả hai lần gọi cùng ghi vào thuộc tính singleton.',
          'Vì biến tham số của A tự đổi theo biến môi trường.',
          'Vì database tự gộp hai transaction khác tenant.'
        ],
        correctIndex: 1,
        explanation: 'Thuộc tính service singleton nằm trên object dùng chung. Khi A đang chờ I/O, B có thể ghi đè thuộc tính; A tiếp tục và đọc giá trị mới từ B.'
      },
      explanation: 'Câu hỏi chỉ được đưa ra sau khi học viên đã xem trace xen kẽ và phương án sửa.'
    },
    {
      id: 'event-loop',
      title: 'Main thread, event loop và I/O bất đồng bộ',
      objective: 'Giải thích được vì sao Node.js đơn luồng vẫn phục vụ nhiều request đồng thời và điều gì làm nó bị block.',
      durationMinutes: 15,
      slides: [
        {
          id: 'cooperative-runtime',
          title: 'Một main thread có thể luân phiên nhiều request',
          subtitle: 'Chồng lấp thời gian chờ không đồng nghĩa chạy JavaScript song song',
          narration:
            'Node.js thường thực thi JavaScript ứng dụng trên một main thread. Khi handler gặp thao tác I/O bất đồng bộ, runtime đăng ký việc chờ với hệ điều hành hoặc libuv rồi trả quyền cho event loop. Trong thời gian socket chờ, main thread chạy callback khác đã sẵn sàng. Khi dữ liệu về, callback của request đầu được xếp để chạy tiếp. Vì vậy nhiều request có thể đang chờ đồng thời mà không cần một JavaScript thread riêng cho từng request. Nhưng hai đoạn JavaScript đồng bộ trên cùng isolate không chạy song song trên hai lõi.',
          takeaway: 'Node.js tăng concurrency bằng cách không giữ main thread trong lúc chờ I/O.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'REQUEST I/O · MAIN THREAD · CALLBACK',
            lead: 'Trong lúc libuv chờ I/O, main thread tiếp tục chạy việc khác. Khi I/O hoàn tất, callback được đưa về để chạy khi thread sẵn sàng.',
            illustration: {
              src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5dnrdqoql3sp9rw0gt1x.gif',
              alt: 'GIF minh họa JavaScript tiếp tục chạy trong khi libuv xử lý I/O, sau đó callback được đưa về event loop.',
              caption: 'Andrew Hu & Fabrizio Lallo · Node Doctors · mô hình minh họa giản lược'
            }
          }
        },
        {
          id: 'blocking-main-thread',
          title: 'Đồng bộ dài sẽ chặn tất cả callback',
          subtitle: 'Concurrency không cứu được một event loop đang bận tính toán',
          narration:
            'Nếu một callback chạy vòng lặp đồng bộ 500 mili giây, event loop không thể xử lý callback khác trong khoảng thời gian đó. Request mới vẫn có thể đến kernel và dữ liệu I/O vẫn có thể vào buffer, nhưng ứng dụng chưa có cơ hội chạy handler hoặc gửi phản hồi. Cùng nguyên tắc ấy áp dụng cho JSON parse khổng lồ, biểu thức chính quy gây backtracking hoặc tính toán CPU nặng. Tách CPU-bound work sang worker thread hay tiến trình worker; không kỳ vọng chuyển một vòng lặp nặng thành async chỉ bằng cách thêm từ khóa async.',
          takeaway: 'async không làm phép tính đồng bộ chạy nền; main thread bị chiếm thì callback của mọi request phải chờ.',
          visual: {
            kind: 'timeline',
            events: [
              { time: '0 ms', actor: 'Request A', action: 'Bắt đầu vòng lặp đồng bộ' },
              { time: '1–500 ms', actor: 'Main thread', action: 'Không trả quyền cho event loop' },
              { time: 'Trong lúc đó', actor: 'Request B', action: 'Callback sẵn sàng nhưng chưa được chạy' },
              { time: '500 ms', actor: 'Main thread', action: 'Vòng lặp xong; hàng đợi mới được xử lý' }
            ]
          }
        },
        {
          id: 'async-versus-parallel',
          title: 'Phân biệt đồng thời và song song',
          subtitle: 'Concurrency là quản lý nhiều việc; parallelism là chạy cùng thời điểm',
          narration:
            'Với I/O bất đồng bộ, runtime giữ nhiều công việc đang chờ và luân phiên xử lý phần JavaScript khi chúng sẵn sàng. Đó là concurrency. Parallelism xảy ra khi nhiều luồng hoặc process thực sự chạy trên nhiều lõi CPU cùng lúc. Libuv thread pool có thể chạy một số loại tác vụ nền, còn Worker Threads phù hợp cho JavaScript CPU-bound. Phân biệt hai khái niệm giúp chọn đúng công cụ: tăng số connection pool không làm CPU-bound code nhanh hơn; còn thêm worker cho I/O chờ mạng thường chỉ tăng phức tạp mà không tăng throughput tương ứng.',
          takeaway: 'I/O concurrency tận dụng thời gian chờ; CPU parallelism cần worker hoặc process thực thi riêng.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'PHÂN BIỆT HAI CÁCH TĂNG NĂNG LỰC',
            lead: 'Concurrency quản lý nhiều việc đang diễn ra. Parallelism thực sự chạy nhiều phép tính cùng một thời điểm.',
            points: [
              { title: 'I/O-bound', detail: 'Nhường main thread trong lúc chờ; event loop có thể chạy callback khác.' },
              { title: 'CPU-bound', detail: 'JavaScript tính liên tục thì vẫn chiếm thread; cần worker hoặc process riêng để chạy song song.' }
            ],
            question: 'Thêm Worker Threads có giúp một request chỉ đang chờ database nhanh hơn không?'
          }
        },
        {
          id: 'event-loop-turn',
          title: 'Một lượt event loop nối callback I/O với microtask',
          subtitle: 'Các phase là cách tổ chức công việc; promise callback không phải một phase ngang hàng',
          narration:
            'Trong Node.js, libuv điều phối các nhóm callback như timers, pending callbacks, poll, check và close callbacks. Khi poll nhận socket readiness, JavaScript callback được đưa vào lượt xử lý phù hợp; setImmediate thường gắn với check, còn timer chỉ đủ điều kiện chạy khi ngưỡng thời gian đạt và event loop tới điểm xử lý timer. Sau callback hiện tại, Node.js xử lý hàng đợi microtask của Promise và process.nextTick theo quy tắc runtime trước khi tiếp tục công việc khác. Không nên dạy sơ đồ phase như một lịch đồng hồ luôn giống hệt nhau: thứ tự một số callback phụ thuộc thời điểm đăng ký và phiên bản Node/libuv. Mô hình cần nhớ cho backend là callback JavaScript chạy đồng bộ tới hết; thao tác chờ I/O nhường event loop; callback đã sẵn sàng vẫn phải chờ main thread rảnh.',
          takeaway: 'I/O readiness chỉ làm callback sẵn sàng; main thread mới thực thi callback và microtask.',
          visual: {
            kind: 'cycle',
            centerLabel: 'MAIN THREAD',
            nodes: [
              { id: 'loop-poll', title: 'Poll I/O', detail: 'Kernel báo socket hoặc handle sẵn sàng' },
              { id: 'js-callback', title: 'JavaScript callback', detail: 'Chạy tới khi kết thúc hoặc nhường I/O' },
              { id: 'microtasks', title: 'Microtasks', detail: 'Promise reactions và nextTick theo quy tắc runtime' },
              { id: 'next-work', title: 'Công việc kế tiếp', detail: 'Event loop tiếp tục khi main thread được trả quyền' }
            ]
          },
        },
        {
          id: 'microtask-starvation',
          title: 'Một hàng microtask tự nối dài cũng có thể làm đói I/O',
          subtitle: 'Không chỉ vòng lặp for mới làm event loop trễ',
          narration:
            'Một callback đồng bộ rất dài là nguyên nhân rõ ràng của event-loop lag, nhưng callback ngắn lặp liên tục qua Promise hoặc process.nextTick cũng có thể giữ runtime quá lâu ở hàng ưu tiên cao. Ví dụ một tác vụ đệ quy cứ schedule microtask mới mà không nhường sang lượt I/O có thể khiến socket đã ready phải đợi. Vì vậy “mã này dùng async” không chứng minh nó thân thiện với event loop. Hãy quan sát độ trễ event loop dưới tải, tách CPU work theo lô có giới hạn, và chủ động nhường quyền khi xử lý batch lớn. Với công việc tính toán nặng, Worker Threads hoặc một worker service riêng thường phù hợp hơn; với I/O, giữ concurrency hữu hạn để downstream không bị quá tải.',
          takeaway: 'Đo thời gian chiếm main thread và nhường quyền có chủ đích; async không tự bảo đảm fairness.',
          visual: {
            kind: 'comparison',
            columns: [
              { title: 'Event loop được nhường', points: ['Callback có giới hạn thời gian', 'Batch có điểm yield', 'Socket ready được xử lý kịp'] },
              { title: 'Event loop bị đói', points: ['CPU callback quá dài', 'Microtask tự schedule liên tục', 'I/O sẵn sàng nhưng phản hồi vẫn trễ'] }
            ]
          }
        }
      ],
      check: {
        id: 'c1-l1-live-process-q3',
        question: 'Một tác vụ đồng bộ chiếm main thread 500 ms ảnh hưởng thế nào đến request khác đang chờ callback?',
        options: [
          'Callback vẫn chạy trên lõi CPU thứ hai của cùng isolate.',
          'Callback phải chờ main thread trả quyền cho event loop.',
          'Kernel hủy callback vì socket đã mở quá lâu.',
          'async tự chuyển toàn bộ JavaScript sang thread pool.'
        ],
        correctIndex: 1,
        explanation: 'JavaScript đồng bộ trên cùng isolate chiếm main thread cho đến khi hoàn tất. Callback có thể đã sẵn sàng nhưng event loop chưa thể chạy nó.'
      },
      explanation: 'Đã giảng I/O yield, block đồng bộ và concurrency/parallelism trước khi hỏi.'
    },
    {
      id: 'hardware-latency',
      title: 'Phân cấp bộ nhớ và khoảng cách độ trễ',
      objective: 'So sánh thứ tự độ trễ giữa cache, RAM, SSD và network; liên hệ với kiến trúc xử lý I/O.',
      durationMinutes: 10,
      slides: [
        {
          id: 'latency-scale',
          title: 'Dữ liệu càng xa CPU, chi phí chờ càng lớn',
          subtitle: 'Thang logarit: mỗi tầng cách nhau nhiều bậc độ lớn',
          narration:
            'Thanh ghi và cache nằm sát lõi CPU nên có độ trễ rất thấp. RAM chậm hơn cache; SSD và network lại tăng thêm các tầng điều khiển, bus, kernel và truyền dẫn. Các giá trị trong hình là xấp xỉ để so sánh bậc độ lớn, không phải cam kết cho mọi máy. Khi backend gọi database qua mạng, CPU không cần tính liên tục trong toàn bộ round trip. Thiết kế tốt tổ chức việc chờ sao cho thread có thể phục vụ công việc khác, đồng thời giữ giới hạn concurrency để không làm cạn socket, pool hoặc bộ nhớ.',
          takeaway: 'Độ trễ I/O lớn hơn nhiều so với thời gian tính toán; tối ưu hệ thống phải tính cả thời gian chờ.',
          visual: {
            kind: 'latency-scale',
            items: [
              { title: 'CPU register', latencyNs: 0.5, label: '≈ 0.5 ns' },
              { title: 'L1/L2 cache', latencyNs: 4, label: '≈ 1–4 ns' },
              { title: 'L3 cache', latencyNs: 20, label: '≈ 10–20 ns' },
              { title: 'RAM', latencyNs: 100, label: '≈ 80–100 ns' },
              { title: 'NVMe I/O', latencyNs: 100000, label: '≈ 100 μs' },
              { title: 'Network round trip', latencyNs: 40000000, label: '≈ 40 ms' }
            ]
          }
        },
        {
          id: 'latency-to-throughput',
          title: 'Vì sao thời gian chờ quyết định sức chứa?',
          subtitle: 'Dùng định luật Little để nối concurrency, throughput và latency',
          narration:
            'Định luật Little cho biết số request trung bình đang ở trong hệ thống bằng throughput nhân với thời gian lưu lại. Nếu API xử lý 2,000 request mỗi giây và mỗi request mất 50 mili giây, trung bình khoảng 100 request đang tồn tại đồng thời. Đây không phải tốc độ CPU; đó là số công việc đang chiếm tài nguyên khi chờ và chạy. Tăng thời gian truy vấn từ 50 lên 500 mili giây, trong khi throughput giữ nguyên, làm số request in-flight tăng gấp mười. Khi tính capacity, phải cộng bộ nhớ request, socket, buffer, pool và giới hạn downstream.',
          takeaway: 'Số request in-flight tăng theo throughput × latency; latency cao làm phình tài nguyên đồng thời.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'CÔNG THỨC SỨC CHỨA · ĐỊNH LUẬT LITTLE',
            lead: 'L = λ × W',
            points: [
              { title: 'L', detail: 'Số request trung bình đang nằm trong hệ thống.' },
              { title: 'λ', detail: 'Throughput, tính bằng request mỗi giây.' },
              { title: 'W', detail: 'Thời gian một request ở trong hệ thống, đổi về giây.' }
            ],
            question: 'Nếu λ không đổi nhưng W tăng gấp mười, số request in-flight thay đổi thế nào?'
          }
        },
        {
          id: 'little-law-worked-example',
          title: 'Tính nhanh số request đang nằm trong hệ thống',
          subtitle: 'Throughput × thời gian lưu lại = concurrency trung bình',
          narration:
            'Mình làm phép tính có đơn vị để tránh dùng công thức như một khẩu hiệu. Nếu hệ thống hoàn tất trung bình hai nghìn request mỗi giây và thời gian một request ở trong hệ thống là năm mươi mili giây, đổi thời gian thành 0,05 giây rồi tính 2.000 request/giây nhân 0,05 giây được khoảng 100 request. Nếu thời gian tăng thành 500 mili giây trong khi throughput và tải ổn định, con số trung bình thành khoảng 1.000 request. Đây là số trung bình trong một cửa sổ ổn định, không phải giới hạn peak hay số thread cần tạo. Khi service chờ database, request in-flight còn giữ tham chiếu object, socket, timeout và đôi khi slot connection pool. Vì vậy latency downstream có thể biến thành memory pressure và queueing trước khi CPU utilization cao.',
          takeaway: 'Dùng L = λW cùng đơn vị nhất quán để ước lượng concurrency; sau đó tính tài nguyên được giữ bởi mỗi request.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'rate', title: '2.000 req/s', detail: 'Arrival/completion rate ổn định' },
              { id: 'wait-50', title: '× 0,05 s', detail: '50 ms latency → khoảng 100 request in-flight' },
              { id: 'wait-500', title: '× 0,5 s', detail: '500 ms latency → khoảng 1.000 request in-flight' },
              { id: 'capacity-cost', title: 'Tài nguyên', detail: 'Socket, object, timeout, pool và queue' }
            ]
          },
        },
        {
          id: 'latency-waterfall',
          title: 'P95 là tổng thời gian ở nhiều chặng, không chỉ thời gian CPU',
          subtitle: 'Tách queue, ứng dụng, database và network bằng trace',
          narration:
            'Một request có thể mất tổng cộng 480 mili giây nhưng chỉ dùng CPU trong vài mili giây. Ví dụ 120 mili giây chờ được nhận vào worker, 4 mili giây chạy middleware và business logic, 330 mili giây chờ database, phần còn lại nằm ở network và serialization. Đây là một trace minh họa, không phải con số chuẩn cho mọi hệ thống. Nếu chỉ nhìn CPU, mình sẽ thấy máy còn rảnh và không hiểu vì sao người dùng chờ. Phân rã latency theo span giúp xác định request chờ ở hàng đợi, pool hay downstream. P95 còn nhạy với phân phối và tail latency; trung bình thấp không loại trừ một nhóm request bị chậm kéo đuôi. Khi nhận sự cố, cần so sánh p50/p95/p99, request rate, queue depth và thời gian của từng dependency.',
          takeaway: 'Đo latency theo từng span và percentile; tổng thời gian request không đồng nghĩa thời gian CPU.',
          visual: {
            kind: 'timeline',
            events: [
              { time: '120 ms', actor: 'Ingress queue', action: 'Request chờ slot xử lý' },
              { time: '4 ms', actor: 'Node.js', action: 'Middleware và business logic dùng CPU' },
              { time: '330 ms', actor: 'Database', action: 'Query và chờ phản hồi downstream' },
              { time: '26 ms', actor: 'Network / encode', action: 'Truyền và serialize phản hồi' }
            ]
          }
        }
      ],
      check: {
        id: 'c1-l1-live-process-q4',
        question: 'Nếu throughput giữ nguyên nhưng latency tăng gấp 10, số request in-flight trung bình thay đổi ra sao?',
        options: [
          'Giảm 10 lần vì request xử lý ít CPU hơn.',
          'Không đổi vì throughput không thay đổi.',
          'Tăng xấp xỉ 10 lần theo định luật Little.',
          'Tăng theo bình phương của latency.'
        ],
        correctIndex: 2,
        explanation: 'Định luật Little là L = λW: số request trung bình trong hệ thống bằng arrival/throughput rate nhân thời gian lưu lại. Giữ λ không đổi và tăng W 10 lần thì L cũng tăng 10 lần.'
      },
      explanation: 'Học viên đã thấy thang độ trễ và áp dụng L = λW trước câu kiểm tra.'
    },
    {
      id: 'c10k',
      title: 'C10K và I/O multiplexing',
      objective: 'Giải thích được giới hạn của thread-per-connection và cách kernel báo socket sẵn sàng.',
      durationMinutes: 17,
      slides: [
        {
          id: 'thread-per-connection-cost',
          title: '10.000 connection không đồng nghĩa cần 10.000 thread',
          subtitle: 'Chi phí stack và context switching tăng theo số thread',
          narration:
            'Mô hình thread-per-connection cấp một thread cho mỗi kết nối. Nếu mỗi thread dành xấp xỉ 1.5 MB cho user stack, 10,000 thread tương ứng khoảng 15 GB không gian stack được reserve/commit tùy cấu hình và hệ điều hành. Con số này là phép ước lượng minh họa, không phải mức cố định của Linux. Ngoài stack, kernel còn giữ cấu trúc thread và scheduler phải quản lý runnable threads. Khi nhiều thread tranh một số lõi nhỏ, chuyển đổi ngữ cảnh và cache disruption tăng. Nút thắt là chi phí quản lý các connection chủ yếu đang chờ, không phải mỗi connection cần một lõi CPU.',
          takeaway: 'Thread-per-connection gắn chi phí thực thi và quản lý với cả connection đang chờ.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'ƯỚC LƯỢNG TÀI NGUYÊN · THREAD-PER-CONNECTION',
            lead: 'Nhiều connection chỉ đang chờ I/O, nhưng mô hình cũ vẫn gắn với chúng nhiều thread và stack.',
            points: [
              { title: 'Phép tính minh họa', detail: 'Nếu mỗi stack reserve 1 MiB, 10.000 thread cần khoảng 10 GiB không gian địa chỉ cho stack.' },
              { title: 'Không đồng nghĩa với RSS', detail: 'Stack được reserve không có nghĩa toàn bộ số byte đã nằm trong RAM; cấu hình và hệ điều hành làm con số thực tế thay đổi.' },
              { title: 'Chi phí khác', detail: 'Scheduler quản lý nhiều thread; runnable thread tranh CPU và làm tăng context switching.' }
            ],
            note: 'Ước lượng 1 MiB chỉ để minh họa cách nhân; hãy đo cấu hình stack thật của môi trường.'
          }
        },
        {
          id: 'multiplexing',
          title: 'I/O multiplexing: theo dõi nhiều socket, nhận danh sách sẵn sàng',
          subtitle: 'epoll, kqueue và IOCP là cơ chế theo dõi sự kiện của hệ điều hành',
          narration:
            'I/O multiplexing cho phép một event loop đăng ký nhiều socket rồi đợi kernel báo những socket đã sẵn sàng. Trên Linux, epoll giữ tập interest và ready list trong kernel; epoll_wait trả về các sự kiện sẵn sàng thay vì ứng dụng phải quét toàn bộ danh sách ở mỗi vòng. kqueue là cơ chế tương ứng phổ biến trên BSD và macOS; Windows có IOCP với mô hình completion khác. Cần nói chính xác: không phải mọi thao tác I/O đều O(1), cũng không phải epoll làm request hoàn tất nhanh hơn. Nó giảm cách ứng dụng phải quản lý hàng loạt connection đang chờ bằng thread riêng.',
          takeaway: 'Kernel theo dõi readiness; event loop chỉ xử lý socket có sự kiện cần phục vụ.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'register', title: 'Register FD', detail: 'Ứng dụng đăng ký socket' },
              { id: 'kernel', title: 'Kernel watches', detail: 'Theo dõi readiness của nhiều FD' },
              { id: 'ready', title: 'Ready list', detail: 'Chỉ các socket có sự kiện' },
              { id: 'callback', title: 'Callback', detail: 'Event loop tiếp tục xử lý' }
            ]
          },
        },
        {
          id: 'poll-vs-epoll-architecture',
          title: '50.000 socket nhưng chỉ 10 socket có dữ liệu mới',
          subtitle: 'So sánh chi phí quét readiness với vòng chờ sự kiện của kernel',
          narration:
            'Ta quay lại sơ đồ mở đầu và đi sâu vào luồng hệ điều hành. Với poll, ứng dụng gửi một danh sách descriptor cần theo dõi; kernel kiểm tra danh sách trong lần gọi và trả trạng thái. Lặp lại việc quét danh sách lớn có thể tạo chi phí tăng theo số descriptor được xét, dù phần lớn chưa sẵn sàng. epoll cho phép đăng ký tập interest vào kernel rồi chờ epoll_wait; kernel duy trì trạng thái theo dõi và trả một tập event sẵn sàng để ứng dụng xử lý. Nếu năm mươi nghìn socket mở mà chỉ mười socket có dữ liệu, event loop có thể tập trung vào số event vừa nhận thay vì giao một JavaScript thread cho từng kết nối. Đây là cách mô tả hướng xử lý, không phải lời hứa rằng mọi hoạt động epoll luôn O(1): chi phí thực tế phụ thuộc số event, cách cập nhật interest, kernel và workload. kqueue và IOCP có mô hình API riêng, không nên coi chúng là cùng một triển khai chỉ khác tên.',
          takeaway: 'poll gửi danh sách cần kiểm tra mỗi lượt; epoll theo dõi interest trong kernel và trả event readiness.',
          visual: {
            kind: 'architecture-comparison',
            left: {
              title: 'MÔ HÌNH CŨ · POLL DANH SÁCH',
              subtitle: 'Kiểm tra tập FD lặp lại khi chờ',
              steps: [
                { id: 'poll-submit', title: 'Gửi danh sách', detail: 'Ứng dụng chuyển tập FD cần theo dõi' },
                { id: 'poll-scan', title: 'Kernel kiểm tra N', detail: 'Quét các descriptor trong danh sách' },
                { id: 'poll-idle', title: '49.990 đang chờ', detail: 'Phần lớn không có event mới ở lượt này' },
                { id: 'poll-repeat', title: 'Gửi lại', detail: 'Lặp lại khi event loop chờ lượt tiếp' }
              ]
            },
            right: {
              title: 'MÔ HÌNH HIỆN ĐẠI · EPOLL',
              subtitle: 'Kernel trả nhóm descriptor đã sẵn sàng',
              steps: [
                { id: 'epoll-register', title: 'Đăng ký interest', detail: 'Thêm FD và loại event cần nhận' },
                { id: 'epoll-watch', title: 'Kernel theo dõi', detail: 'Readiness được cập nhật khi socket đổi trạng thái' },
                { id: 'epoll-ready', title: '10 FD ready', detail: 'epoll_wait trả tập event cần xử lý' },
                { id: 'epoll-dispatch', title: 'Dispatch event', detail: 'Callback xử lý rồi quay lại chờ' }
              ]
            },
            bridge: '50.000 kết nối đang mở, 10 sự kiện mới: event loop làm việc với tập readiness vừa được kernel báo.'
          },
        },
        {
          id: 'socket-event-trace',
          title: 'Một socket đi từ chờ đến callback',
          subtitle: 'Truy vết luồng sự kiện thay cho một thread ngủ trên mỗi connection',
          narration:
            'Khi socket chưa có dữ liệu, event loop không cần chạy vòng lặp JavaScript liên tục để hỏi nó. Runtime đăng ký quan tâm với backend I/O. NIC nhận packet, kernel cập nhật buffer và đánh dấu socket sẵn sàng. Khi event loop chờ trong epoll_wait được đánh thức, runtime lấy sự kiện rồi gọi callback tương ứng. Callback chạy JavaScript trên main thread; nếu nó xử lý CPU quá lâu thì lại block các callback khác. Multiplexing giải quyết hiệu quả quản lý I/O chờ, không loại bỏ nhu cầu viết callback ngắn và có backpressure.',
          takeaway: 'Readiness đánh thức event loop; callback vẫn chạy trên main thread và cần giữ ngắn.',
          visual: {
            kind: 'timeline',
            events: [
              { time: '1', actor: 'Node/libuv', action: 'Đăng ký FD với kernel' },
              { time: '2', actor: 'Socket', action: 'Chờ dữ liệu; không cần JS thread riêng' },
              { time: '3', actor: 'Kernel/NIC', action: 'Packet đến; FD chuyển sang ready' },
              { time: '4', actor: 'Event loop', action: 'Callback được gọi để xử lý dữ liệu' }
            ]
          },
        },
        {
          id: 'connection-capacity-limits',
          title: 'epoll không gỡ hết mọi giới hạn của một server',
          subtitle: 'Một kết nối vẫn chiếm FD, kernel memory và năng lực downstream',
          narration:
            'I/O multiplexing giảm cách ứng dụng phải chờ từng socket, nhưng mỗi kết nối vẫn cần một file descriptor, trạng thái TCP, buffer kernel và một phần bộ nhớ trong ứng dụng. Server còn chịu giới hạn file descriptor của process, giới hạn memory của container, backlog lúc accept, giới hạn connection pool và năng lực database. Nếu tăng số connection tối đa mà không giới hạn request đang chạy, một đợt tải có thể chuyển từ thiếu thread sang cạn memory hoặc làm database quá tải. Backpressure là tín hiệu để tạm ngừng đọc hoặc giảm nhận thêm công việc khi consumer phía sau chưa theo kịp. Capacity planning cần đo cả kết nối mở, request in-flight và queue downstream; “epoll hỗ trợ nhiều FD” không có nghĩa máy vô hạn tài nguyên.',
          takeaway: 'Multiplexing tối ưu cách chờ; FD, memory, pool, backlog và downstream vẫn phải có ngân sách.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'fd-limit', title: 'Process limit', detail: 'ulimit / descriptor table' },
              { id: 'kernel-cost', title: 'Kernel TCP state', detail: 'Socket buffer và trạng thái kết nối' },
              { id: 'app-inflight', title: 'Application in-flight', detail: 'Object request, timeout và queue' },
              { id: 'downstream-pool', title: 'Downstream', detail: 'DB pool, rate limit và backpressure' }
            ]
          },
        }
      ],
      check: {
        id: 'c1-l1-live-process-q5',
        question: 'epoll giúp giảm loại chi phí nào trong máy chủ nhiều kết nối đang chờ?',
        options: [
          'Xóa hoàn toàn độ trễ truyền dẫn của mạng.',
          'Bắt buộc cấp một thread cho từng socket.',
          'Theo dõi socket readiness mà không quét toàn bộ bằng một thread mỗi socket.',
          'Chạy callback JavaScript song song trên mọi lõi CPU.'
        ],
        correctIndex: 2,
        explanation: 'epoll cho phép kernel quản lý tập file descriptor quan tâm và trả các sự kiện sẵn sàng cho event loop. Nó không xóa latency mạng, không cấp thread cho mỗi socket và không tự chạy JavaScript song song.'
      },
      explanation: 'Câu hỏi đặt sau khi đã giải thích stack/thread cost, readiness và callback trace.'
    },
    {
      id: 'process-memory',
      title: 'RSS, V8 heap và bộ nhớ ngoài',
      objective: 'Phân biệt các vùng bộ nhớ để chọn đúng chỉ số và dấu hiệu khi chẩn đoán process tăng RAM.',
      durationMinutes: 11,
      slides: [
        {
          id: 'memory-regions',
          title: 'RSS là phần trang nhớ đang nằm trong RAM',
          subtitle: 'HeapUsed chỉ là một phần của footprint process',
          narration:
            'RSS, resident set size, ước lượng số trang của process hiện đang cư trú trong RAM. process.memoryUsage().heapUsed đo phần V8 heap đang được object sử dụng; heapTotal là vùng heap V8 đã cấp; external ghi nhận bộ nhớ native gắn với object JavaScript, ví dụ một số Buffer; arrayBuffers là phần backing store của ArrayBuffer và Buffer. RSS còn có thể gồm code, stack, native allocations và các vùng khác. Vì vậy RSS tăng mà heapUsed ổn định không tự động chứng minh có JavaScript object leak. Cần đọc nhiều chỉ số theo thời gian và đối chiếu workload.',
          takeaway: 'RSS phản ánh footprint process; heapUsed không bao gồm toàn bộ RAM mà process chiếm.',
          visual: {
            kind: 'memory-map',
            regions: [
              { id: 'heap', title: 'V8 heap', detail: 'heapUsed / heapTotal' },
              { id: 'external', title: 'External', detail: 'Native memory gắn với object JS' },
              { id: 'stack', title: 'Stack & code', detail: 'Call stack, runtime và mã thực thi' },
              { id: 'rss', title: 'RSS', detail: 'Tập hợp trang process đang ở RAM' }
            ]
          }
        },
        {
          id: 'memory-trend',
          title: 'Đọc xu hướng sau garbage collection',
          subtitle: 'Một snapshot không đủ để kết luận memory leak',
          narration:
            'HeapUsed dao động trong lúc ứng dụng cấp phát object rồi GC thu hồi object không còn reachable. Nếu baseline sau các chu kỳ GC tăng liên tục dưới workload lặp lại, có thể còn reference giữ dữ liệu sống. Nếu heap ổn định nhưng RSS tăng, điều tra native memory, buffer, allocator fragmentation, thread stack hoặc cache của thư viện. So sánh cùng tải, cùng thời gian và cùng loại traffic; ghi nhận cả heapUsed, external, arrayBuffers và RSS. Đừng đặt ngưỡng OOM chỉ theo heap limit vì container bị giới hạn theo tổng memory của process.',
          takeaway: 'Leak được nhận diện qua xu hướng baseline và reference còn sống; không chỉ qua một đỉnh RSS.',
          visual: {
            kind: 'comparison',
            columns: [
              { title: 'Heap tăng sau GC', points: ['Object còn reachable', 'Kiểm tra cache, listener, closure', 'Heap snapshot giúp tìm retainers'] },
              { title: 'RSS tăng, heap ổn định', points: ['External/native memory', 'Buffer, stack hoặc fragmentation', 'Đối chiếu external và arrayBuffers'] }
            ]
          }
        },
        {
          id: 'memory-metric-triage',
          title: 'Đọc các chỉ số bộ nhớ cùng một thời điểm',
          subtitle: 'Tách object còn sống khỏi buffer và vùng native',
          narration:
            'Node.js process.memoryUsage trả về một số góc nhìn có liên quan nhưng không cộng chúng lại để thành RSS. heapUsed là phần V8 heap đang dùng bởi object; heapTotal là vùng heap đã cấp cho V8. external là bộ nhớ native được gắn với object JavaScript, còn arrayBuffers cho biết backing store của ArrayBuffer và Buffer; phần này có mối quan hệ với external nên không được cộng máy móc hai lần. RSS là footprint trang cư trú của process và có thể tăng do code, stack, thư viện native, allocator hoặc memory mapping. Hãy lấy mẫu đồng thời theo thời gian rồi ghép với tải, số connection và GC. Nếu heapUsed sau GC ổn định nhưng external tăng cùng số Buffer còn giữ, điều tra vòng đời buffer. Nếu chỉ RSS dao động sau một peak nhưng baseline ổn định, fragmentation hoặc allocator behavior có thể là giả thuyết cần kiểm chứng, chưa phải kết luận leak.',
          takeaway: 'So sánh các chuỗi chỉ số theo cùng timestamp và tải; tránh cộng các metric có phạm vi chồng lấp.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'ĐỌC METRIC · KHÔNG CỘNG MÁY MÓC',
            lead: 'Mỗi chỉ số trả lời một câu hỏi khác nhau về footprint của process.',
            points: [
              { title: 'heapUsed', detail: 'Object đang được V8 sử dụng; so baseline sau các chu kỳ GC.' },
              { title: 'external / arrayBuffers', detail: 'Bộ nhớ native và backing store của Buffer; phạm vi có thể chồng lấp.' },
              { title: 'RSS', detail: 'Các trang của process đang cư trú trong RAM, gồm cả nhiều vùng ngoài V8 heap.' }
            ],
            question: 'Nếu RSS tăng còn heapUsed sau GC ổn định, mình sẽ đo tiếp vùng nào?'
          }
        },
        {
          id: 'container-memory-budget',
          title: 'Giới hạn container áp dụng lên process, không chỉ V8 heap',
          subtitle: 'Heap limit thấp hơn cgroup limit để chừa ngân sách cho native memory',
          narration:
            'Trong container, cgroup memory limit thường giới hạn tổng memory mà workload được phép dùng theo cấu hình runtime. V8 heap chỉ là một phần; thread stack, Buffer backing store, TLS, native dependency, code và page cache liên quan cũng góp vào footprint. Nếu đặt max-old-space-size gần bằng memory limit, process có thể bị kernel hoặc nền tảng container kết thúc trước khi V8 phát ra lỗi heap out of memory. Ngược lại, hạ heap limit quá thấp gây GC thường xuyên và giảm throughput. Nên dùng ngân sách có biên an toàn, theo dõi RSS cùng heap và external, kiểm tra trạng thái OOMKilled của container, rồi load test gần với giới hạn vận hành. Giới hạn thực tế còn phụ thuộc cách triển khai và phiên bản Node, nên phải kiểm chứng trên image production.',
          takeaway: 'Đặt heap budget bên trong tổng ngân sách container và dành phần còn lại cho native, stack, buffer và runtime.',
          visual: {
            kind: 'comparison',
            columns: [
              { title: 'V8 heap budget', points: ['Object JavaScript', 'Garbage collection', 'Heap snapshot và retainers'] },
              { title: 'Container memory budget', points: ['RSS toàn process', 'External, Buffer, native và stack', 'OOM kill ở ranh giới cgroup'] }
            ]
          }
        }
      ],
      check: {
        id: 'c1-l1-live-process-q6',
        question: 'RSS tăng còn heapUsed ổn định thì kết luận kỹ thuật hợp lý nhất là gì?',
        options: [
          'Chắc chắn không có vấn đề bộ nhớ vì heap không đổi.',
          'Chắc chắn là leak object JavaScript trong V8 heap.',
          'Cần kiểm tra external/native memory và các vùng ngoài heap.',
          'Garbage collector đã dừng hoạt động vĩnh viễn.'
        ],
        correctIndex: 2,
        explanation: 'RSS bao gồm nhiều vùng ngoài V8 heap. Khi RSS và heapUsed lệch xu hướng, cần kiểm tra external, arrayBuffers, stack, native allocation và fragmentation trước khi quy kết nguyên nhân.'
      },
      explanation: 'Học viên đã được dạy cách map memoryUsage metrics và đọc xu hướng sau GC.'
    },
    {
      id: 'production-application',
      title: 'Áp dụng mô hình vào sự cố production',
      objective: 'Kết nối concurrency, event loop, upstream latency và memory thành một quy trình chẩn đoán.',
      durationMinutes: 13,
      slides: [
        {
          id: 'incident-diagnostic',
          title: 'Khi p95 tăng, lần theo hàng đợi trước khi tăng máy',
          subtitle: 'Tách CPU-bound, I/O-bound và cạn tài nguyên',
          narration:
            'Giả sử p95 tăng từ 80 lên 900 mili giây. Trước tiên xem CPU và event-loop lag: CPU cao cùng lag cao gợi ý callback đồng bộ nặng hoặc GC pressure. Nếu CPU thấp nhưng request in-flight và latency database tăng, hệ thống có thể đang chờ downstream; kiểm tra pool, timeout, queueing và backpressure. Nếu RSS tăng dần, so sánh heapUsed với external sau GC. Những chỉ số này giúp phân loại cơ chế trước khi chọn hành động: tối ưu code CPU, giới hạn concurrency, sửa query, hoặc tìm reference giữ object. Một dashboard chỉ có CPU percentage chưa đủ giải thích tình trạng API.',
          takeaway: 'Chọn hướng xử lý theo dấu hiệu của queue, event loop, downstream latency và từng vùng memory.',
          visual: {
            kind: 'flow',
            nodes: [
              { id: 'p95', title: 'p95 tăng', detail: 'Xác nhận phạm vi và thời điểm' },
              { id: 'cpu', title: 'CPU / event loop', detail: 'Tìm callback hoặc GC pressure' },
              { id: 'io', title: 'I/O / in-flight', detail: 'Kiểm tra downstream, pool, backpressure' },
              { id: 'memory', title: 'RSS / heap / external', detail: 'Tách leak heap khỏi native memory' }
            ]
          }
        },
        {
          id: 'lesson-recap',
          title: 'Bản đồ nguyên nhân và công cụ',
          subtitle: 'Từ process đến triệu chứng vận hành',
          narration:
            'Mình nối lại toàn bộ mạch học. Hệ điều hành tạo process và lập lịch thread. Runtime JavaScript xử lý trên main thread; I/O bất đồng bộ cho phép event loop tiến hành công việc khác trong lúc chờ. Kernel multiplex socket readiness để phục vụ nhiều connection mà không gắn một JavaScript thread cho mỗi socket. Dữ liệu request không được đặt lên singleton mutable vì process sống lâu và heap được chia sẻ. Cuối cùng, RSS, heapUsed và external trả lời những câu hỏi khác nhau khi điều tra bộ nhớ. Bây giờ bạn đã có mô hình để đọc một sự cố, không chỉ thuộc tên epoll hay event loop.',
          takeaway: 'Process → runtime → I/O → memory: mỗi tầng tạo một nhóm giới hạn và một nhóm tín hiệu chẩn đoán.',
          visual: {
            kind: 'text-slide',
            eyebrow: 'TỔNG HỢP · MỘT MÔ HÌNH, BỐN TẦNG',
            lead: 'Triệu chứng production có thể lần ngược qua các tầng thực thi để tìm nơi đang giữ thời gian hoặc tài nguyên.',
            points: [
              { title: 'Process và thread', detail: 'Ai sở hữu tài nguyên? Thread nào đang thực thi?' },
              { title: 'Runtime và event loop', detail: 'Main thread đang chạy CPU hay đang nhường lúc chờ I/O?' },
              { title: 'Kernel và socket', detail: 'Socket nào ready, queue nào đang tích tụ?' },
              { title: 'Memory', detail: 'Heap, external hay RSS đang tăng theo tải?' }
            ]
          }
        },
        {
          id: 'guided-production-case',
          title: 'Ca thực hành: p95 tăng, CPU thấp, RSS đi lên',
          subtitle: 'Xây giả thuyết theo bằng chứng thay vì chọn một nút bấm tăng tài nguyên',
          narration:
            'Mình dùng một sự cố giả định để nối tất cả mô hình. API p95 tăng từ 90 lên 850 mili giây; CPU 35%; database span tăng từ 45 lên 420 mili giây; request in-flight tăng gấp tám; RSS tăng từ 900 MB lên 1,5 GB nhưng heapUsed sau GC gần như đi ngang. Trước hết, không kết luận CPU thiếu hay JavaScript heap leak. Bằng chứng hiện nghiêng về chờ downstream và tích tụ request; RSS cần tách external, buffer, stack và native memory. Mình kiểm tra pool wait time, queue depth, timeout, số socket và kích thước response, sau đó giới hạn concurrency hoặc trả lỗi sớm nếu database không thể nhận thêm. Đồng thời truy trace để xác nhận database span giải thích được p95. Khi tải giảm, so sánh baseline memory sau GC. Bạn hãy nói thành tiếng giả thuyết ưu tiên, metric cần lấy tiếp và thay đổi an toàn nhất; rồi mới xem đáp án ở câu kiểm tra cuối.',
          takeaway: 'Tạo giả thuyết từ nhiều tín hiệu, chọn phép đo phân biệt chúng, rồi mới can thiệp có kiểm soát.',
          visual: {
            kind: 'timeline',
            events: [
              { time: 'p95 850 ms', actor: 'Triệu chứng', action: 'Định vị endpoint và thời điểm bắt đầu' },
              { time: 'CPU 35%', actor: 'Runtime', action: 'Kiểm tra event-loop lag trước khi tăng CPU' },
              { time: 'DB 420 ms', actor: 'Downstream', action: 'Đối chiếu pool wait, trace và queue' },
              { time: 'RSS ↑ / heap ổn', actor: 'Memory', action: 'Tách external/buffer khỏi heap leak' }
            ]
          }
        },
        {
          id: 'diagnostic-decision-order',
          title: 'Thứ tự chẩn đoán giúp tránh sửa nhầm tầng',
          subtitle: 'Triệu chứng → giả thuyết → phép đo phân biệt → thay đổi có kiểm soát',
          narration:
            'Một quy trình tốt không bắt đầu bằng “thêm instance” hay “tăng heap”. Nó bắt đầu bằng phạm vi ảnh hưởng, thời điểm và percentile. Nếu CPU cùng event-loop lag cao, lấy profile để tìm callback đồng bộ, GC pause và hot path. Nếu CPU thấp nhưng thời gian span database hoặc pool wait cao, kiểm tra downstream, concurrency và queue. Nếu RSS tăng, tách heapUsed, external, arrayBuffers, thread count và giới hạn container qua cùng mốc thời gian. Chọn một thay đổi giới hạn, ví dụ giảm concurrency hoặc khôi phục pool configuration, rồi theo dõi cùng tập metric để xác nhận tác động và rollback nếu xấu đi. Một thay đổi duy nhất giúp kết quả quan sát có ý nghĩa hơn một loạt tuning đồng thời.',
          takeaway: 'Mỗi can thiệp production phải gắn với một giả thuyết có thể bị dữ liệu bác bỏ.',
          visual: {
            kind: 'decision-tree',
            rootTitle: 'P95 tăng: tầng nào đang giữ request?',
            rootSubtitle: 'Chọn giả thuyết theo metric đi cùng nhau',
            tradeoff: 'Một thay đổi mỗi lần; đo lại rồi giữ hoặc rollback',
            branches: [
              {
                condition: 'CPU và event-loop lag cùng cao',
                outcome: { id: 'cpu-profile', title: 'Profile callback / GC', detail: 'Tách CPU-bound work khỏi main thread' },
                tone: 'recommended'
              },
              {
                condition: 'CPU thấp, DB span hoặc pool wait cao',
                outcome: { id: 'downstream-check', title: 'Kiểm tra downstream', detail: 'Pool, queue, timeout và backpressure' },
                tone: 'neutral'
              },
              {
                condition: 'RSS tăng, heap sau GC ổn định',
                outcome: { id: 'native-memory', title: 'Đo vùng ngoài heap', detail: 'External, Buffer, stack và native memory' },
                tone: 'tradeoff'
              }
            ]
          }
        }
      ],
      check: {
        id: 'c1-l1-live-process-q7',
        question: 'CPU thấp, database latency và request in-flight cùng tăng. Hướng kiểm tra đầu tiên hợp lý nhất là gì?',
        options: [
          'Tăng heap limit để main thread chạy nhanh hơn.',
          'Kiểm tra downstream, pool, timeout và backpressure.',
          'Chuyển toàn bộ request sang Worker Threads.',
          'Tăng số thread cho từng socket đang chờ.'
        ],
        correctIndex: 1,
        explanation: 'CPU thấp trong khi database latency và in-flight cùng tăng phù hợp với nghẽn chờ downstream hoặc queueing. Cần kiểm tra giới hạn pool, timeout và backpressure trước khi tăng tài nguyên mù quáng.'
      },
      explanation: 'CPU thấp đi cùng database latency và số request in-flight tăng cho thấy nhiều công việc đang chờ downstream hoặc queue. Kiểm tra pool, timeout và backpressure sẽ giúp xác định điểm nghẽn.'
    }
  ],
  closing: {
    id: 'closing-model',
    title: 'Quay lại câu hỏi 50.000 kết nối',
    subtitle: 'Từ câu hỏi vận hành đến cơ chế bên dưới',
    narration:
      'Giờ mình quay lại tình huống mở đầu. Năm mươi nghìn kết nối không tự động có nghĩa cần năm mươi nghìn thread JavaScript chạy liên tục. Mình cần biết kết nối nào có readiness, event loop có đang bị callback CPU dài chặn hay không, và khi request tăng thì latency downstream làm số công việc in-flight phình ra thế nào. Nếu máy chậm, mình phân biệt CPU với thời gian chờ; nếu memory tăng, mình so sánh heapUsed, external và RSS cùng một mốc tải. Đây là mô hình để đặt giả thuyết, không phải công thức thay cho benchmark. Trước khi kết thúc, thử trả lời câu hỏi ban đầu bằng cơ chế kernel readiness và nói thêm một metric bạn sẽ đo để kiểm chứng server của mình.',
    takeaway: 'Đáp án phải nối được readiness, event loop, tài nguyên đang chờ và metric production.',
    visual: {
      kind: 'text-slide',
      eyebrow: 'TỰ GIẢI THÍCH LẠI · CHƯA CẦN THUỘC TÊN API',
      lead: 'Một kết nối đang mở có nhất thiết phải chiếm một thread đang chạy không?',
      points: [
        { title: 'Nói cơ chế', detail: 'Giải thích kernel readiness đưa socket có sự kiện tới runtime như thế nào.' },
        { title: 'Nối vận hành', detail: 'Chỉ ra metric giúp phân biệt CPU-bound, chờ I/O và memory pressure.' }
      ],
      question: 'Với server của mình, tín hiệu đầu tiên nào sẽ giúp kiểm chứng giả thuyết?'
    }
  }
};
