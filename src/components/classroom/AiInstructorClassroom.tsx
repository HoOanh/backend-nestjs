import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  CheckCircle2,
  Send,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Hand,
  Laptop,
  MessageSquare,
  Check,
  BookOpen
} from 'lucide-react';
import { buildLessonCheckpoints } from '../../data/courses.ts';
import type {
  CourseDefinition,
  Lesson,
  TeachingCheckpoint
} from '../../data/curriculum/types.ts';
import {
  instructor_c1_l1
} from '../../data/instructor-curriculum/chapter1/c1-l1.ts';
import type {
  InstructorSection,
  InstructorSlide,
  InstructorVisual
} from '../../data/instructor-curriculum/types.ts';
import type { ClassroomCheckpointProgress } from '../../types/user.ts';
import { chatDbService } from '../../services/db/chatDbService.ts';
import { MODEL_OPTIONS } from '../../context/TutorChatContext.tsx';
import {
  speakVietnamese,
  speakVietnameseStream,
  stopVietnameseSpeech,
  splitIntoVietnameseSentences
} from '../../services/vietnameseVoiceService.ts';
import {
  InteractiveSmartboardClassroom,
  type BoardDisplayMode,
  visualEntryCount
} from './InteractiveSmartboardClassroom.tsx';
import { CodeSandboxTab } from '../lesson/CodeSandboxTab.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select.tsx';

export interface AiInstructorClassroomProps {
  course: CourseDefinition;
  lesson: Lesson;
  userId: string;
  savedClassroomProgress?: ClassroomCheckpointProgress;
  isLessonCompleted: boolean;
  onSaveCheckpoint: (
    courseId: string,
    lessonId: string,
    lessonTitle: string,
    checkpointId: string,
    nextCheckpointIndex: number,
    sessionCompleted: boolean
  ) => void;
  onLessonCompleted: (lessonId: string) => void;
  onExitToLesson: () => void;
  onExitToHub: () => void;
}

interface ClassroomQaTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface LectureBeat {
  id: string;
  label: string;
  boardMode: BoardDisplayMode;
  pointIndex: number;
  codeLineIndex: number;
  spokenScript: string;
  slideTitle: string;
  slideTakeaway: string;
  slidePoints: string[];
  slideSubtitle?: string;
  instructorVisual?: InstructorVisual;
}

interface TeachingSlide {
  title: string;
  takeaway: string;
  points: string[];
  narration: string;
}

interface LectureResumePoint {
  stepIndex: number;
  beatIndex: number;
  sentenceIndex: number;
  autoPlay: boolean;
  shouldResumeAudio: boolean;
}

class AsyncSentenceQueue implements AsyncIterable<string> {
  private sentences: string[] = [];
  private waiters: Array<() => void> = [];
  private closed = false;

  push(sentence: string): void {
    if (this.closed || !sentence.trim()) return;
    this.sentences.push(sentence);
    this.waiters.shift()?.();
  }

  close(): void {
    this.closed = true;
    this.waiters.splice(0).forEach((wake) => wake());
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<string, void, undefined> {
    while (true) {
      const sentence = this.sentences.shift();
      if (sentence !== undefined) {
        yield sentence;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}

function extractCompleteSpeechSentences(
  buffer: string,
  flush = false
): { sentences: string[]; remainder: string } {
  let speechText = buffer;
  if (flush) speechText = speechText.replace(/\[CHECKPOINT_PASSED\]/g, '').trim();

  let boundary = -1;
  const sentenceBoundary = /[.!?;:](?=\s)/g;
  let match = sentenceBoundary.exec(speechText);
  while (match) {
    boundary = match.index + 1;
    match = sentenceBoundary.exec(speechText);
  }

  if (boundary < 0 && !flush && speechText.length > 220) {
    const commaBoundary = speechText.lastIndexOf(',', 190);
    boundary = commaBoundary > 90 ? commaBoundary + 1 : speechText.lastIndexOf(' ', 180);
  }

  if (flush) {
    return { sentences: splitIntoVietnameseSentences(speechText), remainder: '' };
  }
  if (boundary < 0) return { sentences: [], remainder: speechText };

  const completeText = speechText.slice(0, boundary).trim();
  const remainder = speechText.slice(boundary).trimStart();
  return {
    sentences: splitIntoVietnameseSentences(completeText),
    remainder
  };
}

function cleanLectureMarkup(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\|\s*:?-{3,}.*\|\s*$/gm, '')
    .replace(/^\|(.+)\|\s*$/gm, '$1')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function toBoardPoint(value: string): string {
  return cleanLectureMarkup(value)
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTeachingFacts(markdown: string): string[] {
  const facts: string[] = [];
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');

  for (const rawLine of withoutCode.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^#{1,4}\s/.test(line) || /^\|?\s*:?-{3,}/.test(line)) continue;

    if (line.startsWith('|')) {
      const cells = line.split('|').map(toBoardPoint).filter(Boolean);
      if (cells.length > 1) facts.push(cells.join('  →  '));
      continue;
    }

    if (/^(?:[-*+]\s|\d+[.)]\s)/.test(line)) {
      facts.push(toBoardPoint(line));
      continue;
    }

    const cleaned = toBoardPoint(line.replace(/^>\s?/, ''));
    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    for (const sentence of sentences) {
      const fact = sentence.trim();
      if (fact.length >= 36) facts.push(fact);
    }
  }

  return [...new Set(facts)].filter((fact) => fact.length > 24);
}

function buildTeachingSlides(
  markdown: string,
  fallbackTitle: string,
  fallbackPoints: string[]
): TeachingSlide[] {
  const slides: TeachingSlide[] = [];
  let currentTitle = fallbackTitle;
  let currentBlocks: string[] = [];

  const flush = () => {
    const facts = extractTeachingFacts(currentBlocks.join('\n\n'));
    if (facts.length) {
      const takeaway = facts[0];
      const points = facts.slice(1, 4);
      const narration = cleanLectureMarkup(currentBlocks.join('\n\n'))
        .replace(/\s+/g, ' ')
        .slice(0, 1400);
      slides.push({ title: currentTitle, takeaway, points, narration });
    }
    currentBlocks = [];
  };

  for (const block of markdown.split(/\n\s*\n/)) {
    const heading = block.match(/^#{1,4}\s+(.+)$/m);
    if (heading) {
      flush();
      currentTitle = cleanLectureMarkup(heading[1]);
      const remaining = block.replace(/^#{1,4}\s+.+$/m, '').trim();
      if (remaining) currentBlocks.push(remaining);
      continue;
    }
    if (block.trim()) currentBlocks.push(block.trim());
  }
  flush();

  if (slides.length === 0) {
    const points = fallbackPoints.map(toBoardPoint).filter(Boolean).slice(0, 4);
    const fallback = extractTeachingFacts(markdown)[0] || fallbackTitle;
    slides.push({
      title: fallbackTitle,
      takeaway: fallback,
      points,
      narration: cleanLectureMarkup(markdown).slice(0, 1400)
    });
  }
  return slides;
}

/**
 * Build a progressive, spoken Vietnamese lecture script for a checkpoint step
 * so the Teacher teaches beat-by-beat on the Interactive White Smartboard.
 */
function buildLectureBeatsForStep(
  checkpoint: TeachingCheckpoint,
  stepIdx: number,
  totalSteps: number,
  instructorSection?: InstructorSection,
  openingSlide?: InstructorSlide,
  roadmapSlide?: InstructorSlide,
  closingSlide?: InstructorSlide
): LectureBeat[] {
  const beats: LectureBeat[] = [];

  if (instructorSection) {
    const plannedSlides = [openingSlide, roadmapSlide, ...instructorSection.slides]
      .filter((slide): slide is InstructorSlide => Boolean(slide));

    plannedSlides.forEach((slide, idx) => {
      beats.push({
        id: slide.id,
        label: slide.title,
        boardMode: 'keypoints',
        pointIndex: idx,
        codeLineIndex: 0,
        slideTitle: slide.title,
        slideTakeaway: slide.takeaway,
        slidePoints: [],
        slideSubtitle: slide.subtitle,
        instructorVisual: slide.visual,
        spokenScript: slide.narration
      });
    });

    beats.push({
      id: `${instructorSection.id}-check`,
      label: 'Kiểm tra hiểu bài',
      boardMode: 'question',
      pointIndex: 0,
      codeLineIndex: 0,
      slideTitle: 'Thử áp dụng điều vừa học',
      slideTakeaway: '',
      slidePoints: [],
      spokenScript: `Mình vừa lần theo xong cơ chế này. Trước khi nối sang tình huống kế tiếp, mình muốn nghe cách bạn tự giải thích: ${instructorSection.check.question}`
    });

    if (closingSlide) {
      beats.push({
        id: closingSlide.id,
        label: closingSlide.title,
        boardMode: 'keypoints',
        pointIndex: 0,
        codeLineIndex: 0,
        slideTitle: closingSlide.title,
        slideTakeaway: closingSlide.takeaway,
        slidePoints: [],
        slideSubtitle: closingSlide.subtitle,
        instructorVisual: closingSlide.visual,
        spokenScript: closingSlide.narration
      });
    }
    return beats;
  }

  const slides = buildTeachingSlides(
    checkpoint.boardMarkdown,
    checkpoint.shortTitle || checkpoint.title,
    checkpoint.keyPoints
  );

  // Start with an actual teaching slide, then progress through the lesson text.
  beats.push({
    id: `${checkpoint.id}-intro`,
    label: 'Mở đầu phần giảng',
    boardMode: 'keypoints',
    pointIndex: 0,
    codeLineIndex: 0,
    slideTitle: 'Mục tiêu của phần học',
    slideTakeaway: 'Sau phần này, bạn cần nắm được ba ý cốt lõi bên dưới.',
    slidePoints: checkpoint.keyPoints.slice(0, 3),
    spokenScript: `Mình và bạn bắt đầu phần ${stepIdx + 1} trên ${totalSteps}: ${checkpoint.title}. Trước hết, mục tiêu là hiểu được ý cốt lõi: ${checkpoint.summary}. Sau đó mình sẽ đi từng nội dung trên bảng, giải thích vì sao nó hoạt động như vậy và liên hệ với tình huống thực tế.`
  });

  slides.forEach((slide, idx) => {
    beats.push({
      id: `${checkpoint.id}-slide-${idx}`,
      label: `Slide ${idx + 1}`,
      boardMode: 'keypoints',
      pointIndex: idx,
      codeLineIndex: 0,
      slideTitle: slide.title,
      slideTakeaway: slide.takeaway,
      slidePoints: slide.points,
      spokenScript: `Mình cùng phân tích sâu hơn về ${slide.title}. ${slide.narration || slide.takeaway}`
    });
  });

  // Optional Diagram beat if visual diagram exists
  if (checkpoint.visualMarkdown && checkpoint.visualMarkdown.trim().length > 20) {
    beats.push({
      id: `${checkpoint.id}-diagram`,
      label: 'Phân tích sơ đồ',
      boardMode: 'diagram',
      pointIndex: 0,
      codeLineIndex: 0,
      slideTitle: 'Sơ đồ kiến trúc',
      slideTakeaway: '',
      slidePoints: [],
      spokenScript: `Mình chuyển sang sơ đồ để bạn hình dung luồng chạy thực tế của ${checkpoint.title}. Hãy theo dõi thứ tự các thành phần kết nối với nhau rồi mình sẽ phân tích từng bước.`
    });
  }

  // Optional Code X-Ray beat if code excerpt exists
  if (checkpoint.codeExcerpt && checkpoint.codeExcerpt.trim().length > 10) {
    const lines = checkpoint.codeExcerpt.split('\n');
    const importantLineIdx = Math.min(
      Math.max(0, lines.findIndex((l) => l.trim().length > 8)),
      Math.max(0, lines.length - 1)
    );
    beats.push({
      id: `${checkpoint.id}-code`,
      label: 'Mổ xẻ Code',
      boardMode: 'code',
      pointIndex: 0,
      codeLineIndex: importantLineIdx,
      slideTitle: 'Đọc code trong dự án',
      slideTakeaway: '',
      slidePoints: [],
      spokenScript: `Mình chuyển sang đoạn code minh họa. Bạn để ý dòng ${importantLineIdx + 1}; đây là chỗ thể hiện trực tiếp cơ chế ${checkpoint.title} trong dự án.`
    });
  }

  // Final Beat of the step: present a short check question
  const questionPrompt = checkpoint.interactiveQuiz
    ? checkpoint.interactiveQuiz.question
    : checkpoint.socraticQuestion;

  beats.push({
    id: `${checkpoint.id}-question`,
    label: 'Hỏi đáp tại lớp',
    boardMode: 'question',
    pointIndex: 0,
    codeLineIndex: 0,
    slideTitle: 'Cùng kiểm tra lại',
    slideTakeaway: '',
    slidePoints: [],
    spokenScript: `Trước khi mình nối tiếp mạch bài giảng, mình muốn nghe bạn giải thích lại cơ chế vừa xem nhé. ${questionPrompt} Bạn có thể chọn đáp án hoặc bật mic để trả lời.`
  });

  return beats;
}

function toInstructorCheckpoint(section: InstructorSection, index: number): TeachingCheckpoint {
  return {
    id: section.id,
    index: index + 1,
    title: `Phần ${index + 1}: ${section.title}`,
    shortTitle: section.title,
    summary: section.objective,
    keyPoints: section.slides.map((slide) => slide.takeaway),
    visualMarkdown: '',
    boardMarkdown: section.slides
      .map((slide) => `### ${slide.title}\n\n${slide.narration}\n\nÝ cốt lõi: ${slide.takeaway}`)
      .join('\n\n'),
    interactiveQuiz: section.check,
    socraticQuestion: section.check.question,
    quickReplies: [
      'Cho mình một ví dụ khác để kiểm tra hiểu bài',
      'Giải thích vì sao đáp án còn lại chưa đúng',
      'Liên hệ cơ chế này với một API thực tế'
    ],
    type: 'concept'
  };
}

export const AiInstructorClassroom: React.FC<AiInstructorClassroomProps> = ({
  course,
  lesson,
  savedClassroomProgress,
  isLessonCompleted,
  onSaveCheckpoint,
  onLessonCompleted,
  onExitToLesson,
  onExitToHub
}) => {
  const instructorPlan = lesson.id === instructor_c1_l1.lessonId
    ? instructor_c1_l1
    : undefined;
  const checkpoints: TeachingCheckpoint[] = useMemo(
    () => instructorPlan
      ? instructorPlan.sections.map(toInstructorCheckpoint)
      : buildLessonCheckpoints(lesson),
    [lesson, instructorPlan]
  );

  // Lecture Session State
  const [hasStartedClass, setHasStartedClass] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(() => {
    const savedIdx = savedClassroomProgress?.currentCheckpointIndex ?? 0;
    return Math.min(Math.max(0, savedIdx), Math.max(0, checkpoints.length - 1));
  });
  const [passedStepIds, setPassedStepIds] = useState<string[]>(
    () => (savedClassroomProgress?.completedCheckpointIds || []).filter((id) =>
      checkpoints.some((checkpoint) => checkpoint.id === id)
    )
  );
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [visualRevealCount, setVisualRevealCount] = useState(0);

  // Classroom Stage & Camera State
  const [overrideBoardMode, setOverrideBoardMode] =
    useState<BoardDisplayMode | null>(null);
  const [overridePointIndex, setOverridePointIndex] = useState<number | null>(
    null
  );
  const [selectedCodeLine, setSelectedCodeLine] = useState<number>(0);

  // Vietnamese Voice & Real-Time Lip-Sync State
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState<number>(1.05);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveSubtitle, setLiveSubtitle] = useState<string>(
    'Nhấn "Bắt Đầu Tiết Học" để cùng học qua các slide có lời giải thích tiếng Việt.'
  );

  // Student Interaction ("Giơ Tay Hỏi Bài", Mic STT, Quiz, Sandbox Drawer)
  const [isRaisingHand, setIsRaisingHand] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [studentQuestionInput, setStudentQuestionInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [qaHistory, setQaHistory] = useState<ClassroomQaTurn[]>([]);
  const [showNotebookDrawer, setShowNotebookDrawer] = useState(false);
  const [showLaptopSandbox, setShowLaptopSandbox] = useState(false);

  // Quiz Answer State per step
  const [quizSelectionByStep, setQuizSelectionByStep] = useState<
    Record<string, { selectedIndex: number; isCorrect: boolean }>
  >({});

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const raisingHandRef = useRef(false);
  const lectureAutoPlayRef = useRef(true);
  const activeNarrationSentenceIndexRef = useRef(0);
  const resumeAfterQuestionRef = useRef<LectureResumePoint | null>(null);
  const tutorRequestControllerRef = useRef<AbortController | null>(null);
  const pendingTutorAssistantIdRef = useRef<string | null>(null);

  const setLectureAutoPlay = useCallback((enabled: boolean) => {
    lectureAutoPlayRef.current = enabled;
  }, []);

  const currentCheckpoint = checkpoints[activeStepIndex] || checkpoints[0];
  const currentInstructorSection = instructorPlan?.sections[activeStepIndex];
  const currentKeyPoints = useMemo(
    () => currentCheckpoint.keyPoints || [currentCheckpoint.summary],
    [currentCheckpoint]
  );

  const lectureBeats = useMemo(
    () =>
      buildLectureBeatsForStep(
        currentCheckpoint,
        activeStepIndex,
        checkpoints.length,
        currentInstructorSection,
        activeStepIndex === 0 ? instructorPlan?.opening : undefined,
        activeStepIndex === 0 ? instructorPlan?.roadmap : undefined,
        activeStepIndex === checkpoints.length - 1 ? instructorPlan?.closing : undefined
      ),
    [currentCheckpoint, currentInstructorSection, activeStepIndex, checkpoints.length, instructorPlan]
  );

  const currentBeat =
    lectureBeats[Math.min(activeBeatIndex, lectureBeats.length - 1)] ||
    lectureBeats[0];

  const currentQuizAttempt = quizSelectionByStep[currentCheckpoint.id];

  // Reset the classroom only when changing lessons. Progress writes during this
  // lesson must not rewind the active step or interrupt the lecture.
  useEffect(() => {
    stopVietnameseSpeech();
    tutorRequestControllerRef.current?.abort();
    tutorRequestControllerRef.current = null;
    pendingTutorAssistantIdRef.current = null;
    raisingHandRef.current = false;
    resumeAfterQuestionRef.current = null;
    setHasStartedClass(false);
    setActiveStepIndex(
      Math.min(
        Math.max(0, savedClassroomProgress?.currentCheckpointIndex ?? 0),
        Math.max(0, checkpoints.length - 1)
      )
    );
    setPassedStepIds(
      (savedClassroomProgress?.completedCheckpointIds || []).filter((id) =>
        checkpoints.some((checkpoint) => checkpoint.id === id)
      )
    );
    setActiveBeatIndex(0);
    activeNarrationSentenceIndexRef.current = 0;
    setLectureAutoPlay(true);
    setQuizSelectionByStep({});
    setQaHistory([]);
    setIsRaisingHand(false);
    setIsAiThinking(false);
    setShowLaptopSandbox(false);
  }, [lesson.id]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      tutorRequestControllerRef.current?.abort();
      stopVietnameseSpeech();
    };
  }, []);

  // Trigger Vietnamese voice playback for a given script
  const playProfessorVietnameseVoice = useCallback(
    (
      scriptText: string,
      onFinishedBeat?: () => void,
      onSentenceProgress?: (index: number, total: number) => void,
      sentenceOffset = 0
    ) => {
      setLiveSubtitle(scriptText);
      if (!voiceEnabled) {
        stopVietnameseSpeech();
        setIsSpeaking(false);
        onFinishedBeat?.();
        return;
      }

      let didFinish = false;
      const finishPlayback = () => {
        if (didFinish) return;
        didFinish = true;
        setIsSpeaking(false);
        onFinishedBeat?.();
      };

      void speakVietnamese({
        text: scriptText,
        rate: speechRate,
        onStart: () => {
          setIsSpeaking(true);
        },
        onSentenceChange: (sentence, index, total) => {
          activeNarrationSentenceIndexRef.current = sentenceOffset + index;
          setLiveSubtitle(sentence);
          onSentenceProgress?.(index, total);
        },
        onEnd: () => {
          finishPlayback();
        },
        onError: (message) => {
          toast.error(message);
          finishPlayback();
        }
      });
    },
    [voiceEnabled, speechRate]
  );

  const playProfessorVietnameseStream = useCallback(
    (sentences: AsyncIterable<string>, onFinished?: () => void) => {
      let didFinish = false;
      const finishPlayback = () => {
        if (didFinish) return;
        didFinish = true;
        setIsSpeaking(false);
        onFinished?.();
      };

      if (!voiceEnabled) {
        setIsSpeaking(false);
        void (async () => {
          for await (const _sentence of sentences) {
            // Drain the text queue so the lesson flow can finish without audio.
          }
          finishPlayback();
        })();
        return;
      }

      void speakVietnameseStream(sentences, {
        rate: speechRate,
        onStart: () => setIsSpeaking(true),
        onSentenceChange: (sentence) => setLiveSubtitle(sentence),
        onEnd: finishPlayback,
        onError: (message) => {
          toast.error(message);
        }
      });
    },
    [voiceEnabled, speechRate]
  );

  // Automatically run the current Lecture Beat when class is active and not interrupted
  useEffect(() => {
    if (!hasStartedClass || isRaisingHand || showLaptopSandbox) return;

    const beat = lectureBeats[activeBeatIndex];
    if (!beat) return;

    const resumePoint = resumeAfterQuestionRef.current;
    const isResumingSameBeat =
      resumePoint?.stepIndex === activeStepIndex &&
      resumePoint.beatIndex === activeBeatIndex;
    if (!isResumingSameBeat) {
      setOverrideBoardMode(null);
      setOverridePointIndex(null);
    }
    if (beat.boardMode === 'code' && !isResumingSameBeat) {
      setSelectedCodeLine(beat.codeLineIndex);
    }

    let narration = beat.spokenScript;
    let sentenceOffset = 0;
    let autoAdvanceAfterNarration = lectureAutoPlayRef.current;
    const fullSentences = splitIntoVietnameseSentences(beat.spokenScript);
    const totalNarrationSentences = fullSentences.length;

    if (isResumingSameBeat && resumePoint) {
      resumeAfterQuestionRef.current = null;
      if (!resumePoint.shouldResumeAudio) return;
      sentenceOffset = Math.min(
        resumePoint.sentenceIndex,
        Math.max(0, fullSentences.length - 1)
      );
      narration = fullSentences.slice(sentenceOffset).join(' ');
      autoAdvanceAfterNarration = resumePoint.autoPlay;
    } else {
      resumeAfterQuestionRef.current = null;
      activeNarrationSentenceIndexRef.current = 0;
      setVisualRevealCount(0);
      if (!voiceEnabled && beat.instructorVisual) {
        setVisualRevealCount(visualEntryCount(beat.instructorVisual));
      }
    }

    playProfessorVietnameseVoice(
      narration,
      () => {
        if (
          voiceEnabled &&
          autoAdvanceAfterNarration &&
          lectureAutoPlayRef.current &&
          beat.boardMode !== 'question' &&
          activeBeatIndex < lectureBeats.length - 1
        ) {
          setTimeout(() => {
            setActiveBeatIndex((prev) => Math.min(prev + 1, lectureBeats.length - 1));
          }, 650);
        }
      },
      (sentenceIndex) => {
        const entryCount = beat.instructorVisual
          ? visualEntryCount(beat.instructorVisual)
          : 0;
        setVisualRevealCount(
          Math.min(
            entryCount,
            Math.ceil(
              ((sentenceOffset + sentenceIndex + 1) /
                Math.max(1, totalNarrationSentences)) * entryCount
            )
          )
        );
      },
      sentenceOffset
    );
  }, [
    hasStartedClass,
    activeStepIndex,
    activeBeatIndex,
    lectureBeats,
    isRaisingHand,
    showLaptopSandbox,
    voiceEnabled,
    playProfessorVietnameseVoice
  ]);

  // Mark current step passed & persist via onSaveCheckpoint
  const markCurrentStepCompleted = useCallback(
    (stepId: string, stepIdx: number) => {
      const nextCompleted = passedStepIds.includes(stepId)
        ? passedStepIds
        : [...passedStepIds, stepId];
      setPassedStepIds(nextCompleted);

      const nextIdx = Math.min(stepIdx + 1, checkpoints.length - 1);
      const allDone = nextCompleted.length >= checkpoints.length;
      onSaveCheckpoint(
        course.id,
        lesson.id,
        lesson.title,
        stepId,
        nextIdx,
        allDone
      );
      if (allDone) {
        onLessonCompleted(lesson.id);
      }
    },
    [
      passedStepIds,
      checkpoints.length,
      onSaveCheckpoint,
      course.id,
      lesson.id,
      lesson.title,
      onLessonCompleted
    ]
  );

  const pauseForQuestion = useCallback(() => {
    if (!raisingHandRef.current) {
      const isAssessmentBeat = currentBeat?.boardMode === 'question';
      const autoPlay = lectureAutoPlayRef.current;
      resumeAfterQuestionRef.current = {
        stepIndex: activeStepIndex,
        beatIndex: activeBeatIndex,
        sentenceIndex: activeNarrationSentenceIndexRef.current,
        autoPlay,
        shouldResumeAudio:
          voiceEnabled && (isSpeaking || (autoPlay && !isAssessmentBeat))
      };
    }

    raisingHandRef.current = true;
    stopVietnameseSpeech();
    setIsSpeaking(false);
    setIsRaisingHand(true);
    setLectureAutoPlay(false);
  }, [activeBeatIndex, activeStepIndex, currentBeat?.boardMode, isSpeaking, setLectureAutoPlay, voiceEnabled]);

  const finishQuestion = useCallback(
    (passed = false, holdAtAssessment = false) => {
      raisingHandRef.current = false;
      setIsRaisingHand(false);
      const resumePoint = resumeAfterQuestionRef.current;

      if (passed) {
        const nextStepIndex = activeStepIndex + 1;
        const hasNextStep = nextStepIndex < checkpoints.length;
        const hasNextBeat = activeBeatIndex + 1 < lectureBeats.length;
        if (hasNextStep) {
          resumeAfterQuestionRef.current = null;
          setActiveStepIndex(nextStepIndex);
          setActiveBeatIndex(0);
          setLectureAutoPlay(true);
        } else if (hasNextBeat) {
          resumeAfterQuestionRef.current = null;
          setActiveBeatIndex(activeBeatIndex + 1);
          setLectureAutoPlay(true);
        } else {
          resumeAfterQuestionRef.current = {
            stepIndex: activeStepIndex,
            beatIndex: activeBeatIndex,
            sentenceIndex: 0,
            autoPlay: false,
            shouldResumeAudio: false
          };
          setLectureAutoPlay(false);
        }
        return;
      }

      if (holdAtAssessment && resumePoint) {
        resumeAfterQuestionRef.current = {
          ...resumePoint,
          autoPlay: false,
          shouldResumeAudio: false
        };
        setLectureAutoPlay(false);
        return;
      }

      setLectureAutoPlay(resumePoint?.autoPlay ?? false);
    },
    [activeBeatIndex, activeStepIndex, checkpoints.length, lectureBeats.length, setLectureAutoPlay]
  );

  const playCurrentBeatFromCurrentSentence = (autoAdvance: boolean) => {
    if (!currentBeat) return;
    const sentences = splitIntoVietnameseSentences(currentBeat.spokenScript);
    const sentenceOffset = Math.min(
      activeNarrationSentenceIndexRef.current,
      Math.max(0, sentences.length - 1)
    );
    const narration = sentences.slice(sentenceOffset).join(' ');
    const entryCount = currentBeat.instructorVisual
      ? visualEntryCount(currentBeat.instructorVisual)
      : 0;
    setLectureAutoPlay(autoAdvance);
    playProfessorVietnameseVoice(
      narration,
      () => {
        if (
          autoAdvance &&
          voiceEnabled &&
          lectureAutoPlayRef.current &&
          currentBeat.boardMode !== 'question' &&
          activeBeatIndex < lectureBeats.length - 1
        ) {
          setTimeout(() => {
            setActiveBeatIndex((previous) => Math.min(previous + 1, lectureBeats.length - 1));
          }, 650);
        }
      },
      (sentenceIndex) => {
        setVisualRevealCount(
          Math.min(
            entryCount,
            Math.ceil(
              ((sentenceOffset + sentenceIndex + 1) / Math.max(1, sentences.length)) *
                entryCount
            )
          )
        );
      },
      sentenceOffset
    );
  };

  // Start the live lecture session
  const handleStartLectureSession = () => {
    setHasStartedClass(true);
    setActiveBeatIndex(0);
    resumeAfterQuestionRef.current = null;
    setLectureAutoPlay(true);
    toast.success('Đã vào lớp học! Mình bắt đầu bài học nhé.');
  };

  // Switch to another Step in the lesson
  const handleSelectStep = (idx: number) => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListeningMic(false);
    tutorRequestControllerRef.current?.abort();
    tutorRequestControllerRef.current = null;
    const pendingAssistantId = pendingTutorAssistantIdRef.current;
    if (pendingAssistantId) {
      setQaHistory((previous) =>
        previous.map((message) =>
          message.id === pendingAssistantId
            ? { ...message, content: 'Câu hỏi đã dừng khi mình chuyển sang phần khác.' }
            : message
        )
      );
    }
    pendingTutorAssistantIdRef.current = null;
    raisingHandRef.current = false;
    resumeAfterQuestionRef.current = null;
    stopVietnameseSpeech();
    setIsSpeaking(false);
    setActiveStepIndex(idx);
    setActiveBeatIndex(0);
    setIsAiThinking(false);
    setIsRaisingHand(false);
    setLectureAutoPlay(true);
    setOverrideBoardMode(null);
    setOverridePointIndex(null);

    if (checkpoints[idx]?.type === 'final-practice') {
      setShowLaptopSandbox(true);
    } else {
      setShowLaptopSandbox(false);
    }
  };

  // Student clicks "✋ Giơ Tay Hỏi Bài" to interrupt and ask a question
  const handleToggleRaiseHand = () => {
    if (!raisingHandRef.current) {
      pauseForQuestion();
    } else {
      if (isAiThinking) {
        tutorRequestControllerRef.current?.abort();
        tutorRequestControllerRef.current = null;
        setIsAiThinking(false);
        const pendingAssistantId = pendingTutorAssistantIdRef.current;
        if (pendingAssistantId) {
          setQaHistory((previous) =>
            previous.map((message) =>
              message.id === pendingAssistantId
                ? { ...message, content: 'Mình đã dừng câu hỏi theo yêu cầu.' }
                : message
            )
          );
        }
        pendingTutorAssistantIdRef.current = null;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListeningMic(false);
      stopVietnameseSpeech();
      setIsSpeaking(false);
      finishQuestion(false, currentBeat?.boardMode === 'question');
    }
  };

  // Vietnamese Speech-To-Text (Mic Input)
  const toggleMicrophoneSTT = () => {
    if (isListeningMic && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningMic(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error(
        'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Bạn hãy dùng Chrome hoặc Edge nhé!'
      );
      return;
    }

    pauseForQuestion();

    const recognition = new SpeechRec();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setStudentQuestionInput(transcript);
    };

    recognition.onerror = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListeningMic(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListeningMic(false);
    };

    recognitionRef.current = recognition;
    setIsListeningMic(true);
    recognition.start();
  };

  // Send Student Question or Oral Answer to the AI Instructor via /api/tutor
  const handleAskProfessor = useCallback(
    async (customQuestion?: string) => {
      const content = (customQuestion ?? studentQuestionInput).trim();
      if (!content || isAiThinking) return;

      pauseForQuestion();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListeningMic(false);
      stopVietnameseSpeech();
      setStudentQuestionInput('');
      setIsAiThinking(true);
      setLiveSubtitle('Mình đang soạn câu trả lời cho bạn...');

      const userMsg: ClassroomQaTurn = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      };
      const assistantMsgId = `ai-${Date.now() + 1}`;
      pendingTutorAssistantIdRef.current = assistantMsgId;
      const placeholderAiMsg: ClassroomQaTurn = {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Đang soạn câu trả lời…',
        createdAt: new Date().toISOString()
      };

      const nextHistory = [...qaHistory, userMsg];
      setQaHistory([...nextHistory, placeholderAiMsg]);

      const requestController = new AbortController();
      tutorRequestControllerRef.current?.abort();
      tutorRequestControllerRef.current = requestController;

      const isAssessmentBeat = currentBeat?.boardMode === 'question';
      let streamedSpeechQueue: AsyncSentenceQueue | null = null;
      let streamedSpeechRemainder = '';
      let streamedSpeechPassed = false;
      const activeKeyPoints = instructorPlan && !isAssessmentBeat && currentBeat?.slideTakeaway
        ? [currentBeat.slideTakeaway]
        : currentKeyPoints;
      const activeBoardMarkdown = instructorPlan && !isAssessmentBeat && currentBeat
        ? [
            `### ${currentBeat.slideTitle}`,
            currentBeat.slideSubtitle,
            currentBeat.spokenScript,
            currentBeat.slideTakeaway ? `Ý cốt lõi: ${currentBeat.slideTakeaway}` : ''
          ].filter(Boolean).join('\n\n')
        : currentCheckpoint.boardMarkdown;
      const activeAssessmentQuestion = isAssessmentBeat
        ? currentCheckpoint.interactiveQuiz?.question || currentCheckpoint.socraticQuestion
        : 'Chưa đến lượt kiểm tra; tiếp tục giảng nội dung hiện tại.';

      const systemStageContext = `
[CHẾ ĐỘ TRỢ GIẢNG TRỰC TIẾP QUA BẢNG THÔNG MINH — NÓI TIẾNG VIỆT TỰ NHIÊN]
- Bạn là người hướng dẫn thân thiện, đang học và giải thích cùng người học qua Bảng Tương Tác Thông Minh.
- Bài học hiện tại: "${lesson.title}" (${course.title}).
- Ý đang được giảng trên bảng: "${currentCheckpoint.shortTitle || currentCheckpoint.title}".
- Nhịp đang diễn ra: "${currentBeat?.slideTitle || currentBeat?.label}" (${currentBeat?.boardMode || 'keypoints'}).
- Lời giảng của slide hiện tại: "${currentBeat?.spokenScript || ''}".
- Các ý chính đang chiếu trên bảng:
${activeKeyPoints.map((kp, i) => `  ${i + 1}. ${kp}`).join('\n')}
- Nội dung hỏi đáp hiện tại: "${activeAssessmentQuestion}"

QUY TẮC PHẢN HỒI (TỐI ĐA 130–180 TỪ, ĐỂ ĐỌC BẰNG GIỌNG NAM TIẾNG VIỆT TỰ NHIÊN):
1. Đây là cuộc trao đổi giữa giảng viên và học viên: luôn xưng "mình", gọi người học là "bạn"; không dùng "ĐẠI CA", "em", "thầy" hoặc "cô".
2. Giải thích thẳng vào bản chất câu hỏi của học viên, liên hệ trực tiếp tới ý trên bảng.
3. Chỉ đánh giá câu trả lời kiểm tra khi nhịp đang diễn ra là "question". Nếu học viên hỏi chen ngang lúc đang giảng, trả lời câu hỏi của họ rồi nối lại slide; không tự chuyển cuộc nói chuyện thành câu đố.
4. Không đưa câu hỏi kiểm tra trước khi nội dung tương ứng đã được giảng xong. Khi nhịp là "question", đánh giá đúng/sai theo kiến thức trên bảng, chỉ ra phần hiểu đúng hoặc cần sửa; nếu đạt ý cốt lõi, kèm đúng thẻ \`[CHECKPOINT_PASSED]\` ở cuối câu trả lời.
5. Nếu câu hỏi mơ hồ, hỏi lại một câu ngắn. Chỉ đặt câu hỏi gợi mở khi nó giúp làm rõ nội dung đang học.
`;

      try {
        const sessionId = `classroom_live_${course.id}_${lesson.id}`;
        await chatDbService.authorizeTutorSession(
          sessionId,
          lesson.id,
          `Lớp học 1-1: ${lesson.title}`
        );
        if (requestController.signal.aborted) return;

        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/json'
          },
          credentials: 'include',
          signal: requestController.signal,
          body: JSON.stringify({
            sessionId,
            mode: 'instructor-1on1',
            courseTitle: course.title,
            checkpoint: {
              index: activeStepIndex + 1,
              total: checkpoints.length,
              title: currentCheckpoint.title,
              boardMarkdown: activeBoardMarkdown,
              socraticQuestion: isAssessmentBeat ? activeAssessmentQuestion : ''
            },
            lesson: {
              title: instructorPlan
                ? lesson.title
                : `${lesson.title} — [Lớp Học 1-1: ${currentCheckpoint.title}]`,
              tag: lesson.tag,
              theory: `${systemStageContext}\n\n${activeBoardMarkdown}`,
              realCodeSnippet:
                currentCheckpoint.codeExcerpt || lesson.realCodeSnippet
            },
            messages: nextHistory.slice(-10).map((m) => ({
              role: m.role,
              content: m.content
            })),
            model: MODEL_OPTIONS[0].id,
            stream: true
          })
        });

        if (!response.ok) {
          const failure = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(failure.error || `Không lấy được câu trả lời (HTTP ${response.status}).`);
        }

        const contentType = response.headers.get('content-type') || '';
        let finalAccumulated = '';

        if (
          response.ok &&
          contentType.includes('text/event-stream') &&
          response.body
        ) {
          if (voiceEnabled) {
            streamedSpeechQueue = new AsyncSentenceQueue();
            playProfessorVietnameseStream(streamedSpeechQueue, () => {
              if (!raisingHandRef.current) return;
              finishQuestion(streamedSpeechPassed, isAssessmentBeat);
            });
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
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
                const parsed = JSON.parse(dataContent) as {
                  text?: string;
                  error?: string;
                };
                if (parsed.text) {
                  finalAccumulated += parsed.text;
                  const cleanChunk = finalAccumulated
                    .replace(/\[CHECKPOINT_PASSED\]/g, '')
                    .trim();
                  if (!streamedSpeechQueue) setLiveSubtitle(cleanChunk);
                  setQaHistory((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: cleanChunk } : m
                    )
                  );
                  if (streamedSpeechQueue) {
                    const extracted = extractCompleteSpeechSentences(
                      streamedSpeechRemainder + parsed.text
                    );
                    streamedSpeechRemainder = extracted.remainder;
                    extracted.sentences.forEach((sentence) =>
                      streamedSpeechQueue?.push(sentence)
                    );
                  }
                }
              } catch {
                // ignore malformed SSE line
              }
            }
          }
        } else {
          const json = (await response.json()) as {
            reply?: string;
            error?: string;
          };
          if (json.error) throw new Error(json.error);
          finalAccumulated = json.reply || '';
        }

        setIsAiThinking(false);
        const passed = finalAccumulated.includes('[CHECKPOINT_PASSED]');
        streamedSpeechPassed = passed;
        const cleanSpoken = finalAccumulated
          .replace(/\[CHECKPOINT_PASSED\]/g, '')
          .trim();
        if (!cleanSpoken) throw new Error('Giảng viên chưa tạo được câu trả lời.');

        setQaHistory((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: cleanSpoken } : m
          )
        );
        pendingTutorAssistantIdRef.current = null;

        if (passed) {
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.65 }
          });
          markCurrentStepCompleted(currentCheckpoint.id, activeStepIndex);
          toast.success('Tốt, mình đã ghi nhận câu trả lời. Bài giảng tiếp tục nhé.');
        }

        if (streamedSpeechQueue) {
          const extracted = extractCompleteSpeechSentences(streamedSpeechRemainder, true);
          extracted.sentences.forEach((sentence) => streamedSpeechQueue?.push(sentence));
          streamedSpeechQueue.close();
        } else {
          playProfessorVietnameseVoice(cleanSpoken, () => {
            finishQuestion(passed, isAssessmentBeat);
          });
        }
      } catch (error) {
        if (requestController.signal.aborted) {
          streamedSpeechQueue?.close();
          return;
        }
        setIsAiThinking(false);
        tutorRequestControllerRef.current = null;
        pendingTutorAssistantIdRef.current = null;
        const errorMessage = error instanceof Error ? error.message : 'Không rõ nguyên nhân.';
        const fallbackReply = 'Mình chưa lấy được câu trả lời lúc này. Mình giữ nguyên slide để bạn thử gửi lại câu hỏi nhé.';
        setQaHistory((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fallbackReply } : m
          )
        );
        toast.error(`Chưa nhận được phản hồi từ trợ giảng: ${errorMessage}`);
        if (streamedSpeechQueue) {
          streamedSpeechQueue.push(fallbackReply);
          streamedSpeechQueue.close();
        } else {
          playProfessorVietnameseVoice(fallbackReply, () => {
            finishQuestion(false, isAssessmentBeat);
          });
        }
      } finally {
        if (tutorRequestControllerRef.current === requestController) {
          tutorRequestControllerRef.current = null;
        }
      }
    },
    [
      studentQuestionInput,
      isAiThinking,
      pauseForQuestion,
      qaHistory,
      lesson.id,
      lesson.title,
      lesson.tag,
      lesson.realCodeSnippet,
      course.id,
      course.title,
      activeStepIndex,
      checkpoints.length,
      activeBeatIndex,
      lectureBeats.length,
      currentCheckpoint,
      currentBeat,
      currentKeyPoints,
      instructorPlan,
      voiceEnabled,
      markCurrentStepCompleted,
      finishQuestion,
      playProfessorVietnameseVoice,
      playProfessorVietnameseStream
    ]
  );

  // Student selects a 1-click Multiple Choice Answer on the Lecture Hall Question Overlay
  const handleSelectQuizOption = (optionIndex: number) => {
    if (isAiThinking) return;
    const quiz = currentCheckpoint.interactiveQuiz;
    if (!quiz) return;

    const isCorrect = optionIndex === quiz.correctIndex;
    setQuizSelectionByStep((prev) => ({
      ...prev,
      [currentCheckpoint.id]: { selectedIndex: optionIndex, isCorrect }
    }));

    if (isCorrect) {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.68 }
      });

      raisingHandRef.current = false;
      resumeAfterQuestionRef.current = null;
      setIsRaisingHand(false);
      setLectureAutoPlay(true);

      markCurrentStepCompleted(currentCheckpoint.id, activeStepIndex);

      const praiseScript = `Chính xác rồi. ${quiz.explanation} Mình nối tiếp mạch bài giảng nhé.`;
      toast.success('Chính xác. Bài giảng tiếp tục.');

      playProfessorVietnameseVoice(praiseScript, () => {
        if (activeStepIndex < checkpoints.length - 1) {
          setActiveStepIndex((prev) => prev + 1);
          setActiveBeatIndex(0);
          setLectureAutoPlay(true);
        } else if (activeBeatIndex < lectureBeats.length - 1) {
          setActiveBeatIndex((prev) => Math.min(prev + 1, lectureBeats.length - 1));
          setLectureAutoPlay(true);
        }
      });
    } else {
      const hintScript = `Đáp án này chưa đúng. Mình gợi ý lại nhé: ${quiz.explanation} Bạn thử chọn lại đáp án xem sao.`;
      toast.error('Chưa chính xác. Mình nghe gợi ý rồi thử lại nhé.');
      playProfessorVietnameseVoice(hintScript);
    }
  };

  // Derived Scene props
  const effectiveBoardMode: BoardDisplayMode =
    overrideBoardMode || currentBeat?.boardMode || 'keypoints';
  const effectivePointIndex =
    overridePointIndex !== null
      ? overridePointIndex
      : (currentBeat?.pointIndex ?? 0);
  const effectiveCodeLine =
    effectiveBoardMode === 'code'
      ? selectedCodeLine
      : (currentBeat?.codeLineIndex ?? 0);

  const progressPercentage = Math.round(
    (passedStepIds.length / Math.max(1, checkpoints.length)) * 100
  );

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#F5F0E6] text-stone-800">
      <Toaster position="top-center" richColors theme="light" />

      {/* =====================================================================
          1. TOP BRIGHT CLASSROOM HEADER BAR
         ===================================================================== */}
      <header className="z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-stone-200/90 bg-white/95 px-3 py-1 shadow-xs backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="auto"
            type="button"
            onClick={() => {
              stopVietnameseSpeech();
              onExitToLesson();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-700 transition hover:border-sky-500 hover:bg-white hover:text-sky-700 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Về Bài Học
          </Button>

          <Button
            variant="ghost"
            size="auto"
            type="button"
            onClick={() => {
              stopVietnameseSpeech();
              onExitToHub();
            }}
            className="hidden rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 lg:inline-flex cursor-pointer"
          >
            Danh Sách Khóa Học
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            {!instructorPlan && (
              <span className="hidden items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 xl:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LỚP TRỰC TIẾP
              </span>
            )}
            <h1 className="max-w-[220px] truncate text-sm font-extrabold text-stone-900 sm:max-w-[320px]">
              {lesson.title}
            </h1>
          </div>
        </div>

        {!instructorPlan && (
          <div className="order-3 flex w-full items-center gap-1 overflow-x-auto py-0.5 lg:order-none lg:w-auto lg:max-w-[58vw]">
            {checkpoints.map((cp, idx) => {
              const isCurrent = idx === activeStepIndex;
              const isPassed = passedStepIds.includes(cp.id);
              return (
                <Button
                  variant="ghost"
                  size="auto"
                  key={cp.id}
                  type="button"
                  onClick={() => handleSelectStep(idx)}
                  className={`relative flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                    isCurrent
                      ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-2xs'
                      : isPassed
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:bg-white'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-extrabold ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-sky-600 text-white'
                          : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {isPassed ? <Check size={10} strokeWidth={3} /> : idx + 1}
                  </span>
                  <span className="max-w-[92px] truncate">
                    {cp.shortTitle || cp.title}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

      </header>

      {/* =====================================================================
          2. MAIN BRIGHT DAYLIGHT CLASSROOM VIEWPORT
         ===================================================================== */}
      <div className="relative flex-1 overflow-hidden">
        <InteractiveSmartboardClassroom
          lessonTitle={lesson.title}
          continuousLesson={Boolean(instructorPlan)}
          stepTitle={currentCheckpoint.title}
          stepIndex={activeStepIndex}
          totalSteps={checkpoints.length}
          boardMode={effectiveBoardMode}
          keyPoints={currentKeyPoints}
          activePointIndex={effectivePointIndex}
          slideTitle={currentBeat?.slideTitle}
          slideTakeaway={currentBeat?.slideTakeaway}
          slidePoints={currentBeat?.slidePoints}
          slideSubtitle={currentBeat?.slideSubtitle}
          instructorVisual={currentBeat?.instructorVisual}
          visualRevealCount={visualRevealCount}
          slideIndex={lectureBeats.slice(0, activeBeatIndex).filter((beat) => beat.boardMode === 'keypoints').length}
          slideCount={lectureBeats.filter((beat) => beat.boardMode === 'keypoints').length}
          visualDiagramText={
            currentCheckpoint.visualMarkdown || currentCheckpoint.boardMarkdown
          }
          codeSnippet={
            currentCheckpoint.codeExcerpt || lesson.realCodeSnippet || ''
          }
          activeCodeLine={effectiveCodeLine}
          questionText={
            currentCheckpoint.interactiveQuiz?.question ||
            currentCheckpoint.socraticQuestion
          }
          questionOptions={currentCheckpoint.interactiveQuiz?.options}
          selectedQuestionOption={currentQuizAttempt?.selectedIndex}
          correctQuestionOption={currentCheckpoint.interactiveQuiz?.correctIndex}
          questionAnsweredCorrectly={currentQuizAttempt?.isCorrect}
          onSelectQuestionOption={handleSelectQuizOption}
          onSelectBoardPoint={(ptIdx) => {
            if (isAiThinking) return;
            pauseForQuestion();
            setOverrideBoardMode('keypoints');
            setOverridePointIndex(ptIdx);
            const selectedPt = currentKeyPoints[ptIdx] || '';
            void handleAskProfessor(
              `Giải thích sâu hơn và cho ví dụ thực tế về mục số #${ptIdx + 1} trên bảng này giúp mình nhé: "${selectedPt}"`
            );
          }}
          onSelectCodeLine={(lineIdx, lineText) => {
            if (isAiThinking) return;
            pauseForQuestion();
            setSelectedCodeLine(lineIdx);
            setOverrideBoardMode('code');
            void handleAskProfessor(
              `Giải thích giúp mình dòng code số #${lineIdx + 1} trên bảng hoạt động thế nào: "${lineText.trim()}"`
            );
          }}
          onSwitchBoardMode={(mode) => {
            setLectureAutoPlay(false);
            setOverrideBoardMode(mode);
          }}
        />

        {/* -----------------------------------------------------------------
            PRE-CLASS WELCOME OVERLAY (Bright & Friendly Invitation)
           ----------------------------------------------------------------- */}
        <AnimatePresence>
          {!hasStartedClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-stone-900/35 p-4 backdrop-blur-xs"
            >
              <motion.div
                initial={{ scale: 0.94, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.94, y: 12 }}
                className="max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-2xl"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                  <BookOpen size={24} />
                </div>
                <h2 className="mt-3 text-2xl font-extrabold text-stone-900">
                  {lesson.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  Mình bắt đầu từ một tình huống thực tế, rồi cùng lần theo từng cơ chế trên bảng.
                </p>

                <Button
                  variant="ghost"
                  size="auto"
                  type="button"
                  onClick={handleStartLectureSession}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-105 cursor-pointer"
                >
                  <Play size={20} fill="currentColor" />
                  Bắt đầu bài học
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            CURRENT SLIDE PROGRESS
           ----------------------------------------------------------------- */}
        {hasStartedClass && !instructorPlan && (
          <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-stone-200/70">
            <div className="h-full bg-sky-500 transition-[width] duration-300" style={{ width: `${Math.round(((activeBeatIndex + 1) / lectureBeats.length) * 100)}%` }} />
          </div>
        )}

        {/* -----------------------------------------------------------------
            3. LIVE SUBTITLE & STUDENT DESK HUD (Warm Light Mode)
           ----------------------------------------------------------------- */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-1 px-2 pb-1 pt-1 sm:px-3">
          {/* Live Spoken Vietnamese Subtitle Box */}
          {hasStartedClass && (
            <div className="pointer-events-auto flex w-full max-w-7xl items-center gap-2 rounded-xl border border-stone-200/90 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
              <p className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-snug text-stone-800 sm:text-sm">
                &ldquo;{liveSubtitle}&rdquo;
              </p>
            </div>
          )}

          {/* Student Desk Interactive Controls Bar */}
          <div className="pointer-events-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-1.5 rounded-xl border border-stone-300/90 bg-white/95 p-1.5 shadow-lg backdrop-blur-md md:flex-nowrap">
            {/* Left Desk Actions: Raise Hand + Voice Mic */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="auto"
                type="button"
                aria-label={voiceEnabled ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
                aria-pressed={voiceEnabled}
                onClick={() => {
                  const next = !voiceEnabled;
                  setVoiceEnabled(next);
                  if (!next) {
                    stopVietnameseSpeech();
                    setIsSpeaking(false);
                    if (raisingHandRef.current && !isAiThinking) {
                      finishQuestion(false, currentBeat?.boardMode === 'question');
                    }
                  }
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer ${voiceEnabled ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-stone-300 bg-stone-100 text-stone-500'}`}
              >
                {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </Button>

              <Select
                value={String(speechRate)}
                onValueChange={(value) => setSpeechRate(Number(value))}
              >
                <SelectTrigger
                  aria-label="Tốc độ đọc"
                  size="sm"
                  className="w-[72px] border-stone-300 bg-white px-2 text-[11px] font-bold text-stone-700 focus-visible:border-sky-500 focus-visible:ring-sky-500/20"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-stone-200 bg-white text-stone-800">
                  {[0.85, 0.95, 1, 1.05, 1.15, 1.25, 1.35].map((rate) => (
                    <SelectItem key={rate} value={String(rate)} className="focus:bg-sky-50 focus:text-sky-900">
                      {rate}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                aria-label={isSpeaking ? 'Tạm dừng' : 'Nghe tiếp'}
                onClick={() => {
                  if (isSpeaking) {
                    stopVietnameseSpeech();
                    setIsSpeaking(false);
                    setLectureAutoPlay(false);
                  } else {
                    playCurrentBeatFromCurrentSentence(true);
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-700 hover:border-sky-400 hover:bg-white cursor-pointer"
              >
                {isSpeaking ? <Pause size={14} /> : <Play size={14} />}
              </Button>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                aria-label="Nghe lại"
                onClick={() => playProfessorVietnameseVoice(currentBeat?.spokenScript || liveSubtitle)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-700 hover:bg-white cursor-pointer"
              >
                <RotateCcw size={14} />
              </Button>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                aria-label="Slide tiếp theo"
                disabled={isRaisingHand || isAiThinking}
                onClick={() => {
                  stopVietnameseSpeech();
                  if (activeBeatIndex < lectureBeats.length - 1) {
                    setActiveBeatIndex((prev) => prev + 1);
                  } else if (activeStepIndex < checkpoints.length - 1) {
                    handleSelectStep(activeStepIndex + 1);
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"
              >
                <SkipForward size={14} />
              </Button>

              <span className="mx-0.5 h-5 w-px bg-stone-200" />

              <Button
                variant="ghost"
                size="auto"
                type="button"
                aria-pressed={isRaisingHand}
                onClick={handleToggleRaiseHand}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                  isRaisingHand
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Hand size={16} />
                {isAiThinking
                  ? 'Đang soạn câu trả lời'
                  : isListeningMic
                    ? 'Đang nghe câu hỏi'
                    : isRaisingHand && isSpeaking
                      ? 'Đang trả lời'
                      : isRaisingHand
                        ? 'Đang hỏi bài'
                        : 'Hỏi bài'}
              </Button>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={toggleMicrophoneSTT}
                disabled={isAiThinking}
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                  isListeningMic
                    ? 'border-rose-500 bg-rose-500 text-white animate-pulse'
                    : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-sky-500 hover:bg-white'
                }`}
                title="Bật mic để hỏi bằng tiếng Việt"
              >
                {isListeningMic ? <MicOff size={15} /> : <Mic size={15} />}
                {isListeningMic ? 'Đang nghe tiếng Việt...' : 'Nói tiếng Việt'}
              </Button>
            </div>

            {/* Center Input: Ask Question or Answer Directly */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAskProfessor();
              }}
                className="flex min-w-[180px] flex-1 items-center gap-1.5"
            >
              <Input
                type="text"
                value={studentQuestionInput}
                onChange={(e) => setStudentQuestionInput(e.target.value)}
                onFocus={() => {
                  pauseForQuestion();
                }}
                placeholder="Hỏi thêm hoặc trả lời câu hỏi tại lớp..."
                className="h-auto w-full rounded-lg border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:bg-white focus-visible:ring-sky-500/20 md:text-xs"
              />
              <Button
                variant="ghost"
                size="auto"
                type="submit"
                disabled={!studentQuestionInput.trim() || isAiThinking}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-sky-500 disabled:opacity-40 cursor-pointer"
              >
                <Send size={14} />
                Gửi
              </Button>
            </form>

            {/* Right Desk Actions: Open Student Laptop (Code Sandbox) & Notebook */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => {
                  stopVietnameseSpeech();
                  setShowLaptopSandbox((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                  showLaptopSandbox
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Laptop size={15} />
                Laptop Thực Hành
              </Button>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => setShowNotebookDrawer((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-white cursor-pointer"
                title="Xem Sổ Ghi Chép & Lịch Sử Hỏi Đáp"
              >
                <MessageSquare size={14} />
                Sổ Tay ({qaHistory.length})
              </Button>

              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => {
                  onLessonCompleted(lesson.id);
                  confetti({
                    particleCount: 100,
                    spread: 80,
                    origin: { y: 0.6 }
                  });
                  toast.success('Chúc mừng bạn đã hoàn thành bài học!');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                  isLessonCompleted || progressPercentage >= 100
                    ? 'bg-emerald-600 text-white'
                    : 'border border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-500'
                }`}
              >
                <CheckCircle2 size={14} />
                {isLessonCompleted ? 'Đã Hoàn Thành' : 'Hoàn Thành'}
              </Button>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            4. STUDENT LAPTOP OVERLAY (Live Code Practice)
           ----------------------------------------------------------------- */}
        <AnimatePresence>
          {showLaptopSandbox && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="absolute inset-4 z-30 flex flex-col overflow-hidden rounded-3xl border-2 border-stone-300 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Laptop size={18} className="text-emerald-600" />
                  <span className="text-sm font-extrabold text-stone-900">
                    Laptop Học Viên Trên Bàn Học — Thực Hành Live Sandbox
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="auto"
                  type="button"
                  onClick={() => setShowLaptopSandbox(false)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Đóng Laptop (Quay lại nhìn Bảng Trắng)
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <CodeSandboxTab
                  lesson={lesson}
                  onLessonCompleted={(completedId) => {
                    onLessonCompleted(completedId);
                    confetti({
                      particleCount: 90,
                      spread: 75,
                      origin: { y: 0.6 }
                    });
                    toast.success(
                      'Mình làm tốt lắm! Bạn đã hoàn thành phần thực hành.'
                    );
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            5. STUDENT NOTEBOOK & Q&A DRAWER (Light Mode Slide-over on Right)
           ----------------------------------------------------------------- */}
        <AnimatePresence>
          {showNotebookDrawer && (
            <motion.div
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              className="absolute bottom-24 right-4 top-4 z-30 flex w-96 flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-sky-600" />
                  <span className="text-xs font-extrabold text-stone-900">
                    Sổ Tay Lớp Học & Lịch Sử Hỏi Đáp
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="auto"
                  type="button"
                  onClick={() => setShowNotebookDrawer(false)}
                  className="text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
                >
                  Đóng
                </Button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="text-[11px] font-extrabold text-amber-900">
                    TÓM TẮT TRÊN BẢNG ({currentCheckpoint.title})
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
                    {currentKeyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-extrabold text-sky-700">
                          {i + 1}.
                        </span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {qaHistory.length === 0 ? (
                  <p className="py-6 text-center text-xs text-stone-500">
                    Chưa có câu hỏi riêng nào. Bạn hãy chọn &ldquo;Hỏi bài&rdquo;
                    hoặc bấm vào nội dung trên bảng để hỏi thêm nhé!
                  </p>
                ) : (
                  qaHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-3 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'ml-6 border border-sky-200 bg-sky-50 text-sky-950'
                          : 'mr-4 border border-stone-200 bg-stone-50 text-stone-800'
                      }`}
                    >
                      <div className="mb-1 text-[10px] font-extrabold uppercase text-stone-500">
                        {msg.role === 'user'
                          ? 'Bạn hỏi tại lớp:'
                          : 'Mình trả lời:'}
                      </div>
                      {msg.content}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
