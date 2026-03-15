import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { AppConfig, FavoriteFile } from '../lib/types';
import { parseMarkdown } from '../lib/markdown';

// Custom storage for IndexedDB using idb-keyval
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface AppState {
  config: AppConfig | null;
  files: FavoriteFile[];
  activeFileIndex: number;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  selectedUrl: string | null;
  readerMode: boolean;
  showSource: boolean;
  viewMode: 'reader' | 'navigation';
  theme: 'light' | 'dark' | 'system';
  mobileActivePane: 'files' | 'bookmarks' | 'content';
  _hasHydrated: boolean;
  pendingChanges: { path: string; content: string; sha: string }[];
  setHasHydrated: (state: boolean) => void;
  addPendingChange: (change: { path: string; content: string; sha: string }, force?: boolean) => void;
  clearPendingChanges: () => void;
  setConfig: (config: AppConfig) => void;
  setFiles: (files: FavoriteFile[], isCloud?: boolean) => void;
  setActiveFileIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastFetched: (timestamp: number) => void;
  setSelectedUrl: (url: string | null) => void;
  setReaderMode: (enabled: boolean) => void;
  setShowSource: (enabled: boolean) => void;
  setViewMode: (mode: 'reader' | 'navigation') => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMobileActivePane: (pane: 'files' | 'bookmarks' | 'content') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addFile: (file: FavoriteFile) => void;
  removeFile: (path: string) => void;
  updateFile: (path: string, updates: Partial<FavoriteFile>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      config: null,
      files: [],
      activeFileIndex: 0,
      isLoading: false,
      error: null,
      lastFetched: null,
      selectedUrl: null,
      readerMode: false,
      showSource: false,
      viewMode: 'navigation',
      theme: (import.meta.env.VITE_DEFAULT_THEME as any) || 'system',
      mobileActivePane: 'files',
      searchQuery: '',
      _hasHydrated: false,
      pendingChanges: [],
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      addPendingChange: (change, force = false) => set((state) => {
        // Find if this file already exists in current files and has same content
        const existingFile = state.files.find(f => f.path === change.path);
        if (!force && existingFile && existingFile.content === change.content) {
          // If content is same as current file, remove from pending instead of adding
          return {
            pendingChanges: state.pendingChanges.filter(c => c.path !== change.path)
          };
        }
        return { 
          pendingChanges: [...state.pendingChanges.filter(c => c.path !== change.path), change] 
        };
      }),
      clearPendingChanges: () => set({ pendingChanges: [] }),
      setConfig: (config: AppConfig) => set({ config }),
      setFiles: (newFiles, isCloud = false) => set((state) => {
        const mergedFiles = isCloud 
          ? newFiles.map(file => {
              const change = state.pendingChanges.find(c => c.path === file.path);
              if (change) {
                // Check if the pending change content is actually different from the new remote content
                if (change.content === file.content) {
                  return file;
                }
                return { 
                  ...file, 
                  content: change.content, 
                  tree: parseMarkdown(change.content) 
                };
              }
              return file;
            })
          : newFiles;

        // Clean up pending changes that are now identical to remote
        // ONLY if this update comes from the cloud source of truth
        let filteredPending = state.pendingChanges;
        if (isCloud) {
          filteredPending = state.pendingChanges.filter(change => {
            const remoteFile = newFiles.find(f => f.path === change.path);
            return !remoteFile || remoteFile.content !== change.content;
          });
        }

        return { 
          files: mergedFiles,
          pendingChanges: filteredPending
        };
      }),
      setActiveFileIndex: (index: number) => set({ activeFileIndex: index, mobileActivePane: 'bookmarks' }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setLastFetched: (timestamp) => set({ lastFetched: timestamp }),
      setSelectedUrl: (url) => set({ selectedUrl: url, mobileActivePane: 'content' }),
      setReaderMode: (enabled) => set({ readerMode: enabled }),
      setShowSource: (enabled) => set({ showSource: enabled }),
      setViewMode: (viewMode) => set({ viewMode }),
      setTheme: (theme) => set({ theme }),
      setMobileActivePane: (mobileActivePane) => set({ mobileActivePane }),
      addFile: (file) => set((state) => ({ 
        files: [...state.files, file].sort((a, b) => a.filename.localeCompare(b.filename)) 
      })),
      removeFile: (path) => set((state) => ({ 
        files: state.files.filter(f => f.path !== path) 
      })),
      updateFile: (path, updates) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, ...updates } : f)
      })),
    }),
    {
      name: 'github-favorites-storage',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: (state) => {
        return () => state.setHasHydrated(true);
      },
      partialize: (state: AppState) => ({ 
        config: state.config, 
        files: state.files,
        lastFetched: state.lastFetched,
        readerMode: state.readerMode,
        showSource: state.showSource,
        viewMode: state.viewMode,
        theme: state.theme,
        mobileActivePane: state.mobileActivePane,
        pendingChanges: state.pendingChanges
      }),
    }
  )
);


