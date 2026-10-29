import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  BookOpen,
  Calendar,
  Users,
  FileText,
  Clock,
  MapPin,
  Plus,
  ArrowRight,
  TrendingUp,
  Wallet,
  Megaphone,
  FileCheck2,
  CheckCircle2,
  Award,
  Eye,
} from 'lucide-react';

interface LecturerDashboardProps {
  onSelectTab: (tab: string) => void;
  onOpenCreateCourse: () => void;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  onSelectTab,
  onOpenCreateCourse,
}) => {
  const { user } = useAuth();
  const { courses, enrollments, assignments, announcements, activeBudgetPlan, submissions } =
    useData();

  const myCourses = courses.filter(
    (c) =>
      c.ownerId === user?.uid ||
      c.ownerName === user?.name ||
      !c.ownerId ||
      c.ownerId === 'demo_lecturer_ama_mensah'
  );
  const myCourseCodes = new Set(
    myCourses.map((c) => (c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase())
  );

  const myAssignments = assignments.filter((a) => {
    const aNorm = (a.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return a.ownerId === user?.uid || myCourseCodes.has(aNorm);
  });

  const enrolledCount = enrollments.filter((e) =>
    myCourses.some((c) => c.id === e.courseId)
  ).length;

  // Lecturer relevant submissions
  const mySubmissions = submissions.filter((s) => {
    const sNorm = (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return user?.role === 'admin' || myCourseCodes.has(sNorm) || s.studentId === user?.uid;
  });

  const pendingSubmissions = mySubmissions.filter((s) => s.status !== 'Graded');

  // Format today day
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayClasses = myCourses.filter((c) => (c.days || []).includes(todayName));

  // Budget calculations
  const totalBudget = activeBudgetPlan.totalBudget || 5000;
  const totalOutflow = (activeBudgetPlan.items || []).reduce(
    (acc, curr) => acc + (Number(curr.amount) || 0),
    0
  );
  const remainingBudget = totalBudget - totalOutflow;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c2468] via-[#102d7e] to-[#0a1a4a] p-6 md:p-8 text-white shadow-xl shadow-blue-900/15">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1">
              Lecturer Portal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {user?.name}! 👋
            </h1>
            <p className="mt-1 text-xs md:text-sm text-blue-200/80">
              Manage your academic courses, evaluate submitted coursework, track attendance, and record grades.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenCreateCourse}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Course Level
            </button>
            <button
              onClick={() => onSelectTab('lecturer-subs')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15 transition cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-amber-300" />
              <span>Review Submissions</span>
              {pendingSubmissions.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-mono font-extrabold">
                  {pendingSubmissions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => onSelectTab('lecturer-classlist')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15 transition cursor-pointer"
            >
              <Users className="w-4 h-4 text-blue-300" />
              Class Lists
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div
          onClick={() => onSelectTab('lecturer-courses')}
          className="p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
        >
          <div className="h-1 bg-gradient-to-r from-blue-600 to-cyan-400 absolute top-0 inset-x-0" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Course Levels</span>
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white font-mono">
            {myCourses.length}
          </div>
          <small className="text-[11px] text-slate-400 font-medium">Distinct class sections</small>
        </div>

        <div
          onClick={() => onSelectTab('lecturer-classlist')}
          className="p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition"
        >
          <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-300 absolute top-0 inset-x-0" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white font-mono">
            {enrolledCount}
          </div>
          <small className="text-[11px] text-slate-400 font-medium">Across your courses</small>
        </div>

        <div
          onClick={() => onSelectTab('lecturer-subs')}
          className="p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition"
        >
          <div className="h-1 bg-gradient-to-r from-purple-600 to-pink-500 absolute top-0 inset-x-0" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Student Submissions</span>
            <FileCheck2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white font-mono">
              {mySubmissions.length}
            </div>
            {pendingSubmissions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                {pendingSubmissions.length} to grade
              </span>
            )}
          </div>
          <small className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Click to review & grade →</small>
        </div>

        <div
          onClick={() => onSelectTab('lecturer-timetable')}
          className="p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition"
        >
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-teal-400 absolute top-0 inset-x-0" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Today's Sessions</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white font-mono">
            {todayClasses.length}
          </div>
          <small className="text-[11px] text-slate-400 font-medium">{todayName} schedule</small>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Student Submissions for Evaluation */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Submitted Student Works
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Coursework files uploaded by students awaiting evaluation or feedback.
                </p>
              </div>
              <button
                onClick={() => onSelectTab('lecturer-subs')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspect All ({mySubmissions.length}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {mySubmissions.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                No coursework submissions from students yet. Published assignments will receive submissions here.
              </div>
            ) : (
              <div className="space-y-3">
                {mySubmissions.slice(0, 4).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                        {sub.courseCode.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {sub.studentName}
                          </strong>
                          <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {sub.courseCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {sub.itemTitle} · <span className="font-mono text-[11px]">📎 {sub.fileName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          sub.status === 'Graded'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {sub.status === 'Graded' ? `✓ ${sub.mark}/100` : '⏳ Needs Grading'}
                      </span>
                      <button
                        onClick={() => onSelectTab('lecturer-subs')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {sub.status === 'Graded' ? 'Review' : 'Grade'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Lectures */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Today's Classes · {todayName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lectures scheduled for today according to course level timings.
                </p>
              </div>
              <button
                onClick={() => onSelectTab('lecturer-timetable')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Full Timetable <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayClasses.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                No lectures scheduled for {todayName}. Enjoy your research and grading day! 🎉
              </div>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((course) => (
                  <div
                    key={course.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                        {course.code.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-800 dark:text-white truncate">
                            {course.name}
                          </strong>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {course.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {course.startTime || '08:00'} – {course.endTime || '10:00'}
                          </span>
                          {course.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {course.location}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                            {course.code}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectTab('lecturer-classlist')}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition whitespace-nowrap cursor-pointer"
                    >
                      Take Attendance
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              Quick Management Shortcuts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Direct access to common tasks across your classes.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => onSelectTab('lecturer-subs')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-purple-400 dark:hover:border-purple-500 transition hover:-translate-y-0.5 cursor-pointer"
              >
                <FileCheck2 className="w-5 h-5 text-purple-600 mb-2" />
                <strong className="block text-xs font-bold text-slate-800 dark:text-white">
                  Submissions
                </strong>
                <small className="text-[10px] text-slate-400">Grade & Review</small>
              </button>

              <button
                onClick={() => onSelectTab('lecturer-courses')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-blue-400 dark:hover:border-blue-500 transition hover:-translate-y-0.5 cursor-pointer"
              >
                <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
                <strong className="block text-xs font-bold text-slate-800 dark:text-white">
                  Courses & Codes
                </strong>
                <small className="text-[10px] text-slate-400">Class keys</small>
              </button>

              <button
                onClick={() => onSelectTab('lecturer-classlist')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-amber-400 dark:hover:border-amber-500 transition hover:-translate-y-0.5 cursor-pointer"
              >
                <Users className="w-5 h-5 text-amber-500 mb-2" />
                <strong className="block text-xs font-bold text-slate-800 dark:text-white">
                  Class Registers
                </strong>
                <small className="text-[10px] text-slate-400">Attendance & Marks</small>
              </button>

              <button
                onClick={() => onSelectTab('lecturer-meet')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition hover:-translate-y-0.5 cursor-pointer"
              >
                <Clock className="w-5 h-5 text-emerald-500 mb-2" />
                <strong className="block text-xs font-bold text-slate-800 dark:text-white">
                  Live Classroom
                </strong>
                <small className="text-[10px] text-slate-400">Live Video session</small>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Budget Snapshot */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Campus Budget
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeBudgetPlan.name}
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <small className="text-[11px] text-slate-400 block">Total Budget</small>
                <strong className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                  {activeBudgetPlan.currency || 'GH₵'} {totalBudget.toLocaleString()}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <small className="text-[11px] text-slate-400 block">Remaining</small>
                <strong
                  className={`text-sm font-bold font-mono ${
                    remainingBudget >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {activeBudgetPlan.currency || 'GH₵'} {remainingBudget.toLocaleString()}
                </strong>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('budget-tracker')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              Open Campus Budget Tracker <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Published Announcements Preview */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Class Notices
              </h3>
              <button
                onClick={() => onSelectTab('lecturer-announcements')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Post Notice
              </button>
            </div>

            <div className="space-y-2.5">
              {announcements.slice(0, 3).map((anc) => (
                <div
                  key={anc.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {anc.courseCode}
                    </span>
                    <span className="text-[10px] text-slate-400">{anc.appliesDate}</span>
                  </div>
                  <strong className="block text-slate-800 dark:text-slate-200 mb-0.5">
                    {anc.title}
                  </strong>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2">
                    {anc.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
