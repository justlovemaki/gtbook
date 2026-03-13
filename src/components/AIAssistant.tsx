import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, Loader2, Send, Check, AlertCircle } from 'lucide-react';
import { OpenAI } from 'openai';
import { GitHubService } from '../lib/github';
import { stringifyMarkdown } from '../lib/markdown';
import type { FavoriteFile, Bookmark, Directory } from '../lib/types';

export const AIAssistant: React.FC = () => {
  const { config, files, setFiles } = useStore();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'confirming' | 'success' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<{ file: string; dir: string; title: string; reason: string } | null>(null);

  if (!config) return null;

  const handleAnalyze = async () => {
    if (!config || !url) return;
    setStatus('analyzing');

    try {
      const openai = new OpenAI({ apiKey: config.openaiKey, dangerouslyAllowBrowser: true });
      
      const fileContext = files.map((f: FavoriteFile) => ({
        filename: f.filename,
        dirs: f.tree.filter((i: Bookmark | Directory) => 'children' in i).map((i: any) => i.title)
      }));

      const prompt = `You are a bookmark organizer. 
Current files and categories: ${JSON.stringify(fileContext)}
Target URL: ${url}

Analyze the URL and suggest where to save it. Return ONLY JSON:
{
  "file": "filename from list",
  "dir": "directory name from file or 'root'",
  "title": "Clean page title",
  "reason": "short reason"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      setSuggestion(result);
      setStatus('confirming');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const handleConfirm = async () => {
    if (!config || !suggestion || !files.length) return;
    setStatus('analyzing'); // reuse as loading state

    try {
      const fileIndex = files.findIndex((f: FavoriteFile) => f.filename === suggestion.file);
      if (fileIndex === -1) throw new Error("File not found");

      const file = files[fileIndex];
      const newFiles = [...files];
      
      // Update local tree
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: suggestion.title,
        url: url,
        level: suggestion.dir === 'root' ? 1 : 2
      };

      if (suggestion.dir === 'root') {
        file.tree.push(newItem);
      } else {
        const dir = file.tree.find((i: Bookmark | Directory) => 'children' in i && i.title === suggestion.dir) as any;
        if (dir) dir.children.push(newItem);
        else file.tree.push(newItem);
      }

      const newContent = stringifyMarkdown(file.tree);
      const github = new GitHubService(config);
      const newSha = await github.updateFile(file, newContent);

      newFiles[fileIndex] = { ...file, content: newContent, sha: newSha };
      setFiles(newFiles);
      
      setStatus('success');
      setUrl('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="bg-card border rounded-xl shadow-xl p-4 w-80 overflow-hidden transition-all">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Organizer</h3>
        </div>

        {status === 'idle' || status === 'analyzing' || status === 'error' ? (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Paste URL to organize..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={status === 'analyzing'}
                className="w-full pl-3 pr-10 py-2 bg-muted/50 border rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleAnalyze}
                disabled={status === 'analyzing' || !url}
                className="absolute right-2 top-1.5 text-primary disabled:text-muted-foreground"
              >
                {status === 'analyzing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            {status === 'error' && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Failed to process URL.
              </div>
            )}
          </div>
        ) : status === 'confirming' && suggestion ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-muted/50 p-3 rounded-md border border-dashed text-xs space-y-2">
              <p><strong>Title:</strong> {suggestion.title}</p>
              <p><strong>File:</strong> {suggestion.file}</p>
              <p><strong>Path:</strong> {suggestion.dir}</p>
              <p className="italic text-muted-foreground mt-1">"{suggestion.reason}"</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('idle')}
                className="flex-1 py-1.5 border rounded-md text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-green-600 animate-in zoom-in">
            <Check className="w-8 h-8 mb-2" />
            <span className="text-xs font-medium">Added Successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
};
