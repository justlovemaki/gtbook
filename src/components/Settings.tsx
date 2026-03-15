import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import type { AppConfig } from '../lib/types';
import { X, Save, Key, Github, FolderOpen, Globe, Languages, Eye, EyeOff, Moon, Sun, Settings as SettingsIcon, Sparkles, Download, Upload, Monitor, CloudUpload } from 'lucide-react';
import { toast } from '../store/useToast';

export const Settings: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  onRefresh?: () => void;
}> = ({ isOpen, onClose, onRefresh }) => {
  const { t, i18n } = useTranslation();
  const { config, setConfig, theme, setTheme, pendingChanges, clearPendingChanges, files } = useStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [localConfig, setLocalConfig] = useState<AppConfig>(() => {
    const base = config || { githubToken: '', owner: '', repo: '', path: '', openaiKey: '' };
    return {
      ...base,
      openaiBaseUrl: base.openaiBaseUrl || 'https://api.openai.com/v1',
      openaiModel: base.openaiModel || 'gpt-3.5-turbo'
    };
  });

  if (!isOpen) return null;

  const handleSave = () => {
    setConfig(localConfig);
    toast.success(t('common.success'));
    onClose();
  };

  const handleExport = () => {
    const data = {
      config: localConfig,
      files: useStore.getState().files,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtbook-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('settings.backupExportSuccess'));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) {
          setLocalConfig(data.config);
          setConfig(data.config);
        }
        if (data.files) {
          // First, ensure we have the latest from cloud to compare against
          // Await it to ensure state is updated before we add pending changes
          if (onRefresh) {
            await (onRefresh() as any);
          }
          
          const store = useStore.getState();
          
          // Clear current pending changes
          store.clearPendingChanges();
          
          // Add imported files to pending changes
          // These will be compared against the cloud files we just refreshed
          data.files.forEach((file: any) => {
            store.addPendingChange({
              path: file.path,
              content: file.content,
              sha: file.sha
            });
          });

          // Set files locally
          store.setFiles(data.files, false);
        }
        toast.success(t('settings.backupRestoreSuccess'));
        if (useStore.getState().pendingChanges.length > 0) {
          toast.info(t('settings.backupRestoreSync'));
        }
      } catch (err) {
        toast.error(t('settings.invalidBackup'));
      }
    };
    reader.readAsText(file);
  };

  const handleSyncAll = async () => {
    if (!config || pendingChanges.length === 0) return;
    setIsSyncing(true);
    toast.info(t('sync.syncing'));
    try {
      const { GitHubService } = await import('../lib/github');
      const github = new GitHubService(config);
      
      // Clone files to track latest SHAs during the loop
      let currentFiles = [...files];
      
      for (const change of pendingChanges) {
        const file = currentFiles.find(f => f.path === change.path);
        if (file) {
          // Use force: true to automatically resolve SHA conflicts during batch sync
          const newSha = await github.updateFile({ ...file }, change.content, true);
          currentFiles = currentFiles.map(f => f.path === file.path ? { ...f, sha: newSha } : f);
        }
      }
      
      // Update global store with the final state of SHAs
      useStore.getState().setFiles(currentFiles, true);
      
      clearPendingChanges();
      if (onRefresh) onRefresh();
      toast.success(t('sync.success'));
    } catch (err: any) {
      const msg = err.message === "CONFLICT" ? t('sync.conflict') : err.message;
      toast.error(t('sync.failed') + ": " + msg);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              {t('settings.title')}
            </h2>
            <a 
              href="https://github.com/justlovemaki/gtbook" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border-l pl-3 ml-1"
            >
              <Github className="w-3 h-3" />
              <span>{t('settings.projectLink')}</span>
            </a>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Github className="w-4 h-4" /> {t('settings.githubToken')}
            </label>
              <div className="relative">
                <input
                  type={showGithubToken ? "text" : "password"}
                  placeholder="ghp_..."
                  value={localConfig.githubToken}
                  onChange={(e) => setLocalConfig({ ...localConfig, githubToken: e.target.value })}
                  disabled={!!import.meta.env.VITE_GITHUB_TOKEN}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none pr-10",
                    !!import.meta.env.VITE_GITHUB_TOKEN ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  disabled={!!import.meta.env.VITE_GITHUB_TOKEN}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.repoOwner')}</label>
                <input
                  type="text"
                  placeholder="username"
                  value={localConfig.owner}
                  onChange={(e) => setLocalConfig({ ...localConfig, owner: e.target.value })}
                  disabled={!!import.meta.env.VITE_GITHUB_OWNER}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none",
                    !!import.meta.env.VITE_GITHUB_OWNER ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.repoName')}</label>
                <input
                  type="text"
                  placeholder="my-favorites"
                  value={localConfig.repo}
                  onChange={(e) => setLocalConfig({ ...localConfig, repo: e.target.value })}
                  disabled={!!import.meta.env.VITE_GITHUB_REPO}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none",
                    !!import.meta.env.VITE_GITHUB_REPO ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4" /> {t('settings.baseDirectory')}
              </label>
              <input
                type="text"
                placeholder="data/bookmarks"
                value={localConfig.path}
                onChange={(e) => setLocalConfig({ ...localConfig, path: e.target.value })}
                disabled={!!import.meta.env.VITE_GITHUB_PATH}
                className={clsx(
                  "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none",
                  !!import.meta.env.VITE_GITHUB_PATH ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Key className="w-4 h-4" /> {t('settings.openaiKey')}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={localConfig.openaiKey}
                  onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                  disabled={!!import.meta.env.VITE_OPENAI_KEY}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none pr-10",
                    !!import.meta.env.VITE_OPENAI_KEY ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={!!import.meta.env.VITE_OPENAI_KEY}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" /> {t('settings.openaiBaseUrl')}
              </label>
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={localConfig.openaiBaseUrl}
                onChange={(e) => setLocalConfig({ ...localConfig, openaiBaseUrl: e.target.value })}
                disabled={!!import.meta.env.VITE_OPENAI_BASE_URL}
                className={clsx(
                  "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none",
                  !!import.meta.env.VITE_OPENAI_BASE_URL ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {t('settings.openaiModel')}
              </label>
              <input
                type="text"
                placeholder="gpt-3.5-turbo"
                value={localConfig.openaiModel}
                onChange={(e) => setLocalConfig({ ...localConfig, openaiModel: e.target.value })}
                disabled={!!import.meta.env.VITE_OPENAI_MODEL}
                className={clsx(
                  "w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none",
                  !!import.meta.env.VITE_OPENAI_MODEL ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-muted/50"
                )}
              />
            </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Languages className="w-4 h-4" /> {t('settings.language')}
            </label>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none appearance-none bg-muted/50"
            >
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} {t('settings.theme')}
            </label>
            <div className="flex p-1 rounded-md border bg-muted/50">
              <button
                onClick={() => setTheme('light')}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-all",
                  theme === 'light' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="w-3.5 h-3.5" />
                {t('settings.light')}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-all",
                  theme === 'dark' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="w-3.5 h-3.5" />
                {t('settings.dark')}
              </button>
              <button
                onClick={() => setTheme('system')}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-all",
                  theme === 'system' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Monitor className="w-3.5 h-3.5" />
                {t('settings.system')}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
              {t('settings.dataManagement')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-muted hover:bg-muted/80 rounded-md text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t('settings.exportBackup')}
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-muted hover:bg-muted/80 rounded-md text-xs font-semibold transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {t('settings.importBackup')}
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
              </label>
            </div>
            
            {pendingChanges.length > 0 && (
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 mt-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition-all shadow-lg shadow-amber-500/20 animate-in fade-in slide-in-from-top-2"
              >
                {isSyncing ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                {t('sync.offlineSyncButton')} ({pendingChanges.length})
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {t('settings.saveConfig')}
          </button>
        </div>
      </div>
    </div>
  );
};
