import React, { useState } from 'react';
import type { ExamReviewData } from './SprintExamView.tsx';
import { FormattedText } from './FormattedText.tsx';
import { formatChatMarkdown } from './TutorChat.tsx';

interface SprintAIReviewCardProps {
  sprintId: number;
  examTitle: string;
  reviewData: ExamReviewData;
  passingScore: number;
}

export const SprintAIReviewCard: React.FC<SprintAIReviewCardProps> = ({
  sprintId,
  examTitle,
  reviewData,
  passingScore
}) => {
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [liveReviewText, setLiveReviewText] = useState<string>('');
  const [liveError, setLiveError] = useState<string>('');
  const [isLiveOpen, setIsLiveOpen] = useState(false);

  // 1. Phân tích tự động dựa trên telemetry bài thi
  const wrongQuestions = reviewData.questions.filter(
    (q) => reviewData.selectedAnswers[q.id] !== q.correctIndex
  );
  const correctQuestions = reviewData.questions.filter(
    (q) => reviewData.selectedAnswers[q.id] === q.correctIndex
  );
  const failedTestCases = reviewData.codeOutcome.results.filter((r) => !r.passed);
  const passedTestCases = reviewData.codeOutcome.results.filter((r) => r.passed);

  // Xếp loại năng lực kỹ thuật
  let levelBadge = 'Solid Backend Engineer';
  let levelDesc = 'Nắm vững kiến trúc nền tảng, hoàn thành tốt các chỉ tiêu thực thi.';
  let levelColor = '#10b981';

  if (reviewData.finalScore >= 85) {
    levelBadge = 'Senior Backend Architect Level';
    levelDesc = 'Khả năng phân tích sâu sắc về V8 runtime, quản trị bộ nhớ và tư duy lập trình vững chắc.';
    levelColor = '#0ea5e9';
  } else if (!reviewData.passed) {
    levelBadge = 'Junior Backend / Cần Củng Cố';
    levelDesc = 'Còn một số lỗ hổng kiến trúc quan trọng có thể gây rủi ro cao trong môi trường Production.';
    levelColor = '#f59e0b';
  }

  // Điểm mạnh tự động
  const strengths: string[] = [];
  if (reviewData.quizScore >= 80) {
    strengths.push('Lý thuyết & Runtime Internals: Nắm rất chắc cơ chế vận hành của V8 Engine, mô hình bất đồng bộ và kiến trúc bộ nhớ.');
  } else if (reviewData.quizScore >= 60) {
    strengths.push('Lý thuyết: Nắm được phần lớn các khái niệm cơ bản về vòng đời tiến trình và quản lý bộ nhớ.');
  }

  if (reviewData.codeScore === 100) {
    strengths.push('Kỹ năng Code & Edge Cases: Viết code chính xác 100%, vượt qua toàn bộ các bài kiểm thử biên và test case ẩn.');
  } else if (reviewData.codeScore >= 70) {
    strengths.push('Kỹ năng Code: Xử lý tốt logic nghiệp vụ cốt lõi của bài toán, cấu trúc mã nguồn rõ ràng.');
  }

  if (strengths.length === 0) {
    strengths.push('Nỗ lực hoàn thành: Đã kiên trì giải quyết toàn bộ bài kiểm tra trắc nghiệm và thử thách code.');
  }

  // Lỗ hổng cần lưu ý
  const vulnerabilities: string[] = [];
  if (wrongQuestions.length > 0) {
    const wrongTopics = wrongQuestions.slice(0, 3).map((q, i) => `Câu ${i + 1} (${q.question.slice(0, 45)}...)`);
    vulnerabilities.push(`Lý thuyết cần rà soát: Có ${wrongQuestions.length} câu trắc nghiệm chưa chính xác. Cần chú ý kỹ các câu: ${wrongTopics.join('; ')}.`);
  }

  if (failedTestCases.length > 0) {
    vulnerabilities.push(`Test cases chưa đạt: Bị fail ${failedTestCases.length}/${reviewData.codeOutcome.total} trường hợp kiểm thử. Các trường hợp này thường rơi vào input không hợp lệ, biên dữ liệu (corner cases) hoặc xử lý ngoại lệ.`);
  }

  if (reviewData.codeScore < 70) {
    vulnerabilities.push('Rủi ro Production: Code chưa xử lý hết các tình huống lỗi runtime. Trong hệ thống thực tế có thể dẫn đến Unhandled Exception làm sập tiến trình Node.js.');
  }

  // Khuyến nghị hành động
  const recommendations: string[] = [];
  if (wrongQuestions.length > 0) {
    recommendations.push('Đọc lại mục "Giải Thích Kỹ Thuật Chuyên Sâu" ở Phần 1 bên dưới cho từng câu trả lời sai để củng cố mental model.');
  }
  if (failedTestCases.length > 0) {
    recommendations.push('Xem lại bảng kiểm thử ở Phần 2 bên dưới, đối chiếu kết quả Expected vs Received để hoàn thiện logic phòng thủ (Defensive Programming).');
  }
  if (reviewData.passed) {
    recommendations.push(`Đã đủ điều kiện tiến tới Sprint ${sprintId + 1}. Hãy giữ vững phong độ tư duy kiến trúc!`);
  } else {
    recommendations.push('Nên bấm "Làm Bài Lại" để thử sức với bộ đề bốc ngẫu nhiên mới và đạt điểm ≥ ' + passingScore + '%.');
  }

  // 2. Kích hoạt Live AI Review tương tác
  const requestLiveAIReview = async () => {
    setIsLiveOpen(true);
    if (liveReviewText && !liveError) return; // Already fetched

    setIsLiveLoading(true);
    setLiveError('');
    setLiveReviewText('');

    const wrongListText = wrongQuestions
      .map((q, idx) => `${idx + 1}. ${q.question} (Đáp án đúng: ${q.options[q.correctIndex]})`)
      .join('\n');

    const failedTestsText = failedTestCases
      .map((t, idx) => `${idx + 1}. ${t.description || 'Test'} - Expected: ${JSON.stringify(t.expected)}, Received: ${JSON.stringify(t.received)}`)
      .join('\n');

    const promptMessage = `Em vừa hoàn thành bài thi Sprint ${sprintId}: "${examTitle}".
Kết quả telemetry:
- Điểm tổng: ${reviewData.finalScore}% (${reviewData.passed ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT'})
- Trắc nghiệm: ${reviewData.quizScore}% (${reviewData.correctCount}/${reviewData.totalQuestions} câu đúng)
- Code thực hành: ${reviewData.codeScore}% (${passedTestCases.length}/${reviewData.codeOutcome.total} tests passed)
${wrongQuestions.length > 0 ? `\nCác câu trắc nghiệm bị sai:\n${wrongListText}` : '\nTrắc nghiệm đúng toàn bộ.'}
${failedTestCases.length > 0 ? `\nCác test case code bị failed:\n${failedTestsText}` : '\nCode tests đạt 100%.'}

Mã code em đã nộp:
\`\`\`ts
${reviewData.code}
\`\`\`

Nhờ AI Tutor đánh giá chuyên môn sâu sắc:
1. Nhận xét phong cách code và kiến trúc.
2. Phân tích rủi ro thực tế nếu áp dụng code hoặc tư duy này vào production hệ thống lớn.
3. 3 lời khuyên hành động cụ thể để em hoàn thiện trước khi sang Sprint tiếp theo.`;

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json'
        },
        body: JSON.stringify({
          lesson: {
            title: `Báo Cáo Sprint ${sprintId}: ${examTitle}`,
            tag: 'Sprint Exam AI Review',
            theory: `Kỳ thi Sprint ${sprintId} đánh giá chuyên môn sâu về kiến trúc và kỹ năng code backend. Tiêu chuẩn đạt: ≥ ${passingScore}%.`
          },
          messages: [{ role: 'user', content: promptMessage }],
          stream: true
        })
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataContent = trimmed.replace(/^data:\s*/, '');
            if (dataContent === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataContent) as { text?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                setLiveReviewText(accumulated);
              }
            } catch {}
          }
        }
      } else {
        const data = (await response.json()) as { reply?: string; error?: string };
        if (data.error) throw new Error(data.error);
        setLiveReviewText(data.reply || 'Đã hoàn thành đánh giá bài thi.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể kết nối với AI Tutor lúc này.';
      setLiveError(message);
    } finally {
      setIsLiveLoading(false);
    }
  };

  return (
    <div className="sprint-ai-review-wrapper">
      {/* Header Banner */}
      <div className="sprint-ai-header">
        <div className="ai-header-left">
          <span className="ai-bot-avatar">🤖</span>
          <div>
            <h3>ĐÁNH GIÁ CHUYÊN MÔN TỪ AI TUTOR (ENGINEERING REVIEW)</h3>
            <span className="ai-sub-text">
              Phân tích telemetry bài thi Sprint {sprintId} theo chuẩn kỹ thuật Senior Backend NestJS
            </span>
          </div>
        </div>

        <div className="ai-level-pill" style={{ borderColor: levelColor, color: levelColor }}>
          <span>{levelBadge}</span>
        </div>
      </div>

      {/* Synthesis Evaluation Box */}
      <div className="ai-synthesis-grid">
        {/* Pillar 1: Strengths */}
        <div className="ai-synthesis-card strength-card">
          <div className="synthesis-card-title">
            <span className="icon">🌟</span>
            <strong>Điểm Mạnh Kiến Trúc (Key Strengths)</strong>
          </div>
          <ul className="synthesis-list">
            {strengths.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Pillar 2: Vulnerabilities */}
        <div className="ai-synthesis-card risk-card">
          <div className="synthesis-card-title">
            <span className="icon">⚠️</span>
            <strong>Lỗ Hổng Cần Khắc Phục (Vulnerabilities & Production Risks)</strong>
          </div>
          <ul className="synthesis-list">
            {vulnerabilities.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Pillar 3: Actionable Roadmap */}
        <div className="ai-synthesis-card roadmap-card">
          <div className="synthesis-card-title">
            <span className="icon">🎯</span>
            <strong>Khuyến Nghị Hành Động (Actionable Next Steps)</strong>
          </div>
          <ul className="synthesis-list">
            {recommendations.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Interactive Live AI Review Section */}
      <div className="ai-live-consultation-row">
        {!isLiveOpen ? (
          <button
            className="btn btn-primary ai-consult-btn"
            onClick={requestLiveAIReview}
          >
            🤖 Nhận Phân Tích Chuyên Sâu Trực Tiếp Từ AI Tutor (Live Deep Dive)
          </button>
        ) : (
          <div className="ai-live-output-card">
            <div className="ai-live-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-dot" />
                <strong>Báo Cáo Phân Tích Chi Tiết Của AI Tutor</strong>
              </div>
              <button
                className="btn-text-close"
                onClick={() => setIsLiveOpen(false)}
                title="Thu gọn"
              >
                Thu gọn ✕
              </button>
            </div>

            {isLiveLoading && !liveReviewText && (
              <div className="ai-live-loading">
                <span className="spinner" />
                <span>AI Tutor đang phân tích telemetry bài làm và mã nguồn của đại ca...</span>
              </div>
            )}

            {liveError && (
              <div className="ai-live-error">
                <span>⚠️ {liveError}</span>
                <button className="btn btn-secondary btn-sm" onClick={requestLiveAIReview}>
                  Thử lại
                </button>
              </div>
            )}

            {liveReviewText && (
              <div
                className="ai-live-content-markdown"
                dangerouslySetInnerHTML={{ __html: formatChatMarkdown(liveReviewText) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
