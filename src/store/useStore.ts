import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { AppConfig, FavoriteFile } from '../lib/types';

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
  addPendingChange: (change: { path: string; content: string; sha: string }) => void;
  clearPendingChanges: () => void;
  setConfig: (config: AppConfig) => void;
  setFiles: (files: FavoriteFile[]) => void;
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
      theme: 'system',
      mobileActivePane: 'files',
      searchQuery: '',
      _hasHydrated: false,
      pendingChanges: [],
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      addPendingChange: (change) => set((state) => ({ 
        pendingChanges: [...state.pendingChanges.filter(c => c.path !== change.path), change] 
      })),
      clearPendingChanges: () => set({ pendingChanges: [] }),
      setConfig: (config: AppConfig) => set({ config }),
      setFiles: (files) => set({ files }),
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


