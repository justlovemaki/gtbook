import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import type { AppConfig } from '../lib/types';
import { X, Save, Key, Github, FolderOpen, Globe, Languages, Eye, EyeOff, Moon, Sun, Settings as SettingsIcon, Sparkles, Download, Upload, Monitor } from 'lucide-react';
import { toast } from '../store/useToast';

export const Settings: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { config, setConfig, theme, setTheme } = useStore();
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
    a.download = `mgr-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('settings.backupExportSuccess'));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) {
          setLocalConfig(data.config);
          setConfig(data.config);
        }
        if (data.files) {
          useStore.getState().setFiles(data.files);
        }
        toast.success(t('settings.backupRestoreSuccess'));
      } catch (err) {
        toast.error(t('settings.invalidBackup'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            {t('settings.title')}
          </h2>
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
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGithubToken(!showGithubToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.repoName')}</label>
              <input
                type="text"
                placeholder="my-favorites"
                value={localConfig.repo}
                onChange={(e) => setLocalConfig({ ...localConfig, repo: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
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
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
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
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
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
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Languages className="w-4 h-4" /> {t('settings.language')}
            </label>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none appearance-none"
            >
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} {t('settings.theme')}
            </label>
            <div className="flex bg-muted/50 p-1 rounded-md border">
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
