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
  const { t, i18n } = useTranslation();
  const { config, setConfig, setFiles, setLoading, setError, isLoading, files, activeFileIndex, setLastFetched, viewMode, setViewMode, theme, setTheme, mobileActivePane, _hasHydrated } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize/Override config from ENV if available
  useEffect(() => {
    if (_hasHydrated) {
      // 1. Handle Config
      const envConfig = {
        githubToken: import.meta.env.VITE_GITHUB_TOKEN,
        owner: import.meta.env.VITE_GITHUB_OWNER,
        repo: import.meta.env.VITE_GITHUB_REPO,
        path: import.meta.env.VITE_GITHUB_PATH,
        openaiKey: import.meta.env.VITE_OPENAI_KEY,
        openaiBaseUrl: import.meta.env.VITE_OPENAI_BASE_URL,
        openaiModel: import.meta.env.VITE_OPENAI_MODEL
      };

      const currentConfig = config || { 
        githubToken: '', owner: '', repo: '', path: 'favorites', openaiKey: '',
        openaiBaseUrl: 'https://api.openai.com/v1', openaiModel: 'gpt-3.5-turbo'
      };
      
      let hasChanged = false;
      const mergedConfig = { ...currentConfig };

      // Apply ENV overrides
      if (envConfig.githubToken && envConfig.githubToken !== currentConfig.githubToken) {
        mergedConfig.githubToken = envConfig.githubToken;
        hasChanged = true;
      }
      if (envConfig.owner && envConfig.owner !== currentConfig.owner) {
        mergedConfig.owner = envConfig.owner;
        hasChanged = true;
      }
      if (envConfig.repo && envConfig.repo !== currentConfig.repo) {
        mergedConfig.repo = envConfig.repo;
        hasChanged = true;
      }
      if (envConfig.path && envConfig.path !== currentConfig.path) {
        mergedConfig.path = envConfig.path;
        hasChanged = true;
      }
      if (envConfig.openaiKey && envConfig.openaiKey !== currentConfig.openaiKey) {
        mergedConfig.openaiKey = envConfig.openaiKey;
        hasChanged = true;
      }
      if (envConfig.openaiBaseUrl && envConfig.openaiBaseUrl !== currentConfig.openaiBaseUrl) {
        mergedConfig.openaiBaseUrl = envConfig.openaiBaseUrl;
        hasChanged = true;
      }
      if (envConfig.openaiModel && envConfig.openaiModel !== currentConfig.openaiModel) {
        mergedConfig.openaiModel = envConfig.openaiModel;
        hasChanged = true;
      }

      if (hasChanged || (!config && mergedConfig.githubToken && mergedConfig.owner && mergedConfig.repo)) {
        setConfig(mergedConfig);
      }

      // 2. Handle Default Theme
      const envTheme = import.meta.env.VITE_DEFAULT_THEME;
      if (envTheme && theme !== envTheme) {
        setTheme(envTheme as 'light' | 'dark' | 'system');
      }

      // 3. Handle Default Language
      const envLang = import.meta.env.VITE_DEFAULT_LANG;
      if (envLang && i18n.language !== envLang) {
        i18n.changeLanguage(envLang);
      }
    }
  }, [_hasHydrated, config, setConfig, theme, setTheme, i18n]);


  useEffect(() => {
    if (import.meta.env.VITE_PUBLIC_MODE === 'true' && viewMode !== 'navigation') {
      setViewMode('navigation');
    }
  }, [viewMode, setViewMode]);

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

  // Update SEO metadata based on language and active file
  useEffect(() => {
    const activeFile = files[activeFileIndex];
    const baseTitle = t('app.title');
    const suffix = t('nav.digitalNavigator');
    const fullSuffix = `${suffix} & Smart Link Collector`;
    
    if (viewMode === 'reader' && activeFile) {
      const fileName = activeFile.filename.replace('.md', '');
      document.title = `${fileName} | ${baseTitle} - Modern GitHub Favorites Manager`;
    } else {
      document.title = `${baseTitle} - ${fullSuffix}`;
    }

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      // Use a more detailed description to hit the 140-160 range (for Latin characters)
      // or 70-80 for CJK characters.
      const desc = t('nav.gatewayDesc') || t('app.description');
      let finalDesc = desc;
      
      if (i18n.language.startsWith('zh')) {
        // For Chinese, aim for ~80 characters or longer if the tool expects 140+ Latin-equivalent
        if (finalDesc.length < 100) {
          finalDesc += " gtbook 提供一个安全、纯客户端的环境，通过 AI 驱动的语义搜索和智能分类功能，帮助您高效管理数字化收藏。使用 GitHub 作为后端，确保数据完全由您掌控且永不丢失。";
        }
      } else {
        if (finalDesc.length < 140) {
          finalDesc += " gtbook provides a secure, purely client-side environment for managing your digital ecosystem with AI-powered semantic search, smart organization, and seamless GitHub integration for data persistence.";
        }
      }
      
      metaDescription.setAttribute('content', finalDesc);
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', finalDesc);
      const twitterDesc = document.querySelector('meta[name="twitter:description"]');
      if (twitterDesc) twitterDesc.setAttribute('content', finalDesc);
    }
  }, [t, i18n.language, files, activeFileIndex, viewMode]);


  useEffect(() => {
    const hasConfig = config?.githubToken || (config?.owner && config?.repo);
    if (hasConfig && !isLoading) {
      if (files.length === 0) {
        loadData();
      } else {
        // Check if last fetched was more than 30 minutes ago
        const thirtyMinutesInMs = 30 * 60 * 1000;
        const now = Date.now();
        const lastFetchedTime = useStore.getState().lastFetched || 0;
        
        if (now - lastFetchedTime > thirtyMinutesInMs) {
          loadData(true); // Force refresh
        }
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
      {_hasHydrated && !config && import.meta.env.VITE_PUBLIC_MODE !== 'true' && (
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
