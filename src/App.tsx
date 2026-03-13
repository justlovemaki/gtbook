import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Reader } from './components/Reader';
import { Settings } from './components/Settings';
import { AIAssistant } from './components/AIAssistant';
import { useStore } from './store/useStore';
import { GitHubService } from './lib/github';
import { Github } from 'lucide-react';

function App() {
  const { config, setFiles, setLoading, setError } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(!config);

  useEffect(() => {
    if (config?.githubToken && config?.owner && config?.repo) {
      loadData();
    }
  }, [config]);

  const loadData = async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const github = new GitHubService(config);
      const data = await github.fetchFiles();
      setFiles(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Reader />
      </main>

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
