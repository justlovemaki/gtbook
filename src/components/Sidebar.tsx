import React from 'react';
import { useStore } from '../store/useStore';
import { FileText, Settings as SettingsIcon, Github } from 'lucide-react';
import { clsx } from 'clsx';
import type { FavoriteFile } from '../lib/types';

export const Sidebar: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { files, activeFileIndex, setActiveFileIndex, isLoading } = useStore();

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-2 font-semibold text-primary">
        <Github className="w-5 h-5" />
        <span>MGR Reader</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Categories
        </div>
        {files.length === 0 && !isLoading && (
          <div className="px-3 py-4 text-sm text-muted-foreground italic">
            No files loaded. Connect in settings.
          </div>
        )}
        {files.map((file: FavoriteFile, index: number) => (
          <button
            key={file.path}
            onClick={() => setActiveFileIndex(index)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
              activeFileIndex === index 
                ? "bg-primary text-primary-foreground font-medium shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileText className="w-4 h-4" />
            <span className="truncate">{file.filename.replace(/^\d+-/, '').replace('.md', '')}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};
