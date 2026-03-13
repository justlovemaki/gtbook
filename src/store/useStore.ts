import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppConfig, FavoriteFile } from '../lib/types';

interface AppState {
  config: AppConfig | null;
  files: FavoriteFile[];
  activeFileIndex: number;
  isLoading: boolean;
  error: string | null;
  setConfig: (config: AppConfig) => void;
  setFiles: (files: FavoriteFile[]) => void;
  setActiveFileIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      config: null,
      files: [],
      activeFileIndex: 0,
      isLoading: false,
      error: null,
      setConfig: (config: AppConfig) => set({ config }),
      setFiles: (files: FavoriteFile[]) => set({ files }),
      setActiveFileIndex: (index: number) => set({ activeFileIndex: index }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'github-favorites-storage',
      partialize: (state: AppState) => ({ config: state.config }),
    }
  )
);
