import React from 'react';
import { useStore } from '../store/useStore';
import { 
  FileText, 
  Settings as SettingsIcon, 
  Github, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  LayoutDashboard, 
  BookOpen 
} from 'lucide-react';
import { clsx } from 'clsx';
import type { FavoriteFile } from '../lib/types';
import { GitHubService } from '../lib/github';

export const FileNav: React.FC<{ 
  onOpenSettings: () => void, 
  onRefresh: () => void 
}> = ({ onOpenSettings, onRefresh }) => {
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
    setViewMode 
  } = useStore();

  const handleAddFile = async () => {
    if (!config) return;
    const filename = window.prompt("Enter new filename (needs .md suffix):", "01-new-category.md");
    if (!filename) return;

    try {
      const github = new GitHubService(config);
      const newFile = await github.createFile(filename);
      addFile(newFile);
    } catch (err: any) {
      alert("Create failed: " + err.message);
    }
  };

  const handleRenameFile = async (e: React.MouseEvent, file: FavoriteFile) => {
    e.stopPropagation();
    if (!config) return;
    const newFilename = window.prompt("Enter new filename:", file.filename);
    if (!newFilename || newFilename === file.filename) return;

    try {
      const github = new GitHubService(config);
      const updatedFile = await github.renameFile(file, newFilename);
      updateFile(file.path, updatedFile);
    } catch (err: any) {
      alert("Rename failed: " + err.message);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, file: FavoriteFile) => {
    e.stopPropagation();
    if (!config) return;
    if (!window.confirm(`Are you sure you want to permanently delete category file "${file.filename}"?`)) return;

    try {
      const github = new GitHubService(config);
      await github.deleteFile(file);
      removeFile(file.path);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="w-full md:w-48 border-r bg-muted/50 flex flex-col h-full shrink-0">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Github className="w-5 h-5 text-primary shrink-0" />
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleAddFile}
            className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
            title="Add Category"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-background rounded text-muted-foreground transition-colors"
            title="Refresh All"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </button>
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
              <button 
                onClick={(e) => handleRenameFile(e, file)}
                className="p-1 hover:bg-black/10 rounded transition-colors"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
              <button 
                onClick={(e) => handleDeleteFile(e, file)}
                className="p-1 hover:bg-black/10 rounded transition-colors hover:text-destructive"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t space-y-1">
        <button
          onClick={() => setViewMode(viewMode === 'reader' ? 'navigation' : 'reader')}
          className="w-full flex items-center justify-start gap-2 px-2 py-2 text-primary hover:bg-primary/10 rounded-md transition-colors font-semibold"
          title={viewMode === 'reader' ? "Switch to Navigation Mode" : "Switch to Reader Mode"}
        >
          {viewMode === 'reader' ? (
            <LayoutDashboard className="w-4 h-4 shrink-0" />
          ) : (
            <BookOpen className="w-4 h-4 shrink-0" />
          )}
          <span className="text-xs block">
            {viewMode === 'reader' ? "Navigation" : "Reader"}
          </span>
        </button>
        
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-start gap-2 px-2 py-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
        >
          <SettingsIcon className="w-4 h-4 shrink-0" />
          <span className="text-xs block">Settings</span>
        </button>
      </div>
    </div>
  );
};
