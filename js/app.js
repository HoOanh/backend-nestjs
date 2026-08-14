/**
 * eSmiles Backend Academy - Main Application Coordinator
 * Handles routing, interactive tabs, quiz evaluation, code test runner, exam timers & certificates
 */

document.addEventListener('DOMContentLoaded', () => {
  window.AppState.init();
  App.init();
});

const App = {
  activeView: 'lesson', // 'lesson' | 'sprint-exam' | 'final-exam'
  currentLesson: null,
  currentSprintExam: null,
  activeTab: 'theory',  // 'theory' | 'quiz' | 'code'
  examTimerInterval: null,

  init() {
    this.renderSidebar();
    this.updateStats();

    // Default load first lesson or last active
    const firstLessonId = window.AppState.data.currentLessonId || 'lesson-1';
    this.loadLesson(firstLessonId);
  },

  updateStats() {
    const stats = window.AppState.getStats();
    const bar = document.getElementById('stat-progress-bar');
    const text = document.getElementById('stat-progress-text');
    const streak = document.getElementById('user-streak-text');

    if (bar) bar.style.width = `${stats.progressPercent}%`;
    if (text) text.textContent = `${stats.progressPercent}%`;
    if (streak) streak.textContent = `${stats.streakDays} ngày liên tục`;
  },

  renderSidebar() {
    const nav = document.getElementById('curriculum-nav');
    if (!nav) return;

    let html = '';

    window.CURRICULUM.forEach((sprint) => {
      html += `
        <div class="sprint-group">
          <div class="sprint-title-badge">
            <span>${sprint.sprintTitle.split(':')[0]}</span>
            <span>${sprint.lessons.length} bài</span>
          </div>
      `;

      sprint.lessons.forEach((lesson) => {
        const isCompleted = !!window.AppState.data.completedLessons[lesson.id];
        const isActive = this.activeView === 'lesson' && this.currentLesson?.id === lesson.id;
        const icon = isCompleted ? '✅' : '⚪';

        html += `
          <div class="lesson-nav-item ${isActive ? 'active' : ''}" onclick="App.loadLesson('${lesson.id}')">
            <span class="status-icon">${icon}</span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lesson.title}</span>
          </div>
        `;
      });

      // Sprint Checkpoint Exam Link
      const examScore = window.AppState.data.sprintExamScores[sprint.sprintId];
      const examBadge = examScore ? (examScore.passed ? `🏆 ${examScore.score}%` : `❌ ${examScore.score}%`) : '🎯 Thi Sprint';
      const isExamActive = this.activeView === 'sprint-exam' && this.currentSprintExam?.sprintId === sprint.sprintId;

      html += `
        <div class="sprint-exam-item ${isExamActive ? 'active' : ''}" onclick="App.loadSprintExam(${sprint.sprintId})">
          <span>${examBadge}</span>
          <span style="font-size: 11px; opacity: 0.8;">(Đánh giá)</span>
        </div>
      </div>`;
    });

    // Final Graduation Exam
    const hasGraduated = window.AppState.data.finalExam?.passed;
    const isFinalActive = this.activeView === 'final-exam';
    html += `
      <div class="final-graduation-nav ${isFinalActive ? 'active' : ''}" onclick="App.loadFinalExam()">
        <span style="font-size: 22px;">🎓</span>
        <div>
          <div style="font-weight: 700; font-size: 13px;">Thi Tốt Nghiệp Toàn Khóa</div>
          <div style="font-size: 11px; opacity: 0.8;">${hasGraduated ? 'Đã Tốt Nghiệp (Xem Chứng Chỉ)' : 'Khảo Thí & Cấp Bằng'}</div>
        </div>
      </div>
    `;

    nav.innerHTML = html;
  },

  loadLesson(lessonId) {
    this.activeView = 'lesson';
    clearInterval(this.examTimerInterval);

    // Find lesson in curriculum
    let found = null;
    for (const sp of window.CURRICULUM) {
      const l = sp.lessons.find((item) => item.id === lessonId);
      if (l) {
        found = l;
        break;
      }
    }

    if (!found) found = window.CURRICULUM[0].lessons[0];
    this.currentLesson = found;
    window.AppState.data.currentLessonId = found.id;
    window.AppState.save();

    // Update Topbar
    const tag = document.getElementById('top-tag');
    const title = document.getElementById('top-title');
    if (tag) tag.textContent = found.tag;
    if (title) title.textContent = found.title;

    this.renderLessonView();
    this.renderSidebar();
  },

  renderLessonView() {
    const container = document.getElementById('main-content');
    if (!container || !this.currentLesson) return;

    const lesson = this.currentLesson;
    const isCompleted = !!window.AppState.data.completedLessons[lesson.id];

    container.innerHTML = `
      <div class="lesson-tabs">
        <button class="tab-btn ${this.activeTab === 'theory' ? 'active' : ''}" onclick="App.switchTab('theory')">
          📖 Lý Thuyết & Code Mẫu
        </button>
        <button class="tab-btn ${this.activeTab === 'quiz' ? 'active' : ''}" onclick="App.switchTab('quiz')">
          ❓ Trắc Nghiệm Ôn Luyện <span class="tab-badge">${lesson.quiz.length}</span>
        </button>
        <button class="tab-btn ${this.activeTab === 'code' ? 'active' : ''}" onclick="App.switchTab('code')">
          💻 Bài Tập Code Sandbox <span class="tab-badge">${lesson.codeChallenge.testCases.length} Tests</span>
        </button>
      </div>

      <div id="tab-viewport">
        <!-- Injected based on activeTab -->
      </div>
    `;

    this.renderTabContent();
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    this.renderLessonView();
  },

  renderTabContent() {
    const viewport = document.getElementById('tab-viewport');
    if (!viewport || !this.currentLesson) return;

    if (this.activeTab === 'theory') {
      viewport.innerHTML = `
        <div class="theory-card">
          <div class="theory-content">
            ${this.formatMarkdown(this.currentLesson.theory)}
          </div>
        </div>

        <div class="real-source-callout">
          <div class="callout-title">📂 Trích Dẫn Mã Nguồn Thực Tế Trong Dự Án eSmiles:</div>
          <div class="code-block-wrapper" style="margin-top: 10px;">
            <div class="code-block-header">
              <span>NestJS Real-world Reference</span>
              <span>TypeScript</span>
            </div>
            <pre class="code-block-content">${this.escapeHtml(this.currentLesson.realCodeSnippet)}</pre>
          </div>
        </div>

        <div style="text-align: right; margin-top: 20px;">
          <button class="btn btn-primary" onclick="App.switchTab('quiz')">
            Tiếp tục sang Trắc Nghiệm ➡️
          </button>
        </div>
      `;
    } else if (this.activeTab === 'quiz') {
      let quizHtml = '<div class="quiz-container">';
      this.currentLesson.quiz.forEach((q, idx) => {
        quizHtml += `
          <div class="question-card" id="q-card-${q.id}">
            <div class="question-header">
              <span class="question-num">Câu ${idx + 1}</span>
              <div>${q.question}</div>
            </div>
            <div class="options-list">
              ${q.options
                .map(
                  (opt, optIdx) => `
                <div class="option-item" onclick="App.answerQuiz('${q.id}', ${optIdx}, ${q.correctIndex})">
                  <span style="font-weight: 700;">${String.fromCharCode(65 + optIdx)}.</span>
                  <span>${opt}</span>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="quiz-explanation" id="q-exp-${q.id}" style="display: none;"></div>
          </div>
        `;
      });
      quizHtml += `
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 24px;">
          <button class="btn btn-secondary" onclick="App.switchTab('theory')">⬅️ Quay lại Lý thuyết</button>
          <button class="btn btn-primary" onclick="App.switchTab('code')">Chuyển sang Bài Tập Code ➡️</button>
        </div>
      `;
      viewport.innerHTML = quizHtml;
    } else if (this.activeTab === 'code') {
      const challenge = this.currentLesson.codeChallenge;
      const initialCode = window.AppState.getCodeDraft(this.currentLesson.id, challenge.starterCode);

      viewport.innerHTML = `
        <div class="sandbox-card">
          <div class="sandbox-header">
            <h3 class="sandbox-title">${challenge.title}</h3>
            <p class="sandbox-desc">${this.escapeHtml(challenge.description).replace(/\\n/g, '<br>')}</p>
          </div>

          <div class="editor-toolbar">
            <div class="toolbar-left">
              <span>TypeScript Sandbox</span>
              <span>•</span>
              <span style="color: #38bdf8;">Tự động lưu nháp</span>
            </div>
            <div class="toolbar-actions">
              <button class="btn btn-secondary" onclick="App.resetCode()">↺ Khôi phục ban đầu</button>
              <button class="btn btn-primary" onclick="App.runCode(false)">▶️ Chạy Thử (Visible Cases)</button>
              <button class="btn btn-success" onclick="App.runCode(true)">🚀 Nộp Bài (Kèm Hidden Cases)</button>
            </div>
          </div>

          <div class="editor-container">
            <textarea id="code-input" class="code-textarea" spellcheck="false" oninput="App.onCodeChange()">${this.escapeHtml(initialCode)}</textarea>
          </div>

          <div class="test-results-panel" id="test-console" style="display: none;">
            <!-- Rendered by runCode -->
          </div>
        </div>
      `;
    }
  },

  onCodeChange() {
    const textarea = document.getElementById('code-input');
    if (textarea && this.currentLesson) {
      window.AppState.saveCodeDraft(this.currentLesson.id, textarea.value);
    }
  },

  resetCode() {
    if (!this.currentLesson) return;
    const textarea = document.getElementById('code-input');
    if (textarea) {
      textarea.value = this.currentLesson.codeChallenge.starterCode;
      this.onCodeChange();
    }
  },

  answerQuiz(questionId, selectedIdx, correctIdx) {
    const card = document.getElementById(`q-card-${questionId}`);
    const exp = document.getElementById(`q-exp-${questionId}`);
    if (!card || !exp) return;

    const question = this.currentLesson.quiz.find((q) => q.id === questionId);
    const options = card.querySelectorAll('.option-item');
    options.forEach((opt, idx) => {
      opt.classList.remove('selected', 'correct', 'incorrect');
      if (idx === correctIdx) {
        opt.classList.add('correct');
      } else if (idx === selectedIdx && selectedIdx !== correctIdx) {
        opt.classList.add('incorrect');
      }
    });

    exp.style.display = 'block';
    if (selectedIdx === correctIdx) {
      exp.className = 'quiz-explanation correct';
      exp.innerHTML = `<strong>Chính xác! 🎉</strong> ${question.explanation}`;
    } else {
      exp.className = 'quiz-explanation incorrect';
      exp.innerHTML = `<strong>Chưa đúng! 💡</strong> ${question.explanation}`;
    }
  },

  async runCode(includeHidden) {
    const textarea = document.getElementById('code-input');
    const consolePanel = document.getElementById('test-console');
    if (!textarea || !consolePanel || !this.currentLesson) return;

    const code = textarea.value;
    const testCases = this.currentLesson.codeChallenge.testCases;

    consolePanel.style.display = 'block';
    consolePanel.innerHTML = '<div style="color: var(--text-muted);">Đang thực thi và kiểm tra test cases...</div>';

    const outcome = await window.CodeEvaluator.runTests(code, testCases, includeHidden);

    let html = '';
    if (outcome.syntaxError) {
      html = `
        <div class="test-summary-badge fail">❌ Lỗi Cú Pháp / Thực Thi</div>
        <div class="test-case-error" style="font-size: 14px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
          ${this.escapeHtml(outcome.syntaxError)}
        </div>
      `;
    } else {
      const badgeClass = outcome.passed ? 'pass' : 'fail';
      const badgeText = outcome.passed
        ? `✅ VƯỢT QUA TOÀN BỘ (${outcome.passedCount}/${outcome.total} Tests Pass)`
        : `❌ CHƯA ĐẠT (${outcome.passedCount}/${outcome.total} Tests Pass)`;

      html += `<div class="test-summary-badge ${badgeClass}">${badgeText}</div>`;

      outcome.results.forEach((res) => {
        const statusClass = res.passed ? 'pass' : 'fail';
        const statusText = res.passed ? 'PASS ✅' : 'FAIL ❌';
        const lockIcon = res.hidden ? '🔒 [Hidden Case] ' : '';

        html += `
          <div class="test-case-row">
            <div class="test-case-header">
              <span class="test-case-name">${lockIcon}${res.name}</span>
              <span class="test-case-status ${statusClass}">${statusText}</span>
            </div>
            ${res.error ? `<div class="test-case-error">Chi tiết lỗi: ${this.escapeHtml(res.error)}</div>` : ''}
            ${!res.hidden && !res.passed ? `
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                Input: <code>${this.escapeHtml(res.input)}</code> | Expected: <code>${this.escapeHtml(res.expected)}</code> | Actual: <code>${this.escapeHtml(res.actual)}</code>
              </div>
            ` : ''}
          </div>
        `;
      });

      if (outcome.passed && includeHidden) {
        // Mark lesson completed
        window.AppState.setLessonCompleted(this.currentLesson.id, 100, true);
        this.updateStats();
        this.renderSidebar();
        html += `
          <div style="margin-top: 16px; padding: 12px; background: rgba(16, 185, 129, 0.15); border-radius: 8px; color: #34d399; font-weight: 600; text-align: center;">
            🎉 Xuất sắc! Đại ca đã hoàn thành bài học này. Tiến độ đã được lưu lại!
          </div>
        `;
      }
    }

    consolePanel.innerHTML = html;
  },

  loadSprintExam(sprintId) {
    this.activeView = 'sprint-exam';
    const exam = window.SPRINT_EXAMS.find((e) => e.sprintId === sprintId);
    if (!exam) return;
    this.currentSprintExam = exam;

    const tag = document.getElementById('top-tag');
    const title = document.getElementById('top-title');
    if (tag) tag.textContent = 'Sprint Exam';
    if (title) title.textContent = exam.title;

    this.renderSprintExamView();
    this.renderSidebar();
  },

  renderSprintExamView() {
    const container = document.getElementById('main-content');
    if (!container || !this.currentSprintExam) return;

    const exam = this.currentSprintExam;
    const existingScore = window.AppState.data.sprintExamScores[exam.sprintId];

    container.innerHTML = `
      <div class="exam-banner">
        <div class="exam-info">
          <h2>🎯 ${exam.title}</h2>
          <p>${exam.description}</p>
          <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
            Yêu cầu vượt qua: <strong>≥ ${exam.passingScore}%</strong> • Thời gian: <strong>${exam.timeLimitMinutes} phút</strong>
          </div>
        </div>
        <div class="exam-timer">
          <div class="timer-digits" id="exam-timer-display">${exam.timeLimitMinutes}:00</div>
          <div class="timer-label">Thời gian còn lại</div>
        </div>
      </div>

      ${existingScore ? `
        <div style="padding: 16px 20px; border-radius: 12px; background: ${existingScore.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; border: 1px solid ${existingScore.passed ? '#10b981' : '#ef4444'}; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: ${existingScore.passed ? '#34d399' : '#f87171'};">
              ${existingScore.passed ? '🏆 ĐÃ ĐẠT CHỈ TIÊU' : '❌ CHƯA ĐẠT'} (Điểm: ${existingScore.score}%)
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">Hoàn thành lúc: ${new Date(existingScore.completedAt).toLocaleString('vi-VN')}</div>
          </div>
          <button class="btn btn-secondary" onclick="App.startExamTimer(${exam.timeLimitMinutes})">Làm lại bài thi</button>
        </div>
      ` : ''}

      <div class="quiz-container" style="margin-bottom: 32px;">
        <h3 style="color: var(--text-primary); font-size: 18px; margin-bottom: 16px;">Phần 1: Trắc Nghiệm Kiến Thức Lõi</h3>
        ${exam.questions.map((q, idx) => `
          <div class="question-card" id="exam-q-${q.id}">
            <div class="question-header">
              <span class="question-num">Câu ${idx + 1}</span>
              <div>${q.question}</div>
            </div>
            <div class="options-list">
              ${q.options.map((opt, optIdx) => `
                <div class="option-item" onclick="App.selectExamOption('${q.id}', ${optIdx})">
                  <span style="font-weight: 700;">${String.fromCharCode(65 + optIdx)}.</span>
                  <span>${opt}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="sandbox-card" style="margin-bottom: 32px;">
        <div class="sandbox-header">
          <h3 class="sandbox-title">Phần 2: ${exam.codeChallenge.title}</h3>
          <p class="sandbox-desc">${this.escapeHtml(exam.codeChallenge.description).replace(/\\n/g, '<br>')}</p>
        </div>
        <div class="editor-container">
          <textarea id="exam-code-input" class="code-textarea" spellcheck="false">${this.escapeHtml(exam.codeChallenge.starterCode)}</textarea>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 60px;">
        <button class="btn btn-primary" style="padding: 14px 36px; font-size: 16px;" onclick="App.submitSprintExam()">
          🚀 Nộp Bài Thi Sprint
        </button>
      </div>
    `;

    this.startExamTimer(exam.timeLimitMinutes);
  },

  startExamTimer(minutes) {
    clearInterval(this.examTimerInterval);
    let secondsLeft = minutes * 60;
    const display = document.getElementById('exam-timer-display');

    this.examTimerInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(this.examTimerInterval);
        alert('Hết giờ làm bài! Hệ thống sẽ tự động nộp bài.');
        this.submitSprintExam();
        return;
      }
      const m = Math.floor(secondsLeft / 60);
      const s = secondsLeft % 60;
      if (display) {
        display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }
    }, 1000);
  },

  selectExamOption(questionId, optIdx) {
    const card = document.getElementById(`exam-q-${questionId}`);
    if (!card) return;
    const options = card.querySelectorAll('.option-item');
    options.forEach((opt, idx) => {
      opt.classList.toggle('selected', idx === optIdx);
    });
  },

  async submitSprintExam() {
    if (!this.currentSprintExam) return;
    clearInterval(this.examTimerInterval);

    const exam = this.currentSprintExam;
    let correctCount = 0;

    exam.questions.forEach((q) => {
      const card = document.getElementById(`exam-q-${q.id}`);
      if (card) {
        const selected = card.querySelector('.option-item.selected');
        if (selected) {
          const options = Array.from(card.querySelectorAll('.option-item'));
          const selectedIdx = options.indexOf(selected);
          if (selectedIdx === q.correctIndex) {
            correctCount++;
          }
        }
      }
    });

    const quizScore = Math.round((correctCount / exam.questions.length) * 100);

    // Evaluate code
    const codeTextarea = document.getElementById('exam-code-input');
    const code = codeTextarea ? codeTextarea.value : '';
    const codeOutcome = await window.CodeEvaluator.runTests(code, exam.codeChallenge.testCases, true);

    const codeScore = codeOutcome.passed ? 100 : Math.round((codeOutcome.passedCount / codeOutcome.total) * 100);
    const finalScore = Math.round(quizScore * 0.5 + codeScore * 0.5);
    const passed = finalScore >= exam.passingScore;

    window.AppState.saveSprintExamResult(exam.sprintId, finalScore, passed);
    this.updateStats();
    this.renderSidebar();

    if (passed) {
      alert(`🎉 CHÚC MỪNG ĐẠI CA ĐÃ ĐỖ BÀI THI SPRINT ${exam.sprintId}!\n\nĐiểm Trắc nghiệm: ${quizScore}%\nĐiểm Code: ${codeScore}%\nTổng kết: ${finalScore}% (Đạt yêu cầu)`);
    } else {
      alert(`❌ CHƯA ĐẠT!\n\nĐiểm của đại ca: ${finalScore}% (Yêu cầu tối thiểu ${exam.passingScore}%).\nVui lòng ôn tập lại bài học và thử lại.`);
    }

    this.renderSprintExamView();
  },

  loadFinalExam() {
    this.activeView = 'final-exam';
    clearInterval(this.examTimerInterval);

    const tag = document.getElementById('top-tag');
    const title = document.getElementById('top-title');
    if (tag) tag.textContent = 'Graduation';
    if (title) title.textContent = window.FINAL_EXAM.title;

    this.renderFinalExamView();
    this.renderSidebar();
  },

  renderFinalExamView() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const exam = window.FINAL_EXAM;
    const finalResult = window.AppState.data.finalExam;

    if (finalResult && finalResult.passed) {
      // Render Graduation Certificate
      container.innerHTML = `
        <div class="certificate-container" id="printable-cert">
          <div class="cert-watermark">🦷</div>
          <div class="cert-header">CHỨNG CHỈ TỐT NGHIỆP XUẤT SẮC</div>
          <h2 class="cert-title">eSmiles Backend Master Engineer</h2>
          <div class="cert-recipient-label">Chứng nhận cấp cho Kỹ sư:</div>
          <div class="cert-student-name">${this.escapeHtml(finalResult.studentName || 'Đại Ca Kỹ Sư')}</div>
          <p class="cert-body-text">
            Đã hoàn thành xuất sắc toàn bộ 4 Sprint đào tạo chuyên sâu về kiến trúc <strong>NestJS 11, Prisma 7 Multi-tenancy, Dynamic CASL Permissions, Queue BullMQ & Tooling Bruno</strong> trên mã nguồn thực tế của hệ thống Nha Khoa Số eSmiles.
          </p>
          <div class="cert-footer-row">
            <div>
              <div class="cert-seal">🏅</div>
              <div style="font-weight: 700; color: #f8fafc;">eSmiles Core Architecture Committee</div>
            </div>
            <div style="text-align: right;">
              <div class="cert-meta-item">Chứng chỉ số: ${finalResult.certificateId}</div>
              <div class="cert-meta-item">Ngày cấp: ${new Date(finalResult.completedAt).toLocaleDateString('vi-VN')}</div>
              <div class="cert-meta-item">Điểm tốt nghiệp: ${finalResult.score}%</div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="btn btn-secondary" onclick="window.print()">🖨️ In / Xuất PDF Chứng Chỉ</button>
          <button class="btn btn-primary" style="margin-left: 12px;" onclick="App.retakeFinalExam()">Thi lại để cải thiện điểm</button>
        </div>
      `;
      return;
    }

    // Render Final Exam Test Form
    container.innerHTML = `
      <div class="exam-banner">
        <div class="exam-info">
          <h2>🎓 ${exam.title}</h2>
          <p>${exam.description}</p>
        </div>
        <div class="exam-timer">
          <div class="timer-digits" id="exam-timer-display">${exam.timeLimitMinutes}:00</div>
          <div class="timer-label">Thời gian làm bài</div>
        </div>
      </div>

      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <label style="display: block; font-weight: 600; margin-bottom: 8px;">Họ và Tên Học Viên (Hiển thị trên Chứng chỉ):</label>
        <input type="text" id="student-name-input" value="${this.escapeHtml(window.AppState.data.userName)}" style="width: 100%; max-width: 400px; padding: 10px 14px; background: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; color: white; font-size: 15px;">
      </div>

      <div class="quiz-container" style="margin-bottom: 32px;">
        <h3 style="color: var(--text-primary); font-size: 18px; margin-bottom: 16px;">Phần 1: Khảo Thí Lý Thuyết & Kiến Trúc Toàn Diện (${exam.questions.length} câu)</h3>
        ${exam.questions.map((q, idx) => `
          <div class="question-card" id="fe-q-${q.id}">
            <div class="question-header">
              <span class="question-num">Câu ${idx + 1}</span>
              <div>${q.question}</div>
            </div>
            <div class="options-list">
              ${q.options.map((opt, optIdx) => `
                <div class="option-item" onclick="App.selectExamOption('${q.id}', ${optIdx})">
                  <span style="font-weight: 700;">${String.fromCharCode(65 + optIdx)}.</span>
                  <span>${opt}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="sandbox-card" style="margin-bottom: 32px;">
        <div class="sandbox-header">
          <h3 class="sandbox-title">Phần 2: ${exam.codeChallenge.title}</h3>
          <p class="sandbox-desc">${this.escapeHtml(exam.codeChallenge.description).replace(/\\n/g, '<br>')}</p>
        </div>
        <div class="editor-container">
          <textarea id="fe-code-input" class="code-textarea" spellcheck="false">${this.escapeHtml(exam.codeChallenge.starterCode)}</textarea>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 60px;">
        <button class="btn btn-primary" style="padding: 16px 40px; font-size: 17px;" onclick="App.submitFinalExam()">
          🎓 Nộp Bài Thi Tốt Nghiệp & Nhận Bằng
        </button>
      </div>
    `;

    this.startExamTimer(exam.timeLimitMinutes);
  },

  retakeFinalExam() {
    window.AppState.data.finalExam = null;
    window.AppState.save();
    this.renderFinalExamView();
  },

  async submitFinalExam() {
    clearInterval(this.examTimerInterval);
    const exam = window.FINAL_EXAM;
    const nameInput = document.getElementById('student-name-input');
    const studentName = nameInput ? nameInput.value.trim() : 'Đại Ca Kỹ Sư';

    let correctCount = 0;
    exam.questions.forEach((q) => {
      const card = document.getElementById(`fe-q-${q.id}`);
      if (card) {
        const selected = card.querySelector('.option-item.selected');
        if (selected) {
          const options = Array.from(card.querySelectorAll('.option-item'));
          const selectedIdx = options.indexOf(selected);
          if (selectedIdx === q.correctIndex) correctCount++;
        }
      }
    });

    const quizScore = Math.round((correctCount / exam.questions.length) * 100);

    const codeTextarea = document.getElementById('fe-code-input');
    const code = codeTextarea ? codeTextarea.value : '';
    const codeOutcome = await window.CodeEvaluator.runTests(code, exam.codeChallenge.testCases, true);

    const codeScore = codeOutcome.passed ? 100 : Math.round((codeOutcome.passedCount / codeOutcome.total) * 100);
    const finalScore = Math.round(quizScore * 0.5 + codeScore * 0.5);
    const passed = finalScore >= exam.passingScore;

    if (passed) {
      window.AppState.saveFinalExamResult(finalScore, true, studentName);
      this.updateStats();
      this.renderSidebar();
      alert(`🎉 CHÚC MỪNG ĐẠI CA ĐÃ TỐT NGHIỆP KHÓA HỌC eSmiles BACKEND MASTER!\n\nĐiểm số: ${finalScore}%\nHệ thống đang cấp Chứng chỉ Tốt nghiệp...`);
      this.renderFinalExamView();
    } else {
      alert(`❌ CHƯA ĐẠT TỐT NGHIỆP!\n\nĐiểm của đại ca: ${finalScore}% (Yêu cầu tối thiểu ${exam.passingScore}%).\nĐại ca có thể xem lại bài học và thi lại bất kỳ lúc nào.`);
    }
  },

  formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```typescript([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">TypeScript</div><pre class="code-block-content">$1</pre></div>')
      .replace(/```bash([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">Terminal / Bash</div><pre class="code-block-content">$1</pre></div>')
      .replace(/```json([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">JSON</div><pre class="code-block-content">$1</pre></div>')
      .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/g, '<p></p>');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
