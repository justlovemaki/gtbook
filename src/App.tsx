import { useEffect, useState } from 'react';
import { FileNav } from './components/FileNav';
import { BookmarkTree } from './components/BookmarkTree';
import { ContentView } from './components/ContentView';
import { NavigationMode } from './components/NavigationMode';
import { Settings } from './components/Settings';
import { AIAssistant } from './components/AIAssistant';
import { useStore } from './store/useStore';
import { GitHubService } from './lib/github';
import { Github } from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const { config, setFiles, setLoading, setError, isLoading, files, setLastFetched, viewMode, mobileActivePane } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(!config);

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
      setFiles(data);
      setLastFetched(Date.now());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
      {viewMode === 'reader' ? (
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

      <AIAssistant />
      
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {/* Initial State / Overlay */}
      {!config && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="bg-primary/5 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10">
              <Github className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">MGR Reader</h1>
            <p className="text-muted-foreground">
              A modern, minimalist favorites manager using GitHub as your backend. 
              Purely client-side, secure, and AI-powered.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition-all transform hover:scale-105"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
