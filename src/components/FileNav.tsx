import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { toast } from '../store/useToast';
import { 
  FileText, 
  Settings as SettingsIcon, 
  Github, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  LayoutDashboard, 
  BookOpen,
  CloudUpload,
  Sparkles,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { clsx } from 'clsx';
import type { FavoriteFile } from '../lib/types';
import { GitHubService } from '../lib/github';
import { parseMarkdown } from '../lib/markdown';
import { safeExtractContent, repairMarkdownFormat } from '../lib/ai';

export const FileNav: React.FC<{ 
  onOpenSettings: () => void, 
  onRefresh: () => void 
}> = ({ onOpenSettings, onRefresh }) => {
  const { t } = useTranslation();
  const { 
    files, 
    activeFileIndex, 
    setActiveFileIndex, 
    isLoading, 
    config, 
    addFile, 
    removeFile, 
    updateFile, 
    viewMode, 
    setViewMode,
    pendingChanges,
    clearPendingChanges,
    setMobileActivePane,
    theme,
    setTheme
  } = useStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!config || pendingChanges.length === 0) return;
    setIsSyncing(true);
    toast.info(t('sync.syncing'));
    try {
      const github = new GitHubService(config);
      let currentFiles = [...files];

      for (const change of pendingChanges) {
        const file = currentFiles.find(f => f.path === change.path);
        if (file) {
          // Use force: true to automatically resolve SHA conflicts during batch sync
          const newSha = await github.updateFile({ ...file }, change.content, true);
          currentFiles = currentFiles.map(f => f.path === file.path ? { ...f, sha: newSha } : f);
        }
      }
      
      useStore.getState().setFiles(currentFiles, true);
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

  const handleAddFile = async () => {
    if (!config) return;
    const filename = window.prompt(t('fileNav.enterNewFilename'), "01-new-category.md");
    if (!filename) return;

    try {
      const github = new GitHubService(config);
      const newFile = await github.createFile(filename);
      addFile(newFile);
      toast.success(t('fileNav.createSuccess'));
    } catch (err: any) {
      toast.error(t('fileNav.createFailed'), err.message);
    }
  };

  const handleRefactor = async (file: FavoriteFile) => {
    if (!config || !window.confirm(t('ai.refactorConfirm'))) return;
    toast.info(t('ai.refactoring'));
    
    try {
      const github = new GitHubService(config);
      // Get latest content
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(file.path);
      
      const prompt = `### Role
You are a professional Information Architect specializing in knowledge organization.

### Task
Refactor the provided Markdown bookmark list into a logical, hierarchical structure. 
The output language for categories and structure MUST be: ${t('ai.reasonLanguage')}.

### CRITICAL RULE: NO DATA LOSS
1. You MUST PRESERVE EVERY SINGLE LINK from the original list.
2. DO NOT summarize, merge, or omit any URLs.
3. If a link doesn't fit into your new categories, place it in an "Others" or "Uncategorized" category.
4. The total count of [Title](url) items in your output MUST MATCH the input count.

### FORMAT RULES
1. Use ONLY asterisks (*) for hierarchy levels. 
2. Level 1: "* [Title](url)"
3. Level 2: "* * [Title](url)" (Space between asterisks)
4. Level 3: "* * * [Title](url)"
5. Folders/Categories MUST use the "(dir)" suffix: "* [Category Name](dir)"
6. NO SPACE INDENTATION. Use only the asterisk repetition pattern.
7. Output ONLY the resulting Markdown, no conversational text.

### Example of Valid Output
* [Development Tools](dir)
* * [GitHub](https://github.com)
* * [Stack Overflow](https://stackoverflow.com)
* [Reference](dir)
* * [MDN Web Docs](https://developer.mozilla.org)
* [Personal Blog](https://example.com)

### Content to Refactor
${currentRaw}`;

      const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiKey}` },
        body: JSON.stringify({
          model: config.openaiModel || "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      
      if (data.choices[0].finish_reason === 'length') {
        toast.error(t('ai.truncated'));
        return;
      }

      let newMarkdown = safeExtractContent(data.choices[0].message.content);
      
      if (!newMarkdown) throw new Error("AI returned empty content");

      // 自动修复格式：如果 AI 使用了空格缩进，将其转换为项目标准的星号缩进
      newMarkdown = repairMarkdownFormat(newMarkdown);

      // 校验书签数量，防止 AI 遗漏
      const linkRegex = /\[.*?\]\((?!dir\b).*?\)/g;
      const oldCount = (currentRaw.match(linkRegex) || []).length;
      const newCount = (newMarkdown.match(linkRegex) || []).length;

      if (newCount < oldCount) {
        if (!window.confirm(t('ai.lossWarning', { old: oldCount, new: newCount }))) {
          return;
        }
      }

      const newSha = await github.updateFile({ ...file, sha: latestSha }, newMarkdown);
      updateFile(file.path, { content: newMarkdown, sha: newSha, tree: parseMarkdown(newMarkdown) });
      toast.success(t('common.success'));
    } catch (err: any) {
      toast.error("Refactor failed", err.message);
    }
  };

  const handleRenameFile = async (e: React.MouseEvent, file: FavoriteFile) => {
    e.stopPropagation();
    if (!config) return;
    const newFilename = window.prompt(t('fileNav.enterNewName'), file.filename);
    if (!newFilename || newFilename === file.filename) return;

    try {
      const github = new GitHubService(config);
      const updatedFile = await github.renameFile(file, newFilename);
      updateFile(file.path, updatedFile);
      toast.success(t('fileNav.renameSuccess'));
    } catch (err: any) {
      toast.error(t('fileNav.renameFailed'), err.message);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, file: FavoriteFile) => {
    e.stopPropagation();
    if (!config) return;
    if (!window.confirm(t('fileNav.confirmDelete', { name: file.filename }))) return;

    try {
      const github = new GitHubService(config);
      await github.deleteFile(file);
      removeFile(file.path);
      toast.success(t('fileNav.deleteSuccess'));
    } catch (err: any) {
      toast.error(t('fileNav.deleteFailed'), err.message);
    }
  };

  return (
    <div className="w-full md:w-48 border-r bg-muted/50 flex flex-col h-full shrink-0">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setMobileActivePane('bookmarks'); }}
            className="md:hidden p-1.5 hover:bg-background rounded-lg text-primary transition-colors -ml-1"
            title={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
          <Github className="w-5 h-5 text-primary shrink-0" />
        </div>
        <div className="flex items-center gap-1">
          {import.meta.env.VITE_PUBLIC_MODE !== 'true' && (
            <>
              <button 
                onClick={handleAddFile}
                className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                title={t('fileNav.addCategory')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1 hover:bg-background rounded text-muted-foreground transition-colors"
                title={t('fileNav.refreshAll')}
              >
                <RefreshCw className={clsx("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </button>
              {pendingChanges.length > 0 && (
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="p-1 hover:bg-background rounded text-amber-500 animate-pulse transition-colors flex items-center gap-1"
                  title={t('sync.offlineSyncButton')}
                >
                  <CloudUpload className={clsx("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                  <span className="text-[10px] font-black">{pendingChanges.length}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.map((file: FavoriteFile, index: number) => (
          <div
            key={file.path}
            onClick={() => setActiveFileIndex(index)}
            className={clsx(
              "group w-full flex items-center justify-between px-2 py-2 rounded-md transition-all cursor-pointer select-none",
              activeFileIndex === index 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate text-xs font-medium block">
                {file.filename.replace(/^\d+-/, '').replace('.md', '')}
              </span>
            </div>
            
            <div className="hidden group-hover:flex items-center gap-0.5 ml-1 shrink-0">
              {import.meta.env.VITE_PUBLIC_MODE !== 'true' && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRefactor(file); }}
                    className={clsx(
                      "p-1 rounded transition-colors",
                      activeFileIndex === index 
                        ? "hover:bg-white/20 text-white" 
                        : "hover:bg-black/10 text-primary"
                    )}
                    title={t('ai.refactorMode')}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={(e) => handleRenameFile(e, file)}
                    className={clsx(
                      "p-1 rounded transition-colors",
                      activeFileIndex === index ? "hover:bg-white/20 text-white" : "hover:bg-black/10"
                    )}
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteFile(e, file)}
                    className={clsx(
                      "p-1 rounded transition-colors",
                      activeFileIndex === index ? "hover:bg-white/20 text-white" : "hover:bg-black/10 hover:text-destructive"
                    )}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t space-y-1">
        {import.meta.env.VITE_PUBLIC_MODE !== 'true' && (
          <button
            onClick={() => setViewMode(viewMode === 'reader' ? 'navigation' : 'reader')}
            className="w-full flex items-center justify-start gap-2 px-2 py-2 text-primary hover:bg-primary/10 rounded-md transition-colors font-semibold"
            title={viewMode === 'reader' ? t('fileNav.navigation') : t('fileNav.reader')}
          >
            {viewMode === 'reader' ? (
              <LayoutDashboard className="w-4 h-4 shrink-0" />
            ) : (
              <BookOpen className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs block">
              {viewMode === 'reader' ? t('fileNav.navigation') : t('fileNav.reader')}
            </span>
          </button>
        )}
        
        {import.meta.env.VITE_PUBLIC_MODE !== 'true' ? (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-start gap-2 px-2 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span className="text-xs block">{t('common.settings')}</span>
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-start gap-2 px-2 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
            title={theme === 'dark' ? t('settings.light') : t('settings.dark')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            <span className="text-xs block">{theme === 'dark' ? t('settings.light') : t('settings.dark')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
