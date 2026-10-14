import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './Layout';
import { SubjectsPage } from './pages/SubjectsPage';
import { TodayPage } from './pages/TodayPage';
import { SubjectPage } from './pages/SubjectPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { Loading } from '../components/ui';
import { useProgress } from '../storage/progress';

// The lesson player pulls in mathjs, KaTeX and Markdown — keep them out of the initial bundle.
const LessonPage = lazy(() => import('./pages/LessonPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function useApplySettings() {
  const settings = useProgress((s) => s.progress.settings);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.style.fontSize = `${settings.fontScale * 100}%`;
    if (settings.reducedMotion) root.dataset.motion = 'reduce';
    else delete root.dataset.motion;
  }, [settings]);
}

export function App() {
  useApplySettings();
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="s/:subjectId" element={<SubjectPage />} />
            <Route path="l/:lessonId" element={<LessonPage />} />
            <Route
              path="practice/*"
              element={
                <ComingSoonPage
                  title="Practice"
                  what="Practice sets, daily practice and mistakes review are being built."
                />
              }
            />
            <Route
              path="puzzles/*"
              element={
                <ComingSoonPage
                  title="Puzzles"
                  what="Puzzle packs are being built, starting with circuits."
                />
              }
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
