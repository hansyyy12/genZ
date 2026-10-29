import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Assignment, Submission } from '../types';
import {
  FileCheck2,
  Upload,
  Plus,
  Clock,
  Calendar,
  Eye,
  CheckCircle2,
  FileText,
  AlertCircle,
  X,
  Send,
  Download,
  Search,
  Filter,
  Check,
  Award,
  Layers,
  ExternalLink,
} from 'lucide-react';

import { QuizzesView } from './QuizzesView';

interface AssignmentsViewProps {
  initialTab?: 'assignments' | 'submissions' | 'quizzes';
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({ initialTab }) => {
  const { user } = useAuth();
  const {
    courses,
    assignments,
    submissions,
    postAssignment,
    submitAssignment,
    gradeSubmission,
    isEnrolledInCourse,
  } = useData();

  const isAdmin = user?.role === 'admin';
  const isLecturer = user?.role === 'lecturer' || isAdmin;

  const [workTab, setWorkTab] = useState<'assignments' | 'submissions' | 'quizzes'>(
    initialTab || 'assignments'
  );

  useEffect(() => {
    if (initialTab) {
      setWorkTab(initialTab);
    }
  }, [initialTab]);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  // Form states for creating assignment
  const [asgCourseCode, setAsgCourseCode] = useState('');
  const [asgTitle, setAsgTitle] = useState('');
  const [asgType, setAsgType] = useState<'Assignment' | 'Quiz' | 'Project'>('Assignment');
  const [asgDue, setAsgDue] = useState('2026-10-30');
  const [asgDesc, setAsgDesc] = useState('');

  // Form state for student submission
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [selectedFileDataUrl, setSelectedFileDataUrl] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Form state for grading & inspection
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [gradeMark, setGradeMark] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');
  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('');
  const [submitModalError, setSubmitModalError] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Relevant courses and assignments
  const myCourses = isAdmin
    ? courses
    : isLecturer
    ? courses.filter(
        (c) =>
          c.ownerId === user?.uid ||
          c.ownerName === user?.name ||
          !c.ownerId ||
          c.ownerId === 'demo_lecturer_ama_mensah'
      )
    : courses.filter((c) => isEnrolledInCourse(c));

  const myNormCodes = new Set(
    myCourses.map((c) => (c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase())
  );

  const filteredAssignments = assignments.filter((a) => {
    const aNorm = (a.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (selectedCourseFilter !== 'all') {
      const filterNorm = selectedCourseFilter.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (aNorm !== filterNorm) return false;
    }
    return isAdmin || myNormCodes.has(aNorm);
  });

  // Lecturer relevant submissions
  const relevantSubmissions = submissions.filter((s) => {
    const sNorm = (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (!isAdmin && !myNormCodes.has(sNorm)) return false;

    if (selectedCourseFilter !== 'all') {
      const filterNorm = selectedCourseFilter.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (sNorm !== filterNorm) return false;
    }

    if (submissionStatusFilter === 'pending' && s.status === 'Graded') return false;
    if (submissionStatusFilter === 'graded' && s.status !== 'Graded') return false;

    if (submissionSearchQuery.trim()) {
      const q = submissionSearchQuery.toLowerCase();
      const matchName = s.studentName.toLowerCase().includes(q);
      const matchTitle = s.itemTitle.toLowerCase().includes(q);
      const matchFile = (s.fileName || '').toLowerCase().includes(q);
      const matchCourse = s.courseCode.toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchFile && !matchCourse) return false;
    }

    return true;
  });

  const pendingCount = submissions.filter((s) => {
    const sNorm = (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return (isAdmin || myNormCodes.has(sNorm)) && s.status !== 'Graded';
  }).length;

  const gradedCount = submissions.filter((s) => {
    const sNorm = (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return (isAdmin || myNormCodes.has(sNorm)) && s.status === 'Graded';
  }).length;

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await postAssignment({
      ownerId: user.uid,
      courseCode: asgCourseCode || myCourses[0]?.code || 'GIS100-X7K',
      type: asgType,
      title: asgTitle.trim(),
      due: asgDue,
      desc: asgDesc.trim(),
    });
    setCreateModalOpen(false);
    setAsgTitle('');
    setAsgDesc('');
    setActionSuccessNotice('Assignment created and broadcasted to enrolled students!');
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setSelectedFileType(file.name.split('.').pop() || 'doc');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedFileDataUrl((ev.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitModalError(null);
    if (!activeAssignment) return;
    if (!selectedFileName && !submissionNotes.trim()) {
      setSubmitModalError('Please attach a document or type your solution notes below.');
      return;
    }
    const finalFileName =
      selectedFileName ||
      `${activeAssignment.title.replace(/[^a-zA-Z0-9_]/g, '_')}_Solution.txt`;
    const finalFileType = selectedFileType || 'txt';
    const finalDataUrl =
      selectedFileDataUrl ||
      (submissionNotes
        ? `data:text/plain;charset=utf-8,${encodeURIComponent(submissionNotes)}`
        : '');

    await submitAssignment(
      activeAssignment.id,
      finalFileName,
      finalFileType,
      finalDataUrl,
      submissionNotes
    );
    setSubmitModalOpen(false);
    setSelectedFileName('');
    setSelectedFileDataUrl('');
    setSubmissionNotes('');
    setActionSuccessNotice('Your coursework was successfully uploaded and submitted!');
    setTimeout(() => setActionSuccessNotice(null), 3500);
  };

  const handleOpenGrading = (sub: Submission) => {
    setActiveSubmission(sub);
    setGradeMark(sub.mark ? String(sub.mark) : '');
    setGradeFeedback(sub.feedback || '');
    setGradingModalOpen(true);
  };

  const handleOpenInspect = (sub: Submission) => {
    setActiveSubmission(sub);
    setGradeMark(sub.mark ? String(sub.mark) : '');
    setGradeFeedback(sub.feedback || '');
    setInspectModalOpen(true);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;
    await gradeSubmission(activeSubmission.id, gradeMark, gradeFeedback);
    setGradingModalOpen(false);
    setInspectModalOpen(false);
    setActionSuccessNotice(
      `Grade & feedback recorded for ${activeSubmission.studentName} (${gradeMark}/100)!`
    );
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const downloadSubmissionFile = (sub: Submission) => {
    if (!sub.fileDataUrl) {
      if (sub.notes) {
        const blob = new Blob([sub.notes], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sub.fileName || 'submission.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }

    const a = document.createElement('a');
    a.href = sub.fileDataUrl;
    a.download = sub.fileName || 'submission_file';
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setWorkTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            workTab === 'assignments'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          {isLecturer ? 'Coursework & Assignments' : 'My Assignments'} ({filteredAssignments.length})
        </button>

        {isLecturer && (
          <button
            onClick={() => setWorkTab('submissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              workTab === 'submissions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Submitted Student Works</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                workTab === 'submissions'
                  ? 'bg-white text-blue-700 font-extrabold'
                  : pendingCount > 0
                  ? 'bg-amber-500 text-white font-extrabold'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {pendingCount > 0 ? `${pendingCount} pending` : relevantSubmissions.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setWorkTab('quizzes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            workTab === 'quizzes'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Live Quizzes & Timed Tests
        </button>
      </div>

      {actionSuccessNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {actionSuccessNotice}
        </div>
      )}

      {/* RENDER VIEW ACCORDING TO TAB */}
      {workTab === 'quizzes' ? (
        <QuizzesView />
      ) : workTab === 'submissions' && isLecturer ? (
        /* LECTURER DEDICATED SUBMITTED WORKS VIEW */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Student Coursework Submissions
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Inspect attached files, read student solution notes, and enter evaluated marks and feedback.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                ⏳ {pendingCount} Pending Review
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ✓ {gradedCount} Graded
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Submissions
              </span>
              <span className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono">
                {submissions.length}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
                Needs Grading
              </span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {pendingCount}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block">
                Graded & Returned
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {gradedCount}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">
                Active Courses
              </span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {myCourses.length}
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by student name, index number, assignment title, or file name..."
                  value={submissionSearchQuery}
                  onChange={(e) => setSubmissionSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Status toggles */}
              <div className="flex items-center gap-1.5 self-start md:self-auto text-xs">
                <button
                  onClick={() => setSubmissionStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    submissionStatusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  All ({relevantSubmissions.length})
                </button>
                <button
                  onClick={() => setSubmissionStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    submissionStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Pending Only
                </button>
                <button
                  onClick={() => setSubmissionStatusFilter('graded')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    submissionStatusFilter === 'graded'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Graded
                </button>
              </div>
            </div>

            {/* Course Filter Chips */}
            {myCourses.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <span className="font-bold text-slate-400 whitespace-nowrap text-[11px]">
                  Course:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCourseFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-bold transition whitespace-nowrap text-xs ${
                    selectedCourseFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All Courses
                </button>
                {myCourses.map((c) => {
                  const isSelected = selectedCourseFilter === c.code;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourseFilter(c.code)}
                      className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1.5 whitespace-nowrap text-xs ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span>{c.code}</span>
                      <span className="text-[10px] opacity-75">({c.level})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submissions Table / Cards */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Assignment</th>
                    <th className="py-3 px-4">Attached Solution</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Status & Mark</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {relevantSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400">
                          No student submissions found matching the criteria.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          When students submit their answers or coursework documents, they appear here instantly.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    relevantSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {sub.studentName}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {sub.studentId.startsWith('demo_') ? 'Student Scholar' : sub.studentId}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {sub.courseCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {sub.itemTitle}
                          </div>
                          {sub.notes && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 italic max-w-xs">
                              "{sub.notes}"
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="p-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold uppercase text-[9px]">
                              {sub.fileType || 'DOC'}
                            </span>
                            <span className="truncate max-w-[140px]">{sub.fileName}</span>
                            {(sub.fileDataUrl || sub.notes) && (
                              <button
                                onClick={() => downloadSubmissionFile(sub)}
                                title="Download or open attached solution file"
                                className="p-1 text-slate-400 hover:text-blue-600 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {sub.submissionDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                              sub.status === 'Graded'
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {sub.status === 'Graded' ? '✓ Graded' : '⏳ Pending'}
                            {sub.mark !== undefined && sub.mark !== null && (
                              <span className="font-mono ml-0.5">({sub.mark}/100)</span>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenInspect(sub)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Inspect full submission and attached documents"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              onClick={() => handleOpenGrading(sub)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Award className="w-3.5 h-3.5" />
                              {sub.status === 'Graded' ? 'Edit Mark' : 'Grade'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* COURSEWORK & ASSIGNMENTS LIST */
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {isLecturer ? 'Coursework & Assignments Management' : 'Classwork & Assignments'}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                {isLecturer
                  ? 'Publish new coursework, track submission counts, and provide evaluated marks.'
                  : 'View course deliverables, download prompts, and upload your completed assignments.'}
              </p>
            </div>

            {isLecturer && (
              <button
                onClick={() => {
                  setAsgCourseCode(myCourses[0]?.code || '');
                  setCreateModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Publish Assignment
              </button>
            )}
          </div>

          {/* Course Filter Bar */}
          {myCourses.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="font-bold text-slate-500 whitespace-nowrap">Filter Course:</span>
              <button
                type="button"
                onClick={() => setSelectedCourseFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCourseFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                All Courses ({filteredAssignments.length})
              </button>
              {myCourses.map((c) => {
                const cNorm = (c.code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
                const count = assignments.filter(
                  (a) => (a.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase() === cNorm
                ).length;
                const isSelected = selectedCourseFilter === c.code;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourseFilter(c.code)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({c.code})</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Assignments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssignments.length === 0 ? (
              <div className="col-span-full p-12 text-center text-xs text-slate-400 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                No coursework or assignments currently published for your classes.
              </div>
            ) : (
              filteredAssignments.map((asg) => {
                const asgNorm = (asg.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
                const courseSubs = submissions.filter(
                  (s) =>
                    s.assignmentId === asg.id ||
                    (s.itemTitle === asg.title &&
                      (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase() === asgNorm)
                );
                const mySubmission = submissions.find(
                  (s) =>
                    (s.assignmentId === asg.id ||
                      (s.itemTitle === asg.title &&
                        (s.courseCode || '').replace(/[^A-Z0-9]/g, '').toUpperCase() === asgNorm)) &&
                    (s.studentId === user?.uid || (user?.name && s.studentName === user.name))
                );

                return (
                  <div
                    key={asg.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {asg.type}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {asg.courseCode}
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                        {asg.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-3">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Due: {asg.due}</span>
                      </div>

                      {asg.desc && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">
                          {asg.desc}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
                      {isLecturer ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">
                            {courseSubs.length} Submissions
                          </span>
                          <button
                            onClick={() => {
                              setSelectedCourseFilter(asg.courseCode);
                              setWorkTab('submissions');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review Works ({courseSubs.length})
                          </button>
                        </div>
                      ) : (
                        <div>
                          {mySubmission ? (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between text-xs font-bold mb-1">
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {mySubmission.status}
                                </span>
                                {mySubmission.mark !== undefined && mySubmission.mark !== null && (
                                  <span className="font-mono text-blue-600">
                                    Mark: {mySubmission.mark} / 100
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block truncate">
                                File: {mySubmission.fileName}
                              </span>
                              {mySubmission.feedback && (
                                <p className="text-[11px] text-slate-500 mt-1 italic">
                                  Feedback: "{mySubmission.feedback}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveAssignment(asg);
                                setSelectedFileName('');
                                setSubmitModalOpen(true);
                              }}
                              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" /> Upload & Submit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* MODAL 1: Create Assignment Modal */}
      {createModalOpen && (
        <div
          onClick={() => setCreateModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Publish New Coursework
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter assignment details for enrolled students.
            </p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Course Code
                  </label>
                  <select
                    value={asgCourseCode}
                    onChange={(e) => setAsgCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    {myCourses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.level} - {c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={asgType}
                    onChange={(e) => setAsgType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Project">Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vector Spatial Distribution Map"
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={asgDue}
                  onChange={(e) => setAsgDue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions & Guidelines
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide details on required format, questions, or deliverables..."
                  value={asgDesc}
                  onChange={(e) => setAsgDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-sm"
                >
                  Publish Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Student Upload & Submit Modal */}
      {submitModalOpen && activeAssignment && (
        <div
          onClick={() => setSubmitModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Submit Work: {activeAssignment.title}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Course: {activeAssignment.courseCode} · Due {activeAssignment.due}
            </p>

            {submitModalError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs">
                {submitModalError}
              </div>
            )}
            <form onSubmit={handleSubmitSolution} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attach Document / Solution File (PDF, DOCX, ZIP, or Text)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.zip,.png,.jpg"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 dark:file:bg-blue-950/60 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
                />
                {selectedFileName && (
                  <small className="text-emerald-600 dark:text-emerald-400 font-bold block mt-1.5">
                    ✓ Attached: {selectedFileName}
                  </small>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Solution Notes & Comments
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your answers, methodology explanations, references, or working notes here..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Submit Solution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Lecturer Inspect Submission Details & File */}
      {inspectModalOpen && activeSubmission && (
        <div
          onClick={() => setInspectModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  {activeSubmission.courseCode}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {activeSubmission.itemTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  Submitted by <strong className="text-slate-800 dark:text-white">{activeSubmission.studentName}</strong> on {activeSubmission.submissionDate}
                </p>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Attached File Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-xs uppercase">
                  {activeSubmission.fileType || 'DOC'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {activeSubmission.fileName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Attached coursework deliverable
                  </div>
                </div>
              </div>

              {(activeSubmission.fileDataUrl || activeSubmission.notes) && (
                <button
                  onClick={() => downloadSubmissionFile(activeSubmission)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </button>
              )}
            </div>

            {/* Student Notes / Answers */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Student Notes / Working Explanations
              </label>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {activeSubmission.notes || (
                  <span className="italic text-slate-400">No additional notes provided by student.</span>
                )}
              </div>
            </div>

            {/* Current Evaluation Status */}
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  Current Status
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeSubmission.status === 'Graded'
                    ? `Graded: ${activeSubmission.mark} / 100`
                    : 'Pending Grading'}
                </strong>
                {activeSubmission.feedback && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5">
                    "{activeSubmission.feedback}"
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setInspectModalOpen(false);
                  setGradingModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                {activeSubmission.status === 'Graded' ? 'Change Grade' : 'Grade Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Lecturer Grade & Feedback Modal */}
      {gradingModalOpen && activeSubmission && (
        <div
          onClick={() => setGradingModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Grade: {activeSubmission.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeSubmission.courseCode} · {activeSubmission.itemTitle}
                </p>
              </div>
              <button
                onClick={() => setGradingModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Numerical Mark (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  placeholder="e.g. 88.5"
                  value={gradeMark}
                  onChange={(e) => setGradeMark(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lecturer Constructive Feedback
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter feedback on methodology, formatting, accuracy, and improvement areas..."
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setGradingModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save Grade & Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
