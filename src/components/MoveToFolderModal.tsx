import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Folder, FileText, ChevronRight, Hash, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Bookmark, Directory } from '../lib/types';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (target: { filename: string; path: string; fileIndex: number; title: string; insertBefore?: { title: string; url: string | 'dir' } }) => void;
  itemTitle: string;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({ isOpen, onClose, onSelect, itemTitle }) => {
  const { t } = useTranslation();
  const { files } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<{ filename: string; path: string; fileIndex: number; title: string; children: (Bookmark | Directory)[] } | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedFolder(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const allFolders = useMemo(() => {
    const folders: { filename: string; path: string; fileIndex: number; title: string; children: (Bookmark | Directory)[] }[] = [];
    files.forEach((f, fIdx) => {
      const traverse = (items: (Bookmark | Directory)[]) => {
        items.forEach(it => {
          if ('children' in it) {
            if (it.title !== itemTitle) {
              folders.push({ filename: f.filename, path: f.path, fileIndex: fIdx, title: it.title, children: it.children });
              traverse(it.children);
            }
          }
        });
      };
      folders.push({ filename: f.filename, path: f.path, fileIndex: fIdx, title: 'root', children: f.tree });
      traverse(f.tree);
    });
    return folders;
  }, [files, itemTitle]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return allFolders;
    const query = searchQuery.toLowerCase();
    return allFolders.filter(f => 
      f.title.toLowerCase().includes(query) || 
      f.filename.toLowerCase().includes(query)
    );
  }, [allFolders, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-primary" />
            {selectedFolder ? `${t('bookmark.moveToFolder')}: ${selectedFolder.title === 'root' ? t('nav.root') : selectedFolder.title}` : t('bookmark.selectTargetFolder')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selectedFolder ? (
          <>
            <div className="p-4 border-b bg-muted/30">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  placeholder={t('bookmark.searchFolders')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredFolders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground italic text-sm">
                  {t('bookmark.noMatchingBookmarks')}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFolders.map((folder, idx) => (
                    <button
                      key={`${folder.path}-${folder.title}-${idx}`}
                      onClick={() => setSelectedFolder(folder)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all group text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold truncate">{folder.title === 'root' ? t('nav.root') : folder.title}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground opacity-60 font-black uppercase tracking-widest mt-0.5">
                            <FileText className="w-3 h-3" />
                            <span className="truncate">{folder.filename}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <button 
                onClick={() => setSelectedFolder(null)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                ← {t('bookmark.backToFolders')}
              </button>
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">{t('bookmark.movePrecise')}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button
                onClick={() => onSelect(selectedFolder)}
                className="w-full p-3 rounded-lg border-2 border-dashed border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-bold text-primary flex items-center justify-center gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                {t('bookmark.insertAtEnd')}
              </button>

              {selectedFolder.children.length > 0 && (
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black">
                    <span className="bg-card px-2 text-muted-foreground">{t('bookmark.insertBefore')}:</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {selectedFolder.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelect({ ...selectedFolder, insertBefore: { title: child.title, url: 'children' in child ? 'dir' : child.url } })}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors text-left"
                  >
                    <div className="shrink-0">
                      {'children' in child ? <Folder className="w-3.5 h-3.5 text-primary/60" /> : <Hash className="w-3.5 h-3.5 text-muted-foreground/60" />}
                    </div>
                    <span className="text-xs truncate opacity-70">{child.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="p-3 bg-muted/10 border-t text-[10px] text-center text-muted-foreground font-medium">
          {t('bookmark.movingItem', { name: itemTitle })}
        </div>
      </div>
    </div>
  );
};
