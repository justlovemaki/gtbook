import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  Link as LinkIcon, 
  Hash, 
  Search, 
  X, 
  FileText, 
  ChevronRight as BreadcrumbSeparator, 
  Edit2, 
  Trash2,
  Copy,
  CheckCircle2,
  FolderPlus,
  Plus,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Bookmark, Directory } from '../lib/types';
import { GitHubService } from '../lib/github';
import { updateBookmarkInMarkdown, deleteFromMarkdown, parseMarkdown, insertDirectoryToMarkdown, renameDirectoryInMarkdown, deleteDirectoryFromMarkdown, insertLinkToMarkdown } from '../lib/markdown';

interface SearchResult {
  title: string;
  url: string;
  filename: string;
  fileIndex: number;
  path: string[];
}

const TreeNode: React.FC<{ item: Bookmark | Directory; depth: number; filename: string; fileIndex: number }> = ({ item, depth, filename, fileIndex }) => {
  const { selectedUrl, setSelectedUrl, config, files, setFiles } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDir = 'children' in item;

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      setSelectedUrl(item.url);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) return;
    navigator.clipboard.writeText((item as Bookmark).url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config) return;

    if (isDir) {
      const newTitle = window.prompt("Enter new name:", item.title);
      if (!newTitle || newTitle === item.title) return;

      try {
        const github = new GitHubService(config);
        const targetFile = files[fileIndex];
        const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
        const updatedRaw = renameDirectoryInMarkdown(currentRaw, item.title, newTitle);
        const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
        
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...targetFile,
          content: updatedRaw,
          sha: newSha,
          tree: parseMarkdown(updatedRaw)
        };
        setFiles(updatedFiles);
      } catch (err: any) {
        alert("Rename failed: " + err.message);
      }
    } else {
      const bookmark = item as Bookmark;
      const newTitle = window.prompt("Enter new name:", bookmark.title);
      if (newTitle === null) return;
      const newUrl = window.prompt("Enter new URL:", bookmark.url);
      if (newUrl === null) return;
      
      if (newTitle === bookmark.title && newUrl === bookmark.url) return;

      try {
        const github = new GitHubService(config);
        const targetFile = files[fileIndex];
        const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
        const updatedRaw = updateBookmarkInMarkdown(currentRaw, bookmark.title, newTitle || bookmark.title, bookmark.url, newUrl || bookmark.url);
        const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
        
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...targetFile,
          content: updatedRaw,
          sha: newSha,
          tree: parseMarkdown(updatedRaw)
        };
        setFiles(updatedFiles);
        if (selectedUrl === bookmark.url) setSelectedUrl(newUrl || bookmark.url);
      } catch (err: any) {
        alert("Update failed: " + err.message);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config) return;

    const confirmMsg = isDir 
      ? `Are you sure you want to delete folder "${item.title}" and all its contents?` 
      : `Are you sure you want to delete bookmark "${item.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const github = new GitHubService(config);
      const targetFile = files[fileIndex];
      
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
      
      let updatedRaw = '';
      if (isDir) {
        updatedRaw = deleteDirectoryFromMarkdown(currentRaw, item.title);
      } else {
        updatedRaw = deleteFromMarkdown(currentRaw, item.title, (item as Bookmark).url);
      }
      
      const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
      
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = {
        ...targetFile,
        content: updatedRaw,
        sha: newSha,
        tree: parseMarkdown(updatedRaw)
      };
      setFiles(updatedFiles);
      if (!isDir && selectedUrl === (item as Bookmark).url) setSelectedUrl(null);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleAddSubDir = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config || !isDir) return;

    const title = window.prompt(`Create new folder under "${item.title}":`);
    if (!title) return;

    try {
      const github = new GitHubService(config);
      const targetFile = files[fileIndex];
      
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
      const updatedRaw = insertDirectoryToMarkdown(currentRaw, item.title, title);
      
      const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
      
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = {
        ...targetFile,
        content: updatedRaw,
        sha: newSha,
        tree: parseMarkdown(updatedRaw)
      };
      setFiles(updatedFiles);
      setIsOpen(true);
    } catch (err: any) {
      alert("Create failed: " + err.message);
    }
  };

  const handleAddBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config || !isDir) return;

    const title = window.prompt("Enter bookmark title:");
    if (!title) return;
    const url = window.prompt("Enter URL:", "https://");
    if (!url) return;

    try {
      const github = new GitHubService(config);
      const targetFile = files[fileIndex];
      
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
      const updatedRaw = insertLinkToMarkdown(currentRaw, item.title, title, url);
      
      const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
      
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = {
        ...targetFile,
        content: updatedRaw,
        sha: newSha,
        tree: parseMarkdown(updatedRaw)
      };
      setFiles(updatedFiles);
      setIsOpen(true);
    } catch (err: any) {
      alert("Add failed: " + err.message);
    }
  };

  const isSelected = !isDir && selectedUrl === item.url;

  return (
    <div 
      className="select-none group/item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={handleClick}
        className={clsx(
          "flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm",
          isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
          isDir && "font-semibold text-foreground/80"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {isDir ? (
            <>
              {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              <Folder className={clsx("w-4 h-4 shrink-0", isOpen ? "text-primary/70" : "text-muted-foreground/70")} />
              <span className="truncate">{item.title}</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span className="truncate">{item.title}</span>
            </>
          )}
        </div>

        {(isHovered || isSelected) && (
          <div className="flex items-center gap-1 shrink-0">
            {isDir && (
              <>
                <button 
                  onClick={handleAddBookmark}
                  className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                  title="Add Bookmark"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button 
                  onClick={handleAddSubDir}
                  className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                  title="New Folder"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            {!isDir && (
              <button 
                onClick={handleCopy}
                className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                title="Copy Link"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
            <button 
              onClick={handleRename}
              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button 
              onClick={handleDelete}
              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isDir && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {item.children.map((child) => (
              <TreeNode key={child.id} item={child} depth={depth + 1} filename={filename} fileIndex={fileIndex} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const BookmarkTree: React.FC = () => {
  const { files, activeFileIndex, setActiveFileIndex, isLoading, selectedUrl, setSelectedUrl, config, setFiles, setMobileActivePane } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const activeFile = files[activeFileIndex];

  const handleAddRootDir = async () => {
    if (!config || !activeFile) return;

    const title = window.prompt("Enter new folder name at root:");
    if (!title) return;

    try {
      const github = new GitHubService(config);
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(activeFile.path);
      const updatedRaw = insertDirectoryToMarkdown(currentRaw, 'root', title);
      
      const newSha = await github.updateFile({ ...activeFile, sha: latestSha }, updatedRaw);
      
      const updatedFiles = [...files];
      updatedFiles[activeFileIndex] = {
        ...activeFile,
        content: updatedRaw,
        sha: newSha,
        tree: parseMarkdown(updatedRaw)
      };
      setFiles(updatedFiles);
    } catch (err: any) {
      alert("Create failed: " + err.message);
    }
  };

  const handleRefreshCurrent = async () => {
    if (!config || !activeFile) return;
    try {
      const github = new GitHubService(config);
      const updatedFile = await github.fetchFileByPath(activeFile.path);
      const updatedFiles = [...files];
      updatedFiles[activeFileIndex] = updatedFile;
      setFiles(updatedFiles);
    } catch (err: any) {
      alert("Refresh failed: " + err.message);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    files.forEach((file, fIndex) => {
      const traverse = (items: (Bookmark | Directory)[], currentPath: string[]) => {
        items.forEach(item => {
          if ('children' in item) {
            traverse(item.children, [...currentPath, item.title]);
          } else {
            if (item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query)) {
              results.push({
                title: item.title,
                url: item.url,
                filename: file.filename,
                fileIndex: fIndex,
                path: currentPath
              });
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
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background/50 border-r relative">
      {/* Mobile Header with Back Button */}
      <div className="md:hidden flex items-center gap-2 p-3 border-b bg-muted/30">
        <button 
          onClick={() => setMobileActivePane('files')}
          className="p-1.5 hover:bg-background rounded-lg transition-colors text-primary"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-foreground">
          {activeFile?.filename.replace(/^\d+-/, '').replace('.md', '') || 'Bookmarks'}
        </span>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-muted/50 border rounded-md text-xs focus:ring-1 focus:ring-primary outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Search Results ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground italic text-center">
                No matching bookmarks found
              </div>
            ) : (
              searchResults.map((result, idx) => (
                <div
                  key={`${result.url}-${idx}`}
                  onClick={() => {
                    setActiveFileIndex(result.fileIndex);
                    setSelectedUrl(result.url);
                  }}
                  className={clsx(
                    "p-2 rounded-md cursor-pointer transition-colors border border-transparent",
                    selectedUrl === result.url ? "bg-accent text-accent-foreground border-border" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="text-sm font-medium text-foreground truncate mb-1">
                    {result.title}
                  </div>
                  
                  {/* Metadata: File and Path */}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] opacity-70">
                    <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded border">
                      <FileText className="w-2.5 h-2.5" />
                      {result.filename.replace(/^\d+-/, '').replace('.md', '')}
                    </div>
                    {result.path.length > 0 && (
                      <div className="flex items-center gap-1">
                        <BreadcrumbSeparator className="w-2.5 h-2.5" />
                        <div className="flex items-center gap-1">
                          {result.path.join(' > ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                {activeFile?.filename.replace(/^\d+-/, '').replace('.md', '') || 'No File Selected'}
              </h2>
              <div className="flex items-center gap-1">
                {activeFile && (
                  <button 
                    onClick={handleAddRootDir}
                    className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                    title="New Root Folder"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={handleRefreshCurrent}
                  className="p-1 hover:bg-background rounded text-muted-foreground hover:text-primary transition-colors"
                  title="Refresh Current File"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="p-2">
              {!activeFile ? (
                <div className="p-4 text-xs text-muted-foreground italic text-center mt-10">
                  Please select a file to view bookmarks
                </div>
              ) : activeFile.tree.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground italic text-center">
                  This file is empty
                </div>
              ) : (
                activeFile.tree.map((item) => (
                  <TreeNode 
                    key={item.id} 
                    item={item} 
                    depth={0} 
                    filename={activeFile.filename} 
                    fileIndex={activeFileIndex} 
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
