import React from 'react';
import { useStore } from '../store/useStore';
import { ExternalLink, Folder, Hash } from 'lucide-react';
import type { Bookmark, Directory } from '../lib/types';

export const Reader: React.FC = () => {
  const { files, activeFileIndex, isLoading } = useStore();
  const activeFile = files[activeFileIndex];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Hash className="w-12 h-12 mb-4 opacity-20" />
        <h2 className="text-xl font-medium text-foreground">No File Selected</h2>
        <p className="max-w-xs text-center mt-2">
          Select a markdown file from the sidebar to view your favorites.
        </p>
      </div>
    );
  }

  const renderItem = (item: Bookmark | Directory, depth: number = 0): React.ReactNode => {
    const isDir = 'children' in item;

    if (isDir) {
      return (
        <div key={item.id} className="mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary/80 mb-2 mt-4 uppercase tracking-tight">
            <Folder className="w-4 h-4" />
            <span>{item.title}</span>
          </div>
          <div className="space-y-1">
            {item.children.map((child: Bookmark | Directory) => renderItem(child, depth + 1))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="group flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-all border border-transparent hover:border-border"
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-md">
            {item.title}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-sm">
            {item.url}
          </span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-background rounded-md shadow-none hover:shadow-sm border border-transparent hover:border-border transition-all"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <header className="mb-10 border-b pb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {activeFile.filename.replace(/^\d+-/, '').replace('.md', '')}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <Hash className="w-4 h-4" />
            {activeFile.path}
          </p>
        </header>

        <div className="space-y-4">
          {activeFile.tree.map(item => renderItem(item))}
        </div>
      </div>
    </div>
  );
};
