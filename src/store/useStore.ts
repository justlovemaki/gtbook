import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppConfig, FavoriteFile } from '../lib/types';

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
  mobileActivePane: 'files' | 'bookmarks' | 'content';
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
  setMobileActivePane: (pane: 'files' | 'bookmarks' | 'content') => void;
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
      mobileActivePane: 'files',
      setConfig: (config: AppConfig) => set({ config }),
      setFiles: (files) => set({ files }),
      setActiveFileIndex: (index) => set({ activeFileIndex: index, mobileActivePane: 'bookmarks' }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setLastFetched: (timestamp) => set({ lastFetched: timestamp }),
      setSelectedUrl: (url) => set({ selectedUrl: url, mobileActivePane: 'content' }),
      setReaderMode: (enabled) => set({ readerMode: enabled }),
      setShowSource: (enabled) => set({ showSource: enabled }),
      setViewMode: (viewMode) => set({ viewMode }),
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
      partialize: (state: AppState) => ({ 
        config: state.config, 
        files: state.files,
        lastFetched: state.lastFetched,
        readerMode: state.readerMode,
        showSource: state.showSource,
        viewMode: state.viewMode,
        mobileActivePane: state.mobileActivePane
      }),
    }
  )
);

