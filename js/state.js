/**
 * eSmiles Backend Academy - State Manager
 * Persists learner progress, quiz scores, code submissions and certificates
 */

const STORAGE_KEY = 'esmiles_backend_academy_state_v1';

window.AppState = {
  data: {
    userName: 'Kỹ Sư Backend eSmiles',
    currentSprintId: 1,
    currentLessonId: 'lesson-1',
    completedLessons: {}, // { 'lesson-1': { quizScore: 100, codePassed: true, completedAt: '...' } }
    sprintExamScores: {}, // { 1: { score: 100, passed: true, completedAt: '...' } }
    finalExam: null,      // { score: 95, passed: true, completedAt: '...', certificateId: 'ESM-2026-...' }
    codeDrafts: {},       // { 'lesson-1': 'code...' }
    streakDays: 1,
    lastActiveDate: new Date().toISOString().split('T')[0]
  },

  init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = { ...this.data, ...JSON.parse(raw) };
      }
      this.updateStreak();
      this.save();
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save state', e);
    }
  },

  updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (this.data.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (this.data.lastActiveDate === yesterday) {
        this.data.streakDays = (this.data.streakDays || 1) + 1;
      } else {
        this.data.streakDays = 1;
      }
      this.data.lastActiveDate = today;
    }
  },

  setLessonCompleted(lessonId, quizScore, codePassed) {
    this.data.completedLessons[lessonId] = {
      quizScore,
      codePassed,
      completedAt: new Date().toISOString()
    };
    this.save();
  },

  saveCodeDraft(lessonId, code) {
    this.data.codeDrafts[lessonId] = code;
    this.save();
  },

  getCodeDraft(lessonId, defaultCode) {
    return this.data.codeDrafts[lessonId] || defaultCode;
  },

  saveSprintExamResult(sprintId, score, passed) {
    this.data.sprintExamScores[sprintId] = {
      score,
      passed,
      completedAt: new Date().toISOString()
    };
    this.save();
  },

  saveFinalExamResult(score, passed, userName) {
    const certId = 'ESM-CERT-' + Math.floor(100000 + Math.random() * 900000);
    this.data.finalExam = {
      score,
      passed,
      completedAt: new Date().toISOString(),
      certificateId: certId,
      studentName: userName || this.data.userName
    };
    if (userName) this.data.userName = userName;
    this.save();
    return this.data.finalExam;
  },

  getStats() {
    const totalLessons = window.CURRICULUM.reduce((acc, sp) => acc + sp.lessons.length, 0);
    const completedCount = Object.keys(this.data.completedLessons).length;
    const progressPercent = Math.round((completedCount / totalLessons) * 100);

    const passedSprints = Object.values(this.data.sprintExamScores).filter(s => s.passed).length;

    return {
      totalLessons,
      completedCount,
      progressPercent,
      passedSprints,
      hasGraduated: !!(this.data.finalExam && this.data.finalExam.passed),
      streakDays: this.data.streakDays
    };
  }
};
