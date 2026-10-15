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
  Video,
  Monitor,
  UserCheck,
  Maximize2,
  Laptop,
  MessageSquare,
  Sparkles,
  Check,
  XCircle,
  BookOpen
} from 'lucide-react';
import { buildLessonCheckpoints } from '../../data/courses.ts';
import type {
  CourseDefinition,
  Lesson,
  TeachingCheckpoint
} from '../../data/curriculum/types.ts';
import type { ClassroomCheckpointProgress } from '../../types/user.ts';
import { chatDbService } from '../../services/db/chatDbService.ts';
import { MODEL_OPTIONS } from '../../context/TutorChatContext.tsx';
import {
  speakVietnamese,
  stopVietnameseSpeech
} from '../../services/vietnameseVoiceService.ts';
import {
  LectureHall3DScene,
  type InstructorStagePose,
  type CameraPreset,
  type BoardDisplayMode
} from './LectureHall3DScene.tsx';
import { CodeSandboxTab } from '../lesson/CodeSandboxTab.tsx';

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
  pose: InstructorStagePose;
  pointIndex: number;
  codeLineIndex: number;
  spokenScript: string;
}

/**
 * Build a progressive, spoken Vietnamese lecture script for a checkpoint step
 * so the Teacher teaches beat-by-beat on the Interactive White Smartboard.
 */
function buildLectureBeatsForStep(
  checkpoint: TeachingCheckpoint,
  stepIdx: number,
  totalSteps: number
): LectureBeat[] {
  const beats: LectureBeat[] = [];
  const keyPoints = checkpoint.keyPoints || [checkpoint.summary];

  // Beat 1: Teacher introduces the section
  beats.push({
    id: `${checkpoint.id}-intro`,
    label: 'Mở đầu phần giảng',
    boardMode: 'keypoints',
    pose: 'podium_speaking',
    pointIndex: 0,
    codeLineIndex: 0,
    spokenScript:
      stepIdx === 0
        ? `Chào mừng em đến với tiết học trực tiếp hôm nay! Chúng ta bắt đầu Phần 1: ${checkpoint.title}. Em hãy nhìn lên bảng thông minh phía trước để nắm bức tranh tổng thể nhé.`
        : `Bây giờ cô trò mình chuyển sang Phần ${stepIdx + 1} trên ${totalSteps}: ${checkpoint.title}. Đây là phần kiến thức rất quan trọng trong thực tế.`
  });

  // Beats 2..k: Teacher points wand at each Key Takeaway on the White Smartboard
  keyPoints.forEach((point, idx) => {
    const cleanPoint = point.replace(/`([^`]+)`/g, '$1').trim();
    beats.push({
      id: `${checkpoint.id}-kp-${idx}`,
      label: `Ý chính #${idx + 1}`,
      boardMode: 'keypoints',
      pose: 'pointing_board',
      pointIndex: idx,
      codeLineIndex: 0,
      spokenScript: `Em chú ý vào mục số ${idx + 1} cô đang chỉ trên bảng trắng nhé: ${cleanPoint}`
    });
  });

  // Optional Diagram beat if visual diagram exists
  if (checkpoint.visualMarkdown && checkpoint.visualMarkdown.trim().length > 20) {
    beats.push({
      id: `${checkpoint.id}-diagram`,
      label: 'Phân tích sơ đồ',
      boardMode: 'diagram',
      pose: 'pointing_board',
      pointIndex: 0,
      codeLineIndex: 0,
      spokenScript: `Cô chiếu sơ đồ kiến trúc lên bảng để em dễ hình dung luồng chạy thực tế của ${checkpoint.title}. Hãy quan sát cách các thành phần kết nối với nhau.`
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
      pose: 'pointing_board',
      pointIndex: 0,
      codeLineIndex: importantLineIdx,
      spokenScript: `Bây giờ cô chuyển bảng sang chế độ mổ xẻ code. Em nhìn vào dòng số ${importantLineIdx + 1}: đây chính là cách triển khai ${checkpoint.title} trong dự án thực tế.`
    });
  }

  // Final Beat of the Step: Teacher asks the student a check question
  const questionPrompt = checkpoint.interactiveQuiz
    ? checkpoint.interactiveQuiz.question
    : checkpoint.socraticQuestion;

  beats.push({
    id: `${checkpoint.id}-question`,
    label: 'Hỏi đáp tại lớp',
    boardMode: 'question',
    pose: 'asking_student',
    pointIndex: 0,
    codeLineIndex: 0,
    spokenScript: `Trước khi qua phần tiếp theo, cô hỏi nhanh để kiểm tra xem em đã nắm chắc chưa nhé: ${questionPrompt} Em hãy chọn đáp án hoặc bật mic trả lời ngay tại bàn học!`
  });

  return beats;
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
  const checkpoints: TeachingCheckpoint[] = useMemo(
    () => buildLessonCheckpoints(lesson),
    [lesson]
  );

  // Lecture Session State
  const [hasStartedClass, setHasStartedClass] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(() => {
    const savedIdx = savedClassroomProgress?.currentCheckpointIndex ?? 0;
    return Math.min(Math.max(0, savedIdx), Math.max(0, checkpoints.length - 1));
  });
  const [passedStepIds, setPassedStepIds] = useState<string[]>(
    () => savedClassroomProgress?.completedCheckpointIds || []
  );
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [isAutoPlayingLecture, setIsAutoPlayingLecture] = useState(true);

  // Classroom Stage & Camera State
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('pov');
  const [cameraSnap, setCameraSnap] = useState(0);
  const requestCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraSnap((value) => value + 1);
  }, []);
  const [overridePose, setOverridePose] = useState<InstructorStagePose | null>(
    null
  );
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
  const [voiceAmplitude, setVoiceAmplitude] = useState(0);
  const [liveSubtitle, setLiveSubtitle] = useState<string>(
    'Nhấn "Bắt Đầu Tiết Học" để vào lớp học sáng sủa và nghe giảng viên giảng bài bằng Tiếng Việt.'
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

  const currentCheckpoint = checkpoints[activeStepIndex] || checkpoints[0];
  const currentKeyPoints = useMemo(
    () => currentCheckpoint.keyPoints || [currentCheckpoint.summary],
    [currentCheckpoint]
  );

  const lectureBeats = useMemo(
    () =>
      buildLectureBeatsForStep(
        currentCheckpoint,
        activeStepIndex,
        checkpoints.length
      ),
    [currentCheckpoint, activeStepIndex, checkpoints.length]
  );

  const currentBeat =
    lectureBeats[Math.min(activeBeatIndex, lectureBeats.length - 1)] ||
    lectureBeats[0];

  const isCurrentStepPassed = passedStepIds.includes(currentCheckpoint.id);
  const currentQuizAttempt = quizSelectionByStep[currentCheckpoint.id];

  // Reset state when switching lessons
  useEffect(() => {
    stopVietnameseSpeech();
    setActiveStepIndex(0);
    setPassedStepIds(savedClassroomProgress?.completedCheckpointIds || []);
    setActiveBeatIndex(0);
    setQuizSelectionByStep({});
    setQaHistory([]);
    setIsRaisingHand(false);
    setShowLaptopSandbox(false);
  }, [lesson.id, savedClassroomProgress]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopVietnameseSpeech();
    };
  }, []);

  // Trigger Vietnamese voice playback for a given script
  const playProfessorVietnameseVoice = useCallback(
    (scriptText: string, onFinishedBeat?: () => void) => {
      setLiveSubtitle(scriptText);
      if (!voiceEnabled) {
        setIsSpeaking(false);
        setVoiceAmplitude(0);
        return;
      }

      void speakVietnamese({
        text: scriptText,
        rate: speechRate,
        onStart: () => {
          setIsSpeaking(true);
        },
        onSentenceChange: (sentence) => {
          setLiveSubtitle(sentence);
        },
        onAmplitude: (amp) => {
          setVoiceAmplitude(amp);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setVoiceAmplitude(0);
          onFinishedBeat?.();
        },
        onError: () => {
          setIsSpeaking(false);
          setVoiceAmplitude(0);
        }
      });
    },
    [voiceEnabled, speechRate]
  );

  // Automatically run the current Lecture Beat when class is active and not interrupted
  useEffect(() => {
    if (!hasStartedClass || isRaisingHand || showLaptopSandbox) return;

    setOverridePose(null);
    setOverrideBoardMode(null);
    setOverridePointIndex(null);

    const beat = lectureBeats[activeBeatIndex];
    if (!beat) return;

    if (beat.boardMode === 'code') {
      setSelectedCodeLine(beat.codeLineIndex);
    }

    playProfessorVietnameseVoice(beat.spokenScript, () => {
      // Auto-advance to the next beat in the lecture script until we reach the Question beat
      if (isAutoPlayingLecture && activeBeatIndex < lectureBeats.length - 1) {
        setTimeout(() => {
          setActiveBeatIndex((prev) =>
            Math.min(prev + 1, lectureBeats.length - 1)
          );
        }, 650);
      }
    });
  }, [
    hasStartedClass,
    activeStepIndex,
    activeBeatIndex,
    lectureBeats,
    isRaisingHand,
    showLaptopSandbox,
    isAutoPlayingLecture,
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

  // Start the live lecture session
  const handleStartLectureSession = () => {
    setHasStartedClass(true);
    setActiveBeatIndex(0);
    setIsAutoPlayingLecture(true);
    toast.success('Đã vào lớp học! Cô bắt đầu giảng bài...');
  };

  // Switch to another Step in the lesson
  const handleSelectStep = (idx: number) => {
    stopVietnameseSpeech();
    setActiveStepIndex(idx);
    setActiveBeatIndex(0);
    setIsRaisingHand(false);
    setOverridePose(null);
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
    if (!isRaisingHand) {
      stopVietnameseSpeech();
      setIsRaisingHand(true);
      setIsAutoPlayingLecture(false);
      requestCameraPreset('instructor');
      setOverridePose('listening_student');
      const promptMsg =
        'Cô thấy em giơ tay! Em chưa rõ chỗ nào ở phần này cứ bật mic nói bằng Tiếng Việt hoặc gõ câu hỏi cho cô nhé!';
      playProfessorVietnameseVoice(promptMsg);
    } else {
      stopVietnameseSpeech();
      setIsRaisingHand(false);
      requestCameraPreset('pov');
      setOverridePose(null);
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
        'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Em hãy dùng Chrome hoặc Edge nhé!'
      );
      return;
    }

    stopVietnameseSpeech();
    setIsRaisingHand(true);
    setIsAutoPlayingLecture(false);
    setOverridePose('listening_student');

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
      setIsListeningMic(false);
    };

    recognition.onend = () => {
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

      stopVietnameseSpeech();
      setStudentQuestionInput('');
      setIsAiThinking(true);
      setOverridePose('listening_student');
      setLiveSubtitle('Cô đang suy nghĩ câu trả lời cho em...');

      const userMsg: ClassroomQaTurn = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      };
      const assistantMsgId = `ai-${Date.now() + 1}`;
      const placeholderAiMsg: ClassroomQaTurn = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString()
      };

      const nextHistory = [...qaHistory, userMsg];
      setQaHistory([...nextHistory, placeholderAiMsg]);

      const systemStageContext = `
[CHẾ ĐỘ GIẢNG VIÊN TRỰC TIẾP TRÊN BẢNG THÔNG MINH — BẮT BUỘC NÓI TIẾNG VIỆT TỰ NHIÊN]
- Bạn là Cô giáo / Giảng viên AI đang đứng cạnh Bảng Tương Tác Thông Minh dạy trực tiếp 1-1 cho học viên.
- Bài học hiện tại: "${lesson.title}" (${course.title}).
- Phần đang giảng trên bảng (Phần ${activeStepIndex + 1}/${checkpoints.length}): "${currentCheckpoint.title}".
- Các ý chính đang chiếu trên bảng:
${currentKeyPoints.map((kp, i) => `  ${i + 1}. ${kp}`).join('\n')}
- Câu hỏi kiểm tra của phần này: "${currentCheckpoint.interactiveQuiz?.question || currentCheckpoint.socraticQuestion}"

QUY TẮC PHẢN HỒI CỦA GIẢNG VIÊN TRÊN LỚP (TỐI ĐA 90–120 TỪ, ĐỂ ĐỌC BẰNG GIỌNG NÓI TIẾNG VIỆT TỰ NHIÊN):
1. Xưng "cô", gọi học viên là "em". Trả lời ấm áp, rõ ràng, dễ hiểu như đang giảng bài trực tiếp trên lớp (không dùng markdown phức tạp hay bảng biểu dài dòng).
2. Giải thích thẳng vào bản chất câu hỏi của học viên, liên hệ trực tiếp tới ý trên bảng.
3. Nếu học viên đang trả lời câu hỏi kiểm tra và trả lời đúng ý cốt lõi, hãy khen ngợi nhiệt tình và kèm đúng thẻ \`[CHECKPOINT_PASSED]\` ở cuối câu trả lời.
`;

      try {
        const sessionId = `classroom_live_${course.id}_${lesson.id}`;
        await chatDbService.authorizeTutorSession(
          sessionId,
          lesson.id,
          `Lớp học 1-1: ${lesson.title}`
        );

        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            lesson: {
              title: `${lesson.title} — [Lớp Học 1-1: ${currentCheckpoint.title}]`,
              tag: lesson.tag,
              theory: `${systemStageContext}\n\n${currentCheckpoint.boardMarkdown}`,
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

        const contentType = response.headers.get('content-type') || '';
        let finalAccumulated = '';

        if (
          response.ok &&
          contentType.includes('text/event-stream') &&
          response.body
        ) {
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
                  setLiveSubtitle(cleanChunk);
                  setQaHistory((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: cleanChunk } : m
                    )
                  );
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
          finalAccumulated =
            json.reply ||
            `Cô giải thích nhanh ý trọng tâm nhé: ${currentKeyPoints[0]}`;
        }

        setIsAiThinking(false);
        const passed = finalAccumulated.includes('[CHECKPOINT_PASSED]');
        const cleanSpoken = finalAccumulated
          .replace(/\[CHECKPOINT_PASSED\]/g, '')
          .trim();

        setQaHistory((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: cleanSpoken } : m
          )
        );

        if (passed) {
          setOverridePose('celebrating');
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.65 }
          });
          markCurrentStepCompleted(currentCheckpoint.id, activeStepIndex);
          toast.success(
            `Tuyệt vời! Em đã vượt qua Phần ${activeStepIndex + 1}!`
          );
        } else {
          setOverridePose('pointing_board');
        }

        playProfessorVietnameseVoice(cleanSpoken, () => {
          setIsRaisingHand(false);
          setOverridePose(null);
        });
      } catch {
        setIsAiThinking(false);
        const fallbackReply = `Cô giải thích trực tiếp ý này nhé: ${currentKeyPoints[0] || currentCheckpoint.summary}`;
        setQaHistory((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fallbackReply } : m
          )
        );
        setOverridePose('pointing_board');
        playProfessorVietnameseVoice(fallbackReply, () => {
          setIsRaisingHand(false);
          setOverridePose(null);
        });
      }
    },
    [
      studentQuestionInput,
      isAiThinking,
      qaHistory,
      lesson.id,
      lesson.title,
      lesson.tag,
      lesson.realCodeSnippet,
      course.id,
      course.title,
      activeStepIndex,
      checkpoints.length,
      currentCheckpoint,
      currentKeyPoints,
      markCurrentStepCompleted,
      playProfessorVietnameseVoice
    ]
  );

  // Student selects a 1-click Multiple Choice Answer on the Lecture Hall Question Overlay
  const handleSelectQuizOption = (optionIndex: number) => {
    const quiz = currentCheckpoint.interactiveQuiz;
    if (!quiz) return;

    const isCorrect = optionIndex === quiz.correctIndex;
    setQuizSelectionByStep((prev) => ({
      ...prev,
      [currentCheckpoint.id]: { selectedIndex: optionIndex, isCorrect }
    }));

    if (isCorrect) {
      setOverridePose('celebrating');
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.68 }
      });

      markCurrentStepCompleted(currentCheckpoint.id, activeStepIndex);

      const praiseScript = `Chính xác tuyệt đối! ${quiz.explanation} Em nắm bài rất chắc. Cô trò mình chuyển sang phần tiếp theo nhé!`;
      toast.success(
        `Chính xác! Đã mở khóa Phần ${activeStepIndex + 1}/${checkpoints.length}`
      );

      playProfessorVietnameseVoice(praiseScript, () => {
        setOverridePose(null);
        if (activeStepIndex < checkpoints.length - 1) {
          setActiveStepIndex((prev) => prev + 1);
          setActiveBeatIndex(0);
          setIsAutoPlayingLecture(true);
        }
      });
    } else {
      setOverridePose('pointing_board');
      const hintScript = `Đáp án đó chưa chính xác rồi em ơi! Em nghe cô gợi ý lại nhé: ${quiz.explanation} Em thử chọn lại đáp án đúng xem nào!`;
      toast.error('Chưa chính xác! Hãy nghe gợi ý của cô và chọn lại nhé.');
      playProfessorVietnameseVoice(hintScript);
    }
  };

  // Derived Scene props
  const effectivePose: InstructorStagePose =
    overridePose || currentBeat?.pose || 'podium_speaking';
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
      <header className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/90 bg-white/95 px-4 py-2.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              stopVietnameseSpeech();
              onExitToLesson();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-sky-500 hover:bg-white hover:text-sky-700 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Về Bài Học
          </button>

          <button
            type="button"
            onClick={() => {
              stopVietnameseSpeech();
              onExitToHub();
            }}
            className="hidden rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 sm:inline-flex cursor-pointer"
          >
            Danh Sách Khóa Học
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              LỚP HỌC TRỰC TIẾP 1-1
            </span>
            <h1 className="max-w-[220px] truncate text-sm font-extrabold text-stone-900 sm:max-w-[320px]">
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* Interactive Step Pills (Phần 1 -> Phần N) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {checkpoints.map((cp, idx) => {
            const isCurrent = idx === activeStepIndex;
            const isPassed = passedStepIds.includes(cp.id);
            return (
              <button
                key={cp.id}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  isCurrent
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-2xs'
                    : isPassed
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    isPassed
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-sky-600 text-white'
                        : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {isPassed ? <Check size={10} strokeWidth={3} /> : idx + 1}
                </span>
                <span className="max-w-[115px] truncate">
                  {cp.shortTitle || cp.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Camera Angle Switcher + Vietnamese Voice Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1 lg:flex">
            {(
              [
                { id: 'pov', label: 'Bàn Học', icon: Video },
                { id: 'instructor', label: 'Cận Giảng Viên', icon: UserCheck },
                { id: 'board', label: 'Phóng To Bảng', icon: Monitor },
                { id: 'wide', label: 'Toàn Cảnh', icon: Maximize2 }
              ] as const
            ).map((cam) => {
              const Icon = cam.icon;
              const active = cameraPreset === cam.id;
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => requestCameraPreset(cam.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title={`Đổi góc nhìn: ${cam.label}`}
                >
                  <Icon size={12} />
                  {cam.label}
                </button>
              );
            })}
          </div>

          {/* Vietnamese Voice Mute/Unmute */}
          <button
            type="button"
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (!next) {
                stopVietnameseSpeech();
                setIsSpeaking(false);
                setVoiceAmplitude(0);
              } else if (hasStartedClass && currentBeat) {
                playProfessorVietnameseVoice(currentBeat.spokenScript);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              voiceEnabled
                ? 'border-sky-300 bg-sky-50 text-sky-800'
                : 'border-stone-300 bg-stone-100 text-stone-500'
            }`}
            title="Bật/Tắt giọng nói Tiếng Việt của Giảng Viên"
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">
              {voiceEnabled ? 'Giọng Tiếng Việt' : 'Đã Tắt Tiếng'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSpeechRate((prev) =>
                prev >= 1.25 ? 0.95 : Number((prev + 0.1).toFixed(2))
              )
            }
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] font-extrabold text-stone-700 hover:border-stone-300 cursor-pointer"
            title="Tốc độ giảng bài Tiếng Việt"
          >
            {speechRate}x
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. MAIN BRIGHT DAYLIGHT CLASSROOM VIEWPORT
         ===================================================================== */}
      <div className="relative flex-1 overflow-hidden">
        <LectureHall3DScene
          lessonTitle={lesson.title}
          stepTitle={currentCheckpoint.title}
          stepIndex={activeStepIndex}
          totalSteps={checkpoints.length}
          pose={effectivePose}
          cameraPreset={cameraPreset}
          boardMode={effectiveBoardMode}
          keyPoints={currentKeyPoints}
          activePointIndex={effectivePointIndex}
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
          voiceAmplitude={voiceAmplitude}
          isSpeaking={isSpeaking}
          isListening={isListeningMic || isRaisingHand}
          cameraSnap={cameraSnap}
          onRequestCameraPreset={requestCameraPreset}
          onOpenLaptop={() => {
            stopVietnameseSpeech();
            setShowLaptopSandbox(true);
          }}
          onSelectBoardPoint={(ptIdx) => {
            setIsAutoPlayingLecture(false);
            setOverrideBoardMode('keypoints');
            setOverridePose('pointing_board');
            setOverridePointIndex(ptIdx);
            const selectedPt = currentKeyPoints[ptIdx] || '';
            void handleAskProfessor(
              `Cô giải thích sâu hơn và cho ví dụ thực tế về mục số #${ptIdx + 1} trên bảng: "${selectedPt}" giúp em với ạ!`
            );
          }}
          onSelectCodeLine={(lineIdx, lineText) => {
            setIsAutoPlayingLecture(false);
            setSelectedCodeLine(lineIdx);
            setOverrideBoardMode('code');
            setOverridePose('pointing_board');
            void handleAskProfessor(
              `Cô giải thích giúp em dòng code số #${lineIdx + 1} trên bảng: "${lineText.trim()}" hoạt động như thế nào ạ?`
            );
          }}
          onSwitchBoardMode={(mode) => {
            setIsAutoPlayingLecture(false);
            setOverrideBoardMode(mode);
            setOverridePose('pointing_board');
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
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600">
                  <Sparkles size={32} />
                </div>
                <span className="inline-block rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                  PHÒNG HỌC TRỰC TIẾP 1-1 · GIỌNG GIẢNG VIÊN TIẾNG VIỆT 100%
                </span>
                <h2 className="mt-3 text-2xl font-extrabold text-stone-900">
                  {lesson.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  Giảng viên sẽ trực tiếp đứng cạnh{' '}
                  <strong className="text-sky-700">Bảng Tương Tác Thông Minh</strong>,
                  giảng từng ý bằng{' '}
                  <strong className="text-sky-700">Giọng Tiếng Việt</strong> và dùng que
                  chỉ vào từng mục hoặc từng dòng code. Em có thể bấm trực tiếp vào bảng
                  hoặc bấm{' '}
                  <strong className="text-amber-700">
                    &ldquo;✋ Giơ Tay Hỏi Bài&rdquo;
                  </strong>{' '}
                  bất cứ lúc nào!
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2.5 text-left">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-[11px] font-extrabold text-sky-700">
                      1. BẢNG THÔNG MINH
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      Lớp học sáng sủa, dễ nhìn; bấm vào mục nào trên bảng cô giảng ngay
                      mục đó.
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-[11px] font-extrabold text-amber-700">
                      2. GIƠ TAY HỎI BÀI
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      Bật Mic nói Tiếng Việt hoặc gõ câu hỏi ngay khi chưa hiểu.
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-[11px] font-extrabold text-emerald-700">
                      3. CÔ HỎI - TRÒ ĐÁP
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      Cuối mỗi phần cô đặt câu hỏi kiểm tra ngay tại lớp học.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartLectureSession}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-105 cursor-pointer"
                >
                  <Play size={20} fill="currentColor" />
                  BẮT ĐẦU TIẾT HỌC (VÀO LỚP NGAY)
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            FLOATING BEAT TIMELINE PILLS (Top-Left of Classroom)
           ----------------------------------------------------------------- */}
        {hasStartedClass && (
          <div className="absolute left-4 top-3 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl border border-stone-200 bg-white/95 p-1.5 shadow-md backdrop-blur-md">
            {lectureBeats.map((beat, idx) => {
              const isActive = idx === activeBeatIndex;
              return (
                <button
                  key={beat.id}
                  type="button"
                  onClick={() => {
                    stopVietnameseSpeech();
                    setIsRaisingHand(false);
                    setActiveBeatIndex(idx);
                  }}
                  className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  {idx + 1}. {beat.label}
                </button>
              );
            })}
          </div>
        )}

        {/* -----------------------------------------------------------------
            INTERACTIVE IN-CLASS QUESTION POPUP (Light Mode Card)
           ----------------------------------------------------------------- */}
        <AnimatePresence>
          {hasStartedClass &&
            currentBeat?.boardMode === 'question' &&
            !isRaisingHand &&
            currentCheckpoint.interactiveQuiz && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="absolute right-4 top-14 z-30 w-full max-w-md rounded-2xl border-2 border-amber-400 bg-white p-4 shadow-2xl"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                    ⚡ CÔ ĐANG HỎI BÀI TẠI LỚP
                  </span>
                  {isCurrentStepPassed && (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600">
                      <CheckCircle2 size={14} />
                      Đã vượt qua
                    </span>
                  )}
                </div>

                <p className="text-sm font-extrabold leading-snug text-stone-900">
                  {currentCheckpoint.interactiveQuiz.question}
                </p>

                <div className="mt-3 space-y-1.5">
                  {currentCheckpoint.interactiveQuiz.options.map((opt, oIdx) => {
                    const isSelected =
                      currentQuizAttempt?.selectedIndex === oIdx;
                    const isCorrectOpt =
                      oIdx === currentCheckpoint.interactiveQuiz?.correctIndex;

                    let btnStyle =
                      'border-stone-200 bg-stone-50 text-stone-800 hover:border-amber-400 hover:bg-amber-50/40';
                    if (currentQuizAttempt) {
                      if (isSelected && currentQuizAttempt.isCorrect) {
                        btnStyle =
                          'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold';
                      } else if (isSelected && !currentQuizAttempt.isCorrect) {
                        btnStyle =
                          'border-rose-500 bg-rose-50 text-rose-950 font-semibold';
                      } else if (currentQuizAttempt.isCorrect && isCorrectOpt) {
                        btnStyle =
                          'border-emerald-400 bg-emerald-50/60 text-emerald-900';
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectQuizOption(oIdx)}
                        className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition cursor-pointer ${btnStyle}`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-200/80 font-extrabold text-amber-900">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="flex-1 leading-relaxed">{opt}</span>
                        {isSelected && currentQuizAttempt?.isCorrect && (
                          <CheckCircle2
                            size={15}
                            className="shrink-0 text-emerald-600"
                          />
                        )}
                        {isSelected && !currentQuizAttempt?.isCorrect && (
                          <XCircle
                            size={15}
                            className="shrink-0 text-rose-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            3. LIVE SUBTITLE & STUDENT DESK HUD (Warm Light Mode)
           ----------------------------------------------------------------- */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-4 pb-3 pt-4">
          {/* Live Spoken Vietnamese Subtitle Box */}
          <div className="pointer-events-auto mb-2.5 w-full max-w-4xl rounded-2xl border border-stone-200/90 bg-white/95 px-5 py-2.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-4 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((bar) => {
                    const barHeight = isSpeaking
                      ? Math.max(
                          25,
                          Math.min(
                            100,
                            Math.round(
                              (voiceAmplitude * 100 * ((bar % 3) + 1)) / 2
                            )
                          )
                        )
                      : 25;
                    return (
                      <span
                        key={bar}
                        style={{ height: `${barHeight}%` }}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          isSpeaking ? 'bg-sky-600' : 'bg-stone-300'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700">
                  {isAiThinking
                    ? 'Cô đang suy nghĩ câu trả lời...'
                    : isSpeaking
                      ? 'Giảng Viên AI đang giảng (Tiếng Việt):'
                      : isRaisingHand
                        ? 'Cô đang lắng nghe em hỏi bài:'
                        : 'Lời giảng tại lớp:'}
                </span>
              </div>

              {/* Playback controls for current lecture beat */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) {
                      stopVietnameseSpeech();
                      setIsSpeaking(false);
                      setIsAutoPlayingLecture(false);
                    } else {
                      setIsAutoPlayingLecture(true);
                      playProfessorVietnameseVoice(
                        currentBeat?.spokenScript || liveSubtitle
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700 hover:border-sky-400 hover:bg-white cursor-pointer"
                >
                  {isSpeaking ? <Pause size={12} /> : <Play size={12} />}
                  {isSpeaking ? 'Tạm dừng' : 'Nghe tiếp'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    playProfessorVietnameseVoice(
                      currentBeat?.spokenScript || liveSubtitle
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-700 hover:bg-white cursor-pointer"
                  title="Nghe giảng lại câu này"
                >
                  <RotateCcw size={12} />
                  Nghe lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopVietnameseSpeech();
                    if (activeBeatIndex < lectureBeats.length - 1) {
                      setActiveBeatIndex((prev) => prev + 1);
                    } else if (activeStepIndex < checkpoints.length - 1) {
                      handleSelectStep(activeStepIndex + 1);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-extrabold text-sky-700 hover:bg-sky-100 cursor-pointer"
                >
                  Ý tiếp theo
                  <SkipForward size={12} />
                </button>
              </div>
            </div>

            <p className="mt-1 text-sm font-semibold leading-relaxed text-stone-800 sm:text-[15px]">
              &ldquo;{liveSubtitle}&rdquo;
            </p>
          </div>

          {/* Student Desk Interactive Controls Bar */}
          <div className="pointer-events-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-stone-300/90 bg-white/95 p-2.5 shadow-xl backdrop-blur-md">
            {/* Left Desk Actions: Raise Hand + Voice Mic */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleRaiseHand}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer ${
                  isRaisingHand
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Hand size={16} />
                {isRaisingHand ? 'Đang Giơ Tay Hỏi Cô' : '✋ Giơ Tay Hỏi Bài'}
              </button>

              <button
                type="button"
                onClick={toggleMicrophoneSTT}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                  isListeningMic
                    ? 'border-rose-500 bg-rose-500 text-white animate-pulse'
                    : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-sky-500 hover:bg-white'
                }`}
                title="Bật Mic nói trực tiếp bằng Tiếng Việt với Cô"
              >
                {isListeningMic ? <MicOff size={15} /> : <Mic size={15} />}
                {isListeningMic ? 'Đang nghe Tiếng Việt...' : '🎙️ Nói Tiếng Việt'}
              </button>
            </div>

            {/* Center Input: Ask Question or Answer Directly */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAskProfessor();
              }}
              className="flex min-w-[240px] flex-1 items-center gap-2"
            >
              <input
                type="text"
                value={studentQuestionInput}
                onChange={(e) => setStudentQuestionInput(e.target.value)}
                onFocus={() => {
                  if (!isRaisingHand) {
                    stopVietnameseSpeech();
                    setIsAutoPlayingLecture(false);
                  }
                }}
                placeholder="Hỏi trực tiếp cô giáo hoặc trả lời câu hỏi tại lớp..."
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-900 placeholder-stone-400 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!studentQuestionInput.trim() || isAiThinking}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-sky-500 disabled:opacity-40 cursor-pointer"
              >
                <Send size={14} />
                Gửi
              </button>
            </form>

            {/* Right Desk Actions: Open Student Laptop (Code Sandbox) & Notebook */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopVietnameseSpeech();
                  setShowLaptopSandbox((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                  showLaptopSandbox
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Laptop size={15} />
                Laptop Thực Hành
              </button>

              <button
                type="button"
                onClick={() => setShowNotebookDrawer((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-white cursor-pointer"
                title="Xem Sổ Ghi Chép & Lịch Sử Hỏi Đáp"
              >
                <MessageSquare size={14} />
                Sổ Tay ({qaHistory.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  onLessonCompleted(lesson.id);
                  confetti({
                    particleCount: 100,
                    spread: 80,
                    origin: { y: 0.6 }
                  });
                  toast.success('Chúc mừng em đã hoàn thành tiết học 1-1!');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                  isLessonCompleted || progressPercentage >= 100
                    ? 'bg-emerald-600 text-white'
                    : 'border border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-500'
                }`}
              >
                <CheckCircle2 size={14} />
                {isLessonCompleted ? 'Đã Hoàn Thành' : 'Hoàn Thành'}
              </button>
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
                <button
                  type="button"
                  onClick={() => setShowLaptopSandbox(false)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Đóng Laptop (Quay lại nhìn Bảng Trắng)
                </button>
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
                      'Giảng Viên AI: Tuyệt vời! Em đã code vượt qua bài thực hành ngay tại lớp!'
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
                <button
                  type="button"
                  onClick={() => setShowNotebookDrawer(false)}
                  className="text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
                >
                  Đóng
                </button>
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
                    Chưa có câu hỏi riêng nào. Em hãy bấm &ldquo;✋ Giơ Tay Hỏi Bài&rdquo;
                    hoặc bấm vào mục bất kỳ trên bảng trắng để hỏi cô nhé!
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
                          ? 'Em hỏi tại lớp:'
                          : 'Giảng Viên AI trả lời:'}
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
