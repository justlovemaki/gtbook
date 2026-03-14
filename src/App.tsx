import { useEffect, useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { FileNav } from './components/FileNav';
import { BookmarkTree } from './components/BookmarkTree';
import { ContentView } from './components/ContentView';
import { NavigationMode } from './components/NavigationMode';
import { ToastContainer } from './components/ToastContainer';
import { useStore } from './store/useStore';
import { GitHubService } from './lib/github';
import { Github, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AIAssistant = lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })));

function App() {
  const { t } = useTranslation();
  const { config, setFiles, setLoading, setError, isLoading, files, setLastFetched, viewMode, theme, mobileActivePane, _hasHydrated } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);


  useEffect(() => {
    const hasConfig = config?.githubToken && config?.owner && config?.repo;
    if (hasConfig && !isLoading) {
      if (files.length === 0) {
        loadData();
      }
    }
  }, [config]);

  const loadData = async (force: boolean = false) => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const github = new GitHubService(config);
      const data = await github.fetchFiles(force);
      setFiles(data, true);
      setLastFetched(Date.now());
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('app.failedFetch'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
      {!_hasHydrated ? (
        <div className="flex-1 flex items-center justify-center bg-background">
          <Loader2 className="w-10 h-10 animate-spin text-primary/20" />
        </div>
      ) : viewMode === 'reader' ? (
        <>
          {/* Main Layout for Reader Mode */}
          <div className="flex flex-1 h-full overflow-hidden">
            {/* File Navigation Pane */}
            <div className={clsx(
              "w-full md:w-48 h-full border-r shrink-0 transition-all",
              mobileActivePane !== 'files' && "hidden md:flex"
            )}>
              <FileNav 
                onOpenSettings={() => setIsSettingsOpen(true)} 
                onRefresh={() => loadData(true)}
              />
            </div>

            {/* Bookmark Tree Pane */}
            <div className={clsx(
              "md:w-80 h-full border-r shrink-0 transition-all bg-muted/5",
              mobileActivePane !== 'bookmarks' && "hidden md:flex",
              mobileActivePane === 'bookmarks' && "flex-1 md:flex-none md:w-80"
            )}>
              <BookmarkTree />
            </div>
            
            {/* Content Preview Pane */}
            <main className={clsx(
              "flex-1 h-full flex flex-col min-w-0 transition-all",
              mobileActivePane !== 'content' && "hidden md:flex"
            )}>
              <ContentView />
            </main>
          </div>
        </>
      ) : (
        <main className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
          <NavigationMode 
            onOpenSettings={() => setIsSettingsOpen(true)} 
            onRefresh={() => loadData(true)}
          />
        </main>
      )}

      <Suspense fallback={null}>
      {_hasHydrated && (
        <Suspense fallback={null}>
          {viewMode === 'reader' && <AIAssistant />}
          <Settings 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onRefresh={() => loadData(true)}
          />
        </Suspense>
      )}
      </Suspense>

      <ToastContainer />

      {/* Initial State / Overlay */}
      {_hasHydrated && !config && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="bg-primary/5 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10">
              <Github className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">{t('app.title')}</h1>
            <p className="text-muted-foreground">
              {t('app.description')}
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition-all transform hover:scale-105"
            >
              {t('app.getStarted')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
