import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { AppConfig } from '../lib/types';
import { X, Save, Key, Github, FolderOpen, Settings as SettingsIcon } from 'lucide-react';

export const Settings: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useStore();
  const [localConfig, setLocalConfig] = useState<AppConfig>(
    config || { githubToken: '', owner: '', repo: '', path: '', openaiKey: '' }
  );

  if (!isOpen) return null;

  const handleSave = () => {
    setConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Configuration
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Github className="w-4 h-4" /> GitHub PAT
            </label>
            <input
              type="password"
              placeholder="ghp_..."
              value={localConfig.githubToken}
              onChange={(e) => setLocalConfig({ ...localConfig, githubToken: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Repo Owner</label>
              <input
                type="text"
                placeholder="username"
                value={localConfig.owner}
                onChange={(e) => setLocalConfig({ ...localConfig, owner: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Repo Name</label>
              <input
                type="text"
                placeholder="my-favorites"
                value={localConfig.repo}
                onChange={(e) => setLocalConfig({ ...localConfig, repo: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Base Directory
            </label>
            <input
              type="text"
              placeholder="data/bookmarks"
              value={localConfig.path}
              onChange={(e) => setLocalConfig({ ...localConfig, path: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="w-4 h-4" /> OpenAI API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={localConfig.openaiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
