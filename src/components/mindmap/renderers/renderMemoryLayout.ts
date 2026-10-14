import { escapeHtml } from '../../common/CodeViewer.tsx';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renderer: Sơ Đồ Phân Vùng Bộ Nhớ Vật Lý RSS (Memory Architecture Widget)
 */
export function renderMemoryLayout(_text: string, title?: string): string {
  const displayTitle = stripEmojis(title || '') || 'PHÂN VÙNG BỘ NHỚ RESIDENT SET SIZE (RSS) CỦA TIẾN TRÌNH';

  return `
    <div class="mindmap-container mindmap-memory-layout">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
          </span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-memory">MEMORY ARCHITECTURE</span>
      </div>
      <div class="mindmap-body">
        <div class="memory-rss-wrapper">
          <div class="memory-rss-banner">
            <div class="rss-banner-left">
              <span class="rss-tag">RESIDENT SET SIZE (RSS)</span>
              <span class="rss-desc">Tổng dung lượng RAM vật lý hệ điều hành cấp phát cho tiến trình Node.js</span>
            </div>
            <div class="rss-banner-right">
              <code>process.memoryUsage().rss</code>
            </div>
          </div>

          <div class="memory-zones-grid">
            <!-- VÙNG 1: V8 HEAP SPACE -->
            <div class="memory-zone-card zone-heap">
              <div class="zone-card-header header-heap">
                <span class="zone-icon">01</span>
                <div>
                  <div class="zone-title">V8 HEAP SPACE</div>
                  <div class="zone-sub">Vùng nhớ động quản lý bởi V8 Garbage Collector</div>
                </div>
              </div>
              <div class="zone-sub-cards">
                <div class="zone-sub-card sub-young">
                  <div class="sub-card-title">
                    <span>Young Generation</span>
                    <span class="sub-pill pill-fast">~1ms Scavenge</span>
                  </div>
                  <div class="sub-algo">Thuật toán Scavenge (From / To Space)</div>
                  <div class="sub-detail">Nơi cấp phát ban đầu của hầu hết Objects. Thu gom rác nhanh, các đối tượng sống qua 2 chu kỳ GC sẽ chuyển sang Old Generation.</div>
                </div>

                <div class="zone-sub-card sub-old">
                  <div class="sub-card-title">
                    <span>Old Generation</span>
                    <span class="sub-pill pill-heavy">Tốn CPU</span>
                  </div>
                  <div class="sub-algo">Thuật toán Mark-Sweep-Compact</div>
                  <div class="sub-detail">Chứa Singletons, Closures và dữ liệu cache dài hạn. Quét dọn tốn chu kỳ CPU và có nguy cơ gây Stop-The-World nếu rò rỉ bộ nhớ.</div>
                </div>
              </div>
            </div>

            <!-- VÙNG 2: V8 STACK SPACE -->
            <div class="memory-zone-card zone-stack">
              <div class="zone-card-header header-stack">
                <span class="zone-icon">02</span>
                <div>
                  <div class="zone-title">V8 STACK SPACE</div>
                  <div class="zone-sub">Ngăn xếp thực thi hàm theo cơ chế LIFO</div>
                </div>
              </div>
              <div class="zone-features-list">
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Call Frames (Ngăn xếp gọi hàm):</strong>
                    <span>Lưu ngữ cảnh hàm đang thực thi, tự động giải phóng khi hàm return.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Biến nguyên thủy (Primitives):</strong>
                    <span>Number, Boolean, BigInt, Symbol được lưu giá trị trực tiếp trên Stack.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Con trỏ tham chiếu (Pointers):</strong>
                    <span>Chứa địa chỉ bộ nhớ 64-bit trỏ sang các đối tượng thực nằm bên V8 Heap.</span>
                  </div>
                </div>
              </div>
              <div class="zone-stat-badge stat-stack">
                <span>0% GC Overhead (CPU Stack Pointer thu hồi tức thì)</span>
              </div>
            </div>

            <!-- VÙNG 3: C++ NON-HEAP -->
            <div class="memory-zone-card zone-external">
              <div class="zone-card-header header-external">
                <span class="zone-icon">03</span>
                <div>
                  <div class="zone-title">C++ NON-HEAP (EXTERNAL)</div>
                  <div class="zone-sub">Cấp phát ngoài Heap do tầng C++ Node.js quản lý</div>
                </div>
              </div>
              <div class="zone-features-list">
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Node.js Buffers:</strong>
                    <span>Vùng nhớ đọc ghi File, Streams, I/O được cấp phát trực tiếp qua malloc().</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Kernel Sockets Buffer:</strong>
                    <span>Hàng đợi Receive/Send Queue của kết nối mạng TCP/HTTP.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">•</span>
                  <div>
                    <strong>Crypto & TLS Context:</strong>
                    <span>Khóa mã hóa RSA/ECDSA và ngữ cảnh kết nối bảo mật HTTPS.</span>
                  </div>
                </div>
              </div>
              <div class="zone-stat-badge stat-external">
                <span>Không chịu giới hạn của V8 --max-old-space-size</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
