import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { QuickJumpModal } from './components/QuickJumpModal';

// Views
import { LecturerDashboard } from './views/LecturerDashboard';
import { StudentDashboard } from './views/StudentDashboard';
import { CoursesView } from './views/CoursesView';
import { TimetableView } from './views/TimetableView';
import { ClassListManagementView } from './views/ClassListManagementView';
import { AssignmentsView } from './views/AssignmentsView';
import { StudentMarksView } from './views/StudentMarksView';
import { AnnouncementsView } from './views/AnnouncementsView';
import { StudyFilesView } from './views/StudyFilesView';
import { LiveMeetingView } from './views/LiveMeetingView';
import { BudgetTrackerView } from './views/BudgetTrackerView';
import { CycleCareView } from './views/CycleCareView';
import { ProfileView } from './views/ProfileView';
import { AdminSuperConsoleView } from './views/AdminSuperConsoleView';
import { ShadowSessionBanner } from './components/ShadowSessionBanner';

const MainAppContent: React.FC = () => {
  const { user, loading, isSuperAdmin } = useAuth();
  const isLecturer = user?.role === 'lecturer';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (user?.role === 'admin') return 'admin-console';
    return isLecturer ? 'lecturer-dash' : 'student-dash';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('lh_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('lh_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sync default landing tab when role changes
  useEffect(() => {
    if (user) {
      if (user.role === 'admin' && !currentTab.startsWith('admin-')) {
        setCurrentTab('admin-console');
      } else if (user.role === 'lecturer' && (currentTab.startsWith('student-') || currentTab === 'admin-console')) {
        setCurrentTab('lecturer-dash');
      } else if (user.role === 'student' && (currentTab.startsWith('lecturer-') || currentTab === 'admin-console')) {
        setCurrentTab('student-dash');
      }
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#071231] text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-400 text-[#071231] font-extrabold text-2xl flex items-center justify-center shadow-xl animate-pulse">
          L
        </div>
        <span className="mt-4 text-xs font-bold tracking-widest uppercase text-blue-200">
          Connecting to Firebase...
        </span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    setSelectedCourseId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCourseDetail = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCurrentTab(isLecturer ? 'lecturer-courses' : 'student-courses');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#060f2a] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Floating Stealth Shadow Session banner */}
      <ShadowSessionBanner onExitToAdmin={() => handleSelectTab('admin-console')} />

      <div className="flex-1 flex min-w-0">
        {/* Sidebar for Desktop & Drawer for Mobile */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          <TopBar
            currentTab={currentTab}
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenQuickJump={() => setQuickJumpOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSelectTab={handleSelectTab}
          />

          <main className="p-4 md:p-8 max-w-7xl w-full mx-auto flex-1">
            {currentTab === 'admin-console' && (
              <AdminSuperConsoleView onSelectTab={handleSelectTab} />
            )}

            {currentTab === 'lecturer-dash' && (
              <LecturerDashboard
                onSelectTab={handleSelectTab}
                onOpenCreateCourse={() => {
                  setCurrentTab('lecturer-courses');
                }}
              />
            )}

          {currentTab === 'student-dash' && (
            <StudentDashboard
              onSelectTab={handleSelectTab}
              onOpenCourseDetail={handleOpenCourseDetail}
            />
          )}

          {(currentTab === 'lecturer-courses' ||
            currentTab === 'student-courses' ||
            currentTab === 'student-settings') && (
            <CoursesView
              onSelectTab={handleSelectTab}
              selectedCourseId={selectedCourseId}
              onClearSelectedCourse={() => setSelectedCourseId(null)}
            />
          )}

          {(currentTab === 'lecturer-timetable' || currentTab === 'student-timetable') && (
            <TimetableView />
          )}

          {currentTab === 'lecturer-classlist' && <ClassListManagementView />}

          {(currentTab === 'lecturer-work' ||
            currentTab === 'student-work' ||
            currentTab === 'lecturer-subs') && (
            <AssignmentsView
              initialTab={currentTab === 'lecturer-subs' ? 'submissions' : undefined}
            />
          )}

          {currentTab === 'student-marks' && <StudentMarksView />}

          {(currentTab === 'lecturer-announcements' || currentTab === 'student-announcements') && (
            <AnnouncementsView />
          )}

          {(currentTab === 'lecturer-files' || currentTab === 'student-files') && (
            <StudyFilesView />
          )}

          {(currentTab === 'lecturer-meet' || currentTab === 'student-meet') && (
            <LiveMeetingView />
          )}

          {currentTab === 'budget-tracker' && <BudgetTrackerView />}

          {currentTab === 'student-cycle' && (
            user?.gender === 'female' ? (
              <CycleCareView />
            ) : (
              <div className="p-8 max-w-md mx-auto text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 text-2xl flex items-center justify-center mb-3">
                  🌸
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                  Reserved for Female Scholars
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                  The Period Cycle Care Tracker is exclusively available to female students. You can review your profile gender setting at any time.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleSelectTab('student-dash')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                  <button
                    onClick={() => handleSelectTab('profile')}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            )
          )}

          {currentTab === 'profile' && (
            <ProfileView theme={theme} onToggleTheme={toggleTheme} />
          )}
        </main>
      </div>
    </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Quick Jump Palette (Ctrl+K) */}
      <QuickJumpModal
        isOpen={quickJumpOpen}
        onClose={() => setQuickJumpOpen(false)}
        onSelectTab={handleSelectTab}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainAppContent />
      </DataProvider>
    </AuthProvider>
  );
}
