import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { 
  Globe, 
  Folder, 
  ExternalLink, 
  ChevronRight, 
  Home, 
  BookOpen, 
  Settings as SettingsIcon, 
  RefreshCw,
  Search,
  X,
  FileText,
  CloudUpload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { Bookmark, Directory, FavoriteFile } from '../lib/types';
import { toast } from '../store/useToast';
import { GitHubService } from '../lib/github';

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const NavBookmark: React.FC<{ item: Bookmark }> = ({ item }) => {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={item.title}
      className="group flex items-center justify-between p-4 rounded-2xl bg-card border hover:border-primary/30 hover:shadow-lg transition-all overflow-hidden h-full"
    >
      <div className="flex flex-col min-w-0 flex-1 mr-2">
        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
          {item.title}
        </span>
        <span className="text-[11px] text-muted-foreground truncate opacity-60 mt-1">
          {getHostname(item.url)}
        </span>
      </div>
      <div className="bg-muted group-hover:bg-primary/10 p-1.5 rounded-lg transition-colors shrink-0">
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-opacity" />
      </div>
    </a>
  );
};

const NavFolderItem: React.FC<{ item: Directory; onClick: () => void }> = ({ item, onClick }) => {
  const { t } = useTranslation();
  return (
    <div 
      onClick={onClick}
      title={item.title}
      className="group flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-muted/50 cursor-pointer select-none transition-all h-full"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2.5 rounded-xl bg-background shadow-sm group-hover:scale-110 transition-transform">
          <Folder className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-black truncate leading-tight">{item.title}</span>
          <span className="text-[10px] text-muted-foreground opacity-60 mt-0.5 font-bold uppercase tracking-wider">
            {item.children.length} {t('nav.items')}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-40 group-hover:translate-x-1 transition-transform" />
    </div>
  );
};

const Breadcrumbs: React.FC<{ path: string[]; onNavigate: (index: number) => void }> = ({ path, onNavigate }) => {
  const { t } = useTranslation();
  return (
    <nav className="flex items-center flex-wrap gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6 bg-muted/20 p-2 rounded-xl border border-border/30 w-fit">
      <button 
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1.5 px-2 py-1 hover:text-primary transition-colors rounded-lg hover:bg-background"
      >
        <Home className="w-3 h-3" />
        <span>{t('nav.root')}</span>
      </button>
      
      {path.map((name, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3 h-3 opacity-30" />
          <button 
            onClick={() => onNavigate(index)}
            className={clsx(
              "px-2 py-1 rounded-lg transition-colors",
              index === path.length - 1 ? "text-primary bg-background shadow-sm" : "hover:text-primary hover:bg-background"
            )}
          >
            {name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};

const FileCard: React.FC<{ file: FavoriteFile }> = ({ file }) => {
  const { t } = useTranslation();
  const [navStack, setNavStack] = useState<Directory[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  
  const currentLevel = navStack.length > 0 
    ? navStack[navStack.length - 1].children 
    : file.tree;

  const currentPathNames = navStack.map(d => d.title);

  useEffect(() => {
    if (navStack.length > 0) {
      const target = breadcrumbRef.current || cardRef.current;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [navStack.length]);

  const handleEnterFolder = (dir: Directory) => {
    setNavStack([...navStack, dir]);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setNavStack([]);
    } else {
      setNavStack(navStack.slice(0, index + 1));
    }
  };

  if (file.tree.length === 0) return null;

  return (
    <div className="space-y-6 scroll-mt-24" ref={cardRef}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase">
              {file.filename.replace(/^\d+-/, '').replace('.md', '')}
            </h2>
            <p className="text-[10px] font-black text-primary/40 tracking-[0.2em] uppercase mt-0.5">
              {t('nav.source')}: {file.filename}
            </p>
          </div>
        </div>
      </div>

      <div ref={breadcrumbRef} className="scroll-mt-28">
        {navStack.length > 0 && (
          <div className="px-2">
            <Breadcrumbs path={currentPathNames} onNavigate={handleNavigateBreadcrumb} />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
          <motion.div
          key={navStack.length > 0 ? navStack[navStack.length - 1].id : 'root'}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >

          {currentLevel.map((item) => (
            <div key={item.id} className="h-full">
              {'children' in item ? (
                <NavFolderItem item={item as Directory} onClick={() => handleEnterFolder(item as Directory)} />
              ) : (
                <NavBookmark item={item as Bookmark} />
              )}
            </div>
          ))}
          {currentLevel.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-3xl opacity-30 italic text-sm">
              {t('nav.folderEmpty')}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-16 opacity-40" />
    </div>
  );
};

export const NavigationMode: React.FC<{ 
  onOpenSettings: () => void; 
  onRefresh: () => void 
}> = ({ onOpenSettings, onRefresh }) => {
  const { t } = useTranslation();
  const { 
    files, 
    isLoading, 
    setViewMode, 
    pendingChanges, 
    config, 
    clearPendingChanges 
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!config || pendingChanges.length === 0) return;
    setIsSyncing(true);
    toast.info(t('sync.syncing'));
    try {
      const github = new GitHubService(config);
      for (const change of pendingChanges) {
        const file = files.find(f => f.path === change.path);
        if (file) {
          // Use force: true to automatically resolve SHA conflicts during batch sync
          await github.updateFile({ ...file }, change.content, true);
        }
      }
      clearPendingChanges();
      onRefresh();
      toast.success(t('sync.success'));
    } catch (err: any) {
      const msg = err.message === "CONFLICT" ? t('sync.conflict') : err.message;
      toast.error(t('sync.failed') + ": " + msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { item: Bookmark; filename: string; path: string[] }[] = [];

    files.forEach(file => {
      const traverse = (items: (Bookmark | Directory)[], currentPath: string[]) => {
        items.forEach(item => {
          if ('children' in item) {
            traverse(item.children, [...currentPath, item.title]);
          } else {
            if (item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query)) {
              results.push({ item, filename: file.filename, path: currentPath });
            }
          }
        });
      };
      traverse(file.tree, []);
    });
    return results;
  }, [files, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <span className="mt-6 text-sm font-bold text-primary tracking-widest uppercase animate-pulse">{t('nav.accessingFavorites')}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 md:p-12 lg:p-20 relative">
      {/* Top Navigation Bar */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setViewMode('reader')}
          className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur border rounded-full shadow-lg hover:shadow-xl transition-all text-sm font-bold text-primary border-primary/20"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">{t('nav.readerMode')}</span>
        </button>
        <button
          onClick={onRefresh}
          className="p-2.5 bg-background/80 backdrop-blur border rounded-full shadow-lg hover:shadow-xl transition-all text-muted-foreground hover:text-primary border-border"
          title={t('fileNav.refreshAll')}
        >
          <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
        </button>
        {pendingChanges.length > 0 && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-2.5 bg-background/80 backdrop-blur border border-amber-500/30 rounded-full shadow-lg hover:shadow-xl transition-all text-amber-500 hover:text-amber-600 animate-pulse flex items-center gap-2"
            title={t('sync.offlineSyncButton')}
          >
            <CloudUpload className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
            <span className="text-[10px] font-black pr-1">{pendingChanges.length}</span>
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="p-2.5 bg-background/80 backdrop-blur border rounded-full shadow-lg hover:shadow-xl transition-all text-muted-foreground hover:text-primary border-border"
          title={t('common.settings')}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-24 pb-32">
        <header className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Cloud Hub
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85] text-foreground">
            Digital<br />
            <span className="text-primary opacity-90 italic">{t('nav.digitalNavigator')}</span>
          </h1>
          <p className="text-muted-foreground text-base font-medium max-w-md leading-relaxed opacity-70">
            {t('nav.gatewayDesc')}
          </p>
          
          <div className="pt-4 max-w-md">
            <div className="relative group">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder={t('nav.searchAll')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-card border rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-3.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {searchQuery ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2 border-b pb-4 border-border/30">
              <h2 className="text-xl font-black tracking-tight text-primary flex items-center gap-2">
                {t('nav.searchResults')}
                <span className="text-xs bg-primary/10 px-2 py-0.5 rounded-full font-bold ml-2">
                  {searchResults.length} {t('nav.found')}
                </span>
              </h2>
            </div>
            
            {searchResults.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-[2rem] opacity-30 italic">
                {t('nav.noMatchedSearch')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {searchResults.map((result, idx) => (
                  <div key={`${result.item.url}-${idx}`} className="space-y-1.5 group/search">
                    <NavBookmark item={result.item} />
                    <div className="px-3 flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 overflow-hidden">
                      <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded">
                        <FileText className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[80px]">
                          {result.filename.replace(/^\d+-/, '').replace('.md', '')}
                        </span>
                      </div>
                      {result.path.length > 0 && (
                        <div className="flex items-center gap-1">
                          <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                          <span className="truncate max-w-[120px]">{result.path.join(' / ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-50">
            <Globe className="w-16 h-16 mb-6 text-muted-foreground" />
            <p className="font-bold text-muted-foreground tracking-tight uppercase text-xs tracking-widest">{t('nav.noDataSync')}</p>
          </div>
        ) : (
          <div className="space-y-32">
            {files.map(file => (
              <FileCard key={file.path} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
