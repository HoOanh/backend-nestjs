import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Database,
  FolderGit2,
  GitBranch,
  Layers,
  Play,
  Plus,
  Radio,
  Server,
  Zap
} from 'lucide-react';
import {
  COURSES,
  CAREER_PATHS,
  getCourseById,
  getCareerPathById,
  getCourseTotalLessons,
  getCourseCompletedCount
} from '../../data/courses.ts';
import type { CourseDefinition } from '../../data/curriculum/types.ts';
import type { CourseEnrollmentInfo } from '../../types/user.ts';

interface LearningHubViewProps {
  initialTab?: 'overview' | 'roadmaps' | 'catalog';
  activeCourseId: string;
  activeCareerPathId: string;
  enrolledCourses: Record<string, CourseEnrollmentInfo>;
  completedLessons: Record<string, { completedAt: string }>;
  streakDays: number;
  onEnrollAndOpenCourse: (courseId: string, lessonId?: string) => void;
  onEnrollCourseOnly: (courseId: string, courseTitle: string) => void;
  onOpenAiClassroom: (courseId: string, lessonId?: string) => void;
  onSelectCareerPath: (pathId: string, courseIds: string[]) => void;
  onSwitchHubTab?: (tab: 'overview' | 'roadmaps' | 'catalog') => void;
}

export const LearningHubView: React.FC<LearningHubViewProps> = ({
  initialTab = 'overview',
  activeCourseId,
  activeCareerPathId,
  enrolledCourses,
  completedLessons,
  streakDays,
  onEnrollAndOpenCourse,
  onEnrollCourseOnly,
  onOpenAiClassroom,
  onSelectCareerPath,
  onSwitchHubTab
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmaps' | 'catalog'>(initialTab);
  const [selectedPathId, setSelectedPathId] = useState<string>(
    activeCareerPathId || CAREER_PATHS[0].id
  );
  const [courseFilter, setCourseFilter] = useState<'all' | 'enrolled' | 'unregistered'>('all');
  const [expandedCourseSyllabus, setExpandedCourseSyllabus] = useState<string | null>(null);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabClick = (tab: 'overview' | 'roadmaps' | 'catalog') => {
    setActiveTab(tab);
    onSwitchHubTab?.(tab);
  };

  const activeCourse = useMemo(() => getCourseById(activeCourseId), [activeCourseId]);
  const selectedCareerPath = useMemo(
    () => getCareerPathById(selectedPathId),
    [selectedPathId]
  );

  const isCourseEnrolled = (courseId: string): boolean => {
    return courseId === 'backend-nestjs' || Boolean(enrolledCourses[courseId]);
  };

  const enrolledList = useMemo(() => {
    return COURSES.filter((c) => isCourseEnrolled(c.id));
  }, [enrolledCourses]);

  const filteredCourses = useMemo(() => {
    if (courseFilter === 'enrolled') {
      return COURSES.filter((c) => isCourseEnrolled(c.id));
    }
    if (courseFilter === 'unregistered') {
      return COURSES.filter((c) => !isCourseEnrolled(c.id));
    }
    return COURSES;
  }, [courseFilter, enrolledCourses]);

  const totalCompletedLessonsAcrossAll = Object.keys(completedLessons).length;
  const activeCourseTotal = getCourseTotalLessons(activeCourse);
  const activeCourseDone = getCourseCompletedCount(activeCourse, completedLessons);
  const activeCoursePct =
    activeCourseTotal > 0 ? Math.round((activeCourseDone / activeCourseTotal) * 100) : 0;

  const activeCourseCurrentLesson = useMemo(() => {
    const savedId = enrolledCourses[activeCourse.id]?.currentLessonId;
    for (const sp of activeCourse.curriculum) {
      for (const l of sp.lessons) {
        if (l.id === savedId) return l;
      }
    }
    for (const sp of activeCourse.curriculum) {
      for (const l of sp.lessons) {
        if (!completedLessons[l.id]) return l;
      }
    }
    return activeCourse.curriculum[0]?.lessons[0] || null;
  }, [activeCourse, enrolledCourses, completedLessons]);

  const renderCategoryIcon = (category: string) => {
    if (category.includes('Backend')) return <Server size={14} />;
    if (category.includes('Database')) return <Database size={14} />;
    if (category.includes('Frontend')) return <Boxes size={14} />;
    if (category.includes('DevOps')) return <Activity size={14} />;
    return <GitBranch size={14} />;
  };

  const renderCourseCard = (course: CourseDefinition) => {
    const total = getCourseTotalLessons(course);
    const done = getCourseCompletedCount(course, completedLessons);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isEnrolled = isCourseEnrolled(course.id);
    const resumeLessonId =
      enrolledCourses[course.id]?.currentLessonId ||
      course.curriculum[0]?.lessons[0]?.id ||
      'c1-l1';
    const isSyllabusOpen = expandedCourseSyllabus === course.id;

    return (
      <article
        key={course.id}
        className={clsx(
          'flex flex-col justify-between rounded-xl bg-surface border p-5 transition-all',
          course.id === activeCourse.id
            ? 'border-accent/60 shadow-sm'
            : 'border-subtle hover:border-strong'
        )}
      >
        <div>
          {/* Top Status & Category Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-elevated border border-subtle text-[11px] font-semibold text-secondary">
              {renderCategoryIcon(course.category)}
              <span>{course.category}</span>
            </span>

            {isEnrolled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-emerald-500 text-[11px] font-bold">
                <CheckCircle2 size={12} />
                <span>Đang theo học</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/12 border border-accent/25 text-accent text-[11px] font-bold">
                Khóa học mới
              </span>
            )}
          </div>

          {/* Course Title & Subtitle */}
          <h3 className="text-[16px] font-bold text-primary leading-snug mb-1.5">
            {course.title}
          </h3>
          <p className="text-[13px] text-secondary leading-relaxed line-clamp-2 mb-3.5">
            {course.subtitle}
          </p>

          {/* Compact Metadata Bar */}
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted font-medium pb-3.5 mb-3.5 border-b border-subtle">
            <span className="inline-flex items-center gap-1">
              <Layers size={13} className="text-accent" />
              <span>{course.curriculum.length} chương</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <BookOpen size={13} />
              <span>{total} bài học</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={13} />
              <span>{course.estimatedHours} giờ</span>
            </span>
            <span>•</span>
            <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-secondary text-[11px] font-semibold">
              {course.level}
            </span>
          </div>

          {/* Tech Stack Tags (max 4 to avoid visual clutter) */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {course.techStack.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded bg-surface-subtle border border-subtle text-[11px] font-mono text-secondary"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Expandable Syllabus Preview */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() =>
                setExpandedCourseSyllabus((prev) => (prev === course.id ? null : course.id))
              }
              className="text-[12px] font-semibold text-accent hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
            >
              <Code2 size={13} />
              <span>
                {isSyllabusOpen
                  ? 'Ẩn danh sách chương & bài học'
                  : `Xem đề cương (${course.curriculum.length} chương · ${total} bài)`}
              </span>
            </button>

            {isSyllabusOpen && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-surface-subtle border border-subtle max-h-48 overflow-y-auto space-y-2">
                {course.curriculum.map((sp) => (
                  <div key={sp.sprintId}>
                    <div className="text-[11px] font-bold text-secondary mb-1">
                      {sp.sprintTitle}
                    </div>
                    <div className="space-y-1 pl-2 border-l border-subtle">
                      {sp.lessons.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => onEnrollAndOpenCourse(course.id, l.id)}
                          className="w-full text-left text-[11.5px] text-muted hover:text-accent truncate block bg-transparent border-0 p-0.5 cursor-pointer"
                        >
                          {completedLessons[l.id] ? '✓ ' : '• '}
                          {l.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Progress & Actions */}
        <div className="pt-3 border-t border-subtle space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11.5px] mb-1">
              <span className="text-muted font-medium">
                {isEnrolled ? 'Tiến độ hoàn thành' : 'Sẵn sàng ghi danh miễn phí'}
              </span>
              <span className="font-bold text-primary">
                {done}/{total} bài ({pct}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isEnrolled ? (
              <>
                <button
                  type="button"
                  onClick={() => onEnrollAndOpenCourse(course.id, resumeLessonId)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-[12.5px] font-semibold transition-colors cursor-pointer border-0"
                >
                  <span>Vào Học Ngay</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAiClassroom(course.id, resumeLessonId)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-surface-elevated hover:bg-accent/12 text-primary hover:text-accent border border-subtle hover:border-accent/40 text-[12.5px] font-semibold transition-colors cursor-pointer"
                >
                  <Radio size={13} className="text-accent" />
                  <span>Học 1-1 Với AI</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEnrollAndOpenCourse(course.id, resumeLessonId)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-[12.5px] font-semibold transition-colors cursor-pointer border-0"
                >
                  <Plus size={14} />
                  <span>Đăng Ký &amp; Học</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEnrollCourseOnly(course.id, course.title)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-surface-elevated hover:bg-surface text-secondary hover:text-primary border border-subtle hover:border-strong text-[12.5px] font-semibold transition-colors cursor-pointer"
                >
                  <span>Thêm Vào Lộ Trình</span>
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* =================================================================
          1. COMPACT ACTIVE COURSE CONTINUE-LEARNING BAR
          ================================================================= */}
      <section className="rounded-xl bg-surface border border-subtle p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-accent/12 border border-accent/25 text-accent text-[11px] font-bold uppercase tracking-wider">
              <Play size={11} />
              <span>Đang học gần nhất</span>
            </span>
            <span className="text-[12px] font-semibold text-muted">
              {activeCourse.shortTitle} • {activeCourseDone}/{activeCourseTotal} bài ({activeCoursePct}%)
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-primary truncate">
            {activeCourseCurrentLesson
              ? activeCourseCurrentLesson.title
              : activeCourse.title}
          </h1>

          <p className="text-[13px] text-secondary truncate">
            Khóa học: <strong className="text-primary">{activeCourse.title}</strong>
          </p>
        </div>

        {/* Right KPI Mini Counters + Direct Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-3 pr-3 border-r border-subtle">
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-subtle text-center">
              <div className="text-[15px] font-bold text-primary">
                {enrolledList.length}/{COURSES.length}
              </div>
              <div className="text-[10.5px] text-muted font-medium">Khóa ghi danh</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-subtle text-center">
              <div className="text-[15px] font-bold text-primary">
                {totalCompletedLessonsAcrossAll}
              </div>
              <div className="text-[10.5px] text-muted font-medium">Bài hoàn tất</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-subtle text-center">
              <div className="text-[15px] font-bold text-amber-500 flex items-center justify-center gap-1">
                <Zap size={13} />
                <span>{streakDays}</span>
              </div>
              <div className="text-[10.5px] text-muted font-medium">Ngày liên tiếp</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onEnrollAndOpenCourse(
                activeCourse.id,
                activeCourseCurrentLesson?.id || 'c1-l1'
              )
            }
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors cursor-pointer border-0"
          >
            <span>Tiếp Tục Bài Học</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenAiClassroom(
                activeCourse.id,
                activeCourseCurrentLesson?.id || 'c1-l1'
              )
            }
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-surface-elevated hover:bg-accent/12 text-primary hover:text-accent border border-subtle hover:border-accent/40 text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Radio size={14} className="text-accent" />
            <span>Vào Lớp Học 1-1 Với AI</span>
          </button>
        </div>
      </section>

      {/* =================================================================
          2. NAVIGATION TABS
          ================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => handleTabClick('overview')}
            className={clsx(
              'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
              activeTab === 'overview'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-secondary border-subtle hover:text-primary hover:border-strong'
            )}
          >
            <BookOpen size={14} />
            <span>Tổng Quan &amp; Khóa Học</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'roadmaps'}
            onClick={() => handleTabClick('roadmaps')}
            className={clsx(
              'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
              activeTab === 'roadmaps'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-secondary border-subtle hover:text-primary hover:border-strong'
            )}
          >
            <Compass size={14} />
            <span>Lộ Trình Kỹ Sư ({CAREER_PATHS.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            onClick={() => handleTabClick('catalog')}
            className={clsx(
              'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
              activeTab === 'catalog'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-secondary border-subtle hover:text-primary hover:border-strong'
            )}
          >
            <FolderGit2 size={14} />
            <span>Kho Khóa Học ({COURSES.length})</span>
          </button>
        </div>

        {activeTab !== 'roadmaps' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCourseFilter('all')}
              className={clsx(
                'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer border',
                courseFilter === 'all'
                  ? 'bg-surface-elevated text-primary border-strong'
                  : 'bg-transparent text-muted border-transparent hover:text-secondary'
              )}
            >
              Tất cả ({COURSES.length})
            </button>
            <button
              type="button"
              onClick={() => setCourseFilter('enrolled')}
              className={clsx(
                'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer border',
                courseFilter === 'enrolled'
                  ? 'bg-surface-elevated text-primary border-strong'
                  : 'bg-transparent text-muted border-transparent hover:text-secondary'
              )}
            >
              Đang học ({enrolledList.length})
            </button>
            <button
              type="button"
              onClick={() => setCourseFilter('unregistered')}
              className={clsx(
                'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer border',
                courseFilter === 'unregistered'
                  ? 'bg-surface-elevated text-primary border-strong'
                  : 'bg-transparent text-muted border-transparent hover:text-secondary'
              )}
            >
              Chưa đăng ký ({COURSES.length - enrolledList.length})
            </button>
          </div>
        )}
      </div>

      {/* =================================================================
          TAB 1: OVERVIEW (All Courses Grid + Career Path Quick Strip)
          ================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Balanced 3-Column Course Grid */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-bold text-primary">
                  Danh Sách Khóa Học Kỹ Sư Phần Mềm
                </h2>
                <p className="text-[13px] text-secondary">
                  Chọn khóa học để vào đọc giáo trình 3 tab hoặc học trực tiếp 1-1 cùng AI Giảng viên.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCourses.map((course) => renderCourseCard(course))}
            </div>
          </section>

          {/* Compact Career Roadmaps Summary Strip */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-bold text-primary">
                  Lộ Trình Phát Triển Kỹ Sư (Career Paths)
                </h2>
                <p className="text-[13px] text-secondary">
                  Học có định hướng theo từng cột mốc nghề nghiệp từ Foundation đến System Architect.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('roadmaps')}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline bg-transparent border-0 cursor-pointer"
              >
                <span>Xem chi tiết lộ trình</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {CAREER_PATHS.map((path) => {
                const isActivePath = path.id === activeCareerPathId;
                return (
                  <div
                    key={path.id}
                    className={clsx(
                      'rounded-xl bg-surface border p-4 flex flex-col justify-between gap-4 transition-all',
                      isActivePath ? 'border-accent' : 'border-subtle hover:border-strong'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-accent/12 text-accent text-[10.5px] font-bold uppercase">
                          {path.badgeText}
                        </span>
                        <span className="text-[11.5px] text-muted font-medium">
                          {path.estimatedMonths} • {path.milestones.length} chặng
                        </span>
                      </div>
                      <h3 className="text-[15px] font-bold text-primary mb-1">
                        {path.title}
                      </h3>
                      <p className="text-[12.5px] text-secondary line-clamp-2 mb-3">
                        {path.subtitle}
                      </p>

                      {/* Mini Step Sequence */}
                      <div className="space-y-1.5">
                        {path.milestones.map((m) => {
                          const c = getCourseById(m.courseId);
                          return (
                            <div
                              key={m.step}
                              className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded bg-surface-subtle border border-subtle"
                            >
                              <span className="font-medium text-primary truncate">
                                {m.step}. {c.shortTitle}
                              </span>
                              <span className="text-[11px] text-muted shrink-0 ml-2">
                                {getCourseCompletedCount(c, completedLessons)}/
                                {getCourseTotalLessons(c)} bài
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPathId(path.id);
                        onSelectCareerPath(path.id, path.courseIds);
                        handleTabClick('roadmaps');
                      }}
                      className="w-full h-9 rounded-lg bg-surface-elevated hover:bg-accent hover:text-white text-primary border border-subtle hover:border-accent text-[12.5px] font-semibold transition-colors cursor-pointer"
                    >
                      {isActivePath ? 'Xem Lộ Trình Đang Theo Đuổi →' : 'Chọn Theo Đuổi Lộ Trình Này'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* =================================================================
          TAB 2: CAREER PATH ROADMAPS (Step-by-Step Engineering Progression)
          ================================================================= */}
      {activeTab === 'roadmaps' && (
        <div className="space-y-6">
          {/* Path Selector Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {CAREER_PATHS.map((path) => {
              const isSelected = path.id === selectedCareerPath.id;
              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => setSelectedPathId(path.id)}
                  className={clsx(
                    'text-left rounded-xl p-4 border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-accent/10 border-accent'
                      : 'bg-surface border-subtle hover:border-strong'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10.5px] font-bold uppercase px-2 py-0.5 rounded bg-accent/15 text-accent">
                      {path.badgeText}
                    </span>
                    <span className="text-[11.5px] font-medium text-muted">
                      {path.estimatedMonths}
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-primary mb-1">
                    {path.title}
                  </div>
                  <div className="text-[12px] text-secondary line-clamp-2">
                    Đích đến: <strong className="text-primary">{path.roleTarget}</strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Roadmap Milestone Pipeline */}
          <div className="rounded-xl bg-surface border border-subtle p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-subtle">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-accent mb-1">
                  LỘ TRÌNH NGHỀ NGHIỆP CHI TIẾT • {selectedCareerPath.levelRange}
                </div>
                <h2 className="text-xl font-bold text-primary">
                  {selectedCareerPath.title}
                </h2>
                <p className="text-[13.5px] text-secondary mt-1 max-w-3xl">
                  {selectedCareerPath.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onSelectCareerPath(selectedCareerPath.id, selectedCareerPath.courseIds)
                }
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors cursor-pointer border-0 shrink-0"
              >
                <CheckCircle2 size={15} />
                <span>Đăng Ký Trọn Bộ {selectedCareerPath.courseIds.length} Khóa Trong Lộ Trình</span>
              </button>
            </div>

            <div className="space-y-4">
              {selectedCareerPath.milestones.map((milestone) => {
                const course = getCourseById(milestone.courseId);
                const total = getCourseTotalLessons(course);
                const done = getCourseCompletedCount(course, completedLessons);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const firstLessonId = course.curriculum[0]?.lessons[0]?.id || 'c1-l1';

                return (
                  <div
                    key={milestone.step}
                    className="rounded-xl bg-surface-subtle border border-subtle p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/35 text-accent font-bold text-sm flex items-center justify-center shrink-0">
                        0{milestone.step}
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase text-accent">
                            {milestone.roleMilestone}
                          </span>
                          <span className="text-muted">•</span>
                          <span className="text-[12px] text-muted font-medium">
                            {course.estimatedHours} giờ · {total} bài học
                          </span>
                        </div>

                        <h3 className="text-[16px] font-bold text-primary">
                          {milestone.title} — {course.shortTitle}
                        </h3>

                        <p className="text-[13px] text-secondary">
                          {milestone.outcome}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {milestone.skills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded bg-surface border border-subtle text-[11px] font-mono text-secondary"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0 lg:w-64 pt-3 lg:pt-0 border-t lg:border-t-0 border-subtle">
                      <div className="w-full">
                        <div className="flex items-center justify-between text-[11.5px] mb-1">
                          <span className="text-muted">Tiến độ chặng {milestone.step}</span>
                          <strong className="text-primary">
                            {done}/{total} bài ({pct}%)
                          </strong>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => onEnrollAndOpenCourse(course.id, firstLessonId)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-white text-[12px] font-semibold transition-colors cursor-pointer border-0"
                        >
                          <span>Học Giáo Trình</span>
                          <ArrowRight size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAiClassroom(course.id, firstLessonId)}
                          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-md bg-surface hover:bg-surface-elevated text-primary border border-subtle text-[12px] font-semibold transition-colors cursor-pointer"
                          title="Học chặng này 1-1 với AI Giảng viên"
                        >
                          <Radio size={12} className="text-accent" />
                          <span>1-1 AI</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          TAB 3: FULL COURSE CATALOG
          ================================================================= */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCourses.map((course) => renderCourseCard(course))}
        </div>
      )}
    </div>
  );
};
