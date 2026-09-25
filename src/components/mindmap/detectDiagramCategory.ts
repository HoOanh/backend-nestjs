import type { DiagramCategory } from './types.ts';

/**
 * Nhận diện loại sơ đồ thông minh dựa trên nội dung và tiêu đề
 */
export function detectDiagramCategory(text: string, title?: string): DiagramCategory {
  const clean = text.trim();
  const lowerTitle = (title || '').toLowerCase();

  // 1. Nhận diện ưu tiên theo Tiêu đề mục (Explicit Title Classification)
  if (lowerTitle.includes('cây quyết định') || lowerTitle.includes('decision tree')) {
    return 'decision-tree';
  }

  if (lowerTitle.includes('so sánh') || lowerTitle.includes('comparison') || lowerTitle.includes('vs')) {
    return 'comparison';
  }

  if (
    lowerTitle.includes('bản đồ') ||
    lowerTitle.includes('taxonomy') ||
    lowerTitle.includes('stack map') ||
    lowerTitle.includes('architecture map') ||
    lowerTitle.includes('phân cấp') ||
    lowerTitle.includes('phân phối') ||
    lowerTitle.includes('tầng bậc')
  ) {
    return 'layered-stack';
  }

  if (lowerTitle.includes('resident set size') || lowerTitle.includes('phân vùng bộ nhớ') || lowerTitle.includes('rss')) {
    return 'memory-layout';
  }

  if (
    lowerTitle.includes('dòng chảy') ||
    lowerTitle.includes('flow') ||
    lowerTitle.includes('lifecycle') ||
    lowerTitle.includes('vòng đời') ||
    lowerTitle.includes('quy trình')
  ) {
    return 'lifecycle-flow';
  }

  // 2. Nhận diện dự phòng theo Nội dung sơ đồ (Content Classification)
  if (
    clean.includes('RESIDENT SET SIZE') ||
    clean.includes('V8 HEAP SPACE') ||
    clean.includes('V8 STACK SPACE') ||
    clean.includes('C++ NON-HEAP')
  ) {
    return 'memory-layout';
  }

  if (
    clean.includes('MÔ HÌNH CŨ:') ||
    clean.includes('KỊCH BẢN 1:') ||
    clean.includes('GHÉP NỐI CHẶT') ||
    clean.includes('GHÉP CHUỖI NGUY HIỂM')
  ) {
    return 'comparison';
  }

  if (
    clean.includes('DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU') ||
    clean.includes('BẠN CẦN CHỌN') ||
    clean.includes('BẠN ĐANG THIẾT KẾ') ||
    clean.includes('BẠN CẦN GIỚI HẠN') ||
    clean.includes('BẠN CẦN BẢO VỆ') ||
    clean.includes('JOB XỬ LÝ TRONG WORKER BỊ LỖI?') ||
    clean.includes('LÀM THẾ NÀO ĐỂ BẢO VỆ CONSUMER') ||
    clean.includes('HỆ THỐNG GẶP SỰ CỐ VỀ CACHE?') ||
    clean.includes('BẠN CẦN LƯU TRỮ DỮ LIỆU GÌ') ||
    clean.includes('Kiểu dữ liệu là gì?')
  ) {
    return 'decision-tree';
  }

  if (
    clean.includes('TẦNG VẬT LÝ') ||
    clean.includes('HARDWARE LAYER') ||
    clean.includes('LINUX OS KERNEL') ||
    clean.includes('NODE.JS INTERNALS') ||
    /(?:│\s*)?\d+\.\s+TẦNG/i.test(clean) ||
    clean.includes('Three Pillars') ||
    clean.includes('3 TRỤ CỘT')
  ) {
    return 'layered-stack';
  }

  if (clean.includes('──►') || clean.includes('INCOMING HTTP REQUEST') || clean.includes('Poll Phase')) {
    return 'lifecycle-flow';
  }

  return 'blueprint';
}
