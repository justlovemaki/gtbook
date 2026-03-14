import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, Loader2, Send, Check, AlertCircle, Minimize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GitHubService } from '../lib/github';
import { insertLinkToMarkdown, parseMarkdown } from '../lib/markdown';
import type { FavoriteFile, Bookmark, Directory } from '../lib/types';

export const AIAssistant: React.FC = () => {
  const { config, files, setFiles } = useStore();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'confirming' | 'success' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<{ file: string; dir: string; title: string; reason: string } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Default to minimized on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMinimized(true);
    }
  }, []);

  if (!config) return null;

  const getAllDirPaths = (items: (Bookmark | Directory)[], parentPath: string = ''): string[] => {
    let paths: string[] = [];
    for (const item of items) {
      if ('children' in item) {
        const currentPath = parentPath ? `${parentPath} > ${item.title}` : item.title;
        paths.push(currentPath);
        paths.push(...getAllDirPaths(item.children, currentPath));
      }
    }
    return paths;
  };

  const handleAnalyze = async () => {
    if (!config || !url) return;
    if (files.length === 0) {
      alert("Please connect to GitHub repository and ensure Markdown files are loaded.");
      return;
    }
    setStatus('analyzing');

    try {
      const fileContext = files.map((f: FavoriteFile) => ({
        filename: f.filename,
        dirs: getAllDirPaths(f.tree)
      }));

      const prompt = `You are a professional bookmark organizer assistant.
You must categorize the link into the existing structure.

### Optional file list (file must be selected from this list):
${files.map(f => f.filename).join(', ')}

### Directory structure within each file (dir must be a directory title or "root"):
${JSON.stringify(fileContext, null, 2)}

### Task:
Analyze link: ${url}
1. Select the most suitable 'file' from the provided file list.
2. Select the most suitable 'dir' within that file (provide only the directory title, e.g., "Website", or "root" if it belongs to the root).
3. Generate a concise 'title'.
4. Give the 'reason' in English.

IMPORTANT: The returned content must be strictly valid JSON format. If the reason contains double quotes, be sure to escape them with backslashes (e.g., \"content\").

Return JSON format:
{
  "file": "must be a filename from the list",
  "dir": "must be an existing directory title or root",
  "title": "Webpage title",
  "reason": "Recommendation reason"
}`;

      const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content || '{}';
      
      // Clean up potential markdown formatting and handles malformed JSON from some LLMs
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      
      // Attempt to fix common JSON errors like unescaped quotes in strings (heuristic)
      // This is risky but helps with common LLM failure modes
      try {
        const result = JSON.parse(content);
        setSuggestion(result);
        setStatus('confirming');
      } catch (e) {
        console.error("JSON Parse failed, attempting cleanup:", e);
        const cleanedContent = content.replace(/("reason":\s*")(.+?)("\s*})/s, (_match: string, p1: string, p2: string, p3: string) => {
           return p1 + p2.replace(/"/g, '\\"') + p3;
        });
        const result = JSON.parse(cleanedContent);
        setSuggestion(result);
        setStatus('confirming');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const handleConfirm = async () => {
    if (!config || !suggestion || !files.length) return;
    setStatus('analyzing');

    try {
      const fileIndex = files.findIndex((f: FavoriteFile) => f.filename === suggestion.file);
      if (fileIndex === -1) throw new Error("Target file not found");

      const targetFile = files[fileIndex];
      const github = new GitHubService(config);
      
      // 1. Get the latest content of the source file to ensure not overwriting others' changes and preserving the original format
      const { content: currentRawContent, sha: latestSha } = await github.getFileRawContent(targetFile.path);

      // 2. Insert the new line at the end of the specified level, preserving all non-link lines of the original file
      const updatedRawContent = insertLinkToMarkdown(
        currentRawContent,
        suggestion.dir,
        suggestion.title,
        url
      );

      // 3. Submit update to GitHub
      const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRawContent);

      // 4. Update local state (re-parse to reflect UI changes)
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = {
        ...targetFile,
        content: updatedRawContent,
        sha: newSha,
        tree: parseMarkdown(updatedRawContent)
      };
      
      setFiles(updatedFiles);
      setStatus('success');
      setUrl('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`Save failed: ${err.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className={clsx(
        "bg-card border rounded-2xl shadow-xl transition-all duration-300 overflow-hidden",
        isMinimized ? "w-12 h-12 rounded-full cursor-pointer hover:shadow-2xl hover:scale-110" : "p-4 w-80 shadow-2xl"
      )}
      onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className={clsx(
          "flex items-center justify-between mb-4",
          isMinimized ? "h-full w-full justify-center mb-0" : ""
        )}>
          <div className="flex items-center gap-2">
            <Sparkles className={clsx("text-primary", isMinimized ? "w-6 h-6" : "w-4 h-4")} />
            {!isMinimized && <h3 className="text-sm font-semibold">AI Organizer</h3>}
          </div>
          {!isMinimized && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!isMinimized && (
          <>
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
                    disabled={status === 'analyzing' || !url || files.length === 0}
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
          </>
        )}
      </div>
    </div>
  );
};
