import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { Sparkles, Loader2, Check, Minimize2, Search, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { GitHubService } from '../lib/github';
import { insertLinkToMarkdown, parseMarkdown } from '../lib/markdown';
import { safeParseJSON } from '../lib/ai';
import type { FavoriteFile, Bookmark, Directory } from '../lib/types';

type AssistantMode = 'organize' | 'search';

export const AIAssistant: React.FC = () => {
  const { t } = useTranslation();
  const { config, files, setFiles, setSelectedUrl, setActiveFileIndex } = useStore();
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AssistantMode>('organize');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'confirming' | 'success' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<{ file: string; dir: string; title: string; reason: string } | null>(null);
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; fileIndex: number; reason: string }[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);

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
      alert(t('ai.connectGithub'));
      return;
    }
    setStatus('analyzing');

    try {
      const fileContext = files.map((f: FavoriteFile) => ({
        filename: f.filename,
        dirs: getAllDirPaths(f.tree)
      }));

      const prompt = `You are a professional bookmark organizer assistant.
Analyze link: ${url}
Categorize it into one of these files: ${files.map(f => f.filename).join(', ')}
Within the file, find a directory or return "root".
Context: ${JSON.stringify(fileContext, null, 2)}
Return JSON: { "file": "filename", "dir": "dir title or root", "title": "page title", "reason": "why in ${t('ai.reasonLanguage')}" }`;

      const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiKey}` },
        body: JSON.stringify({
          model: config.openaiModel || "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const rawContent = data.choices[0].message.content || '{}';
      setSuggestion(safeParseJSON(rawContent, null));
      setStatus('confirming');
    } catch (err) {
      setStatus('error');
    }
  };

  const handleAISearch = async () => {
    if (!config || !query || files.length === 0) return;
    setStatus('analyzing');
    setSearchResults([]);

    try {
      const bookmarkMap = new Map<string, { title: string, url: string, fileIndex: number, path: string }>();
      
      // 构建给 AI 看的紧凑树状结构字符串
      const filesContext = files.map((file, fIndex) => {
        let fileText = `File: ${file.filename}\n`;
        
        const traverse = (items: (Bookmark | Directory)[], depth: number, path: string) => {
          items.forEach(item => {
            const indent = '  '.repeat(depth);
            if ('children' in item) {
              fileText += `${indent}- [Dir] ${item.title}\n`;
              traverse(item.children, depth + 1, path ? `${path} > ${item.title}` : item.title);
            } else {
              const id = `b-${fIndex}-${Math.random().toString(36).slice(2, 7)}`; // 临时短ID
              bookmarkMap.set(id, {
                title: item.title,
                url: item.url,
                fileIndex: fIndex,
                path: path || 'Root'
              });
              fileText += `${indent}- [ID:${id}] ${item.title}\n`;
            }
          });
        };
        
        traverse(file.tree, 1, '');
        return fileText;
      }).join('\n');

      const prompt = `You are a semantic search engine. User query: "${query}"

User's Bookmarks Hierarchy (IDs and Titles only):
${filesContext}

Task:
1. Analyze the query and find 3-5 most relevant bookmarks by their ID.
2. Search logic: Match by title, folder context, or conceptual similarity.
3. Return ONLY JSON.

Return JSON format:
{
  "results": [
    { "id": "string", "reason": "short sentence in ${t('ai.reasonLanguage')}" }
  ]
}`;

      const baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiKey}` },
        body: JSON.stringify({
          model: config.openaiModel || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a professional assistant that returns ONLY JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const aiResponse = safeParseJSON<{ results: any[] }>(data.choices[0].message.content, { results: [] });
      
      const enrichedResults = (aiResponse.results || []).map((r: any) => {
        const original = bookmarkMap.get(r.id);
        return original ? { 
          title: original.title, 
          url: original.url, 
          fileIndex: original.fileIndex, 
          reason: r.reason 
        } : null;
      }).filter((item): item is { title: string; url: string; fileIndex: number; reason: string } => item !== null);

      if (enrichedResults.length === 0) {
        // 如果 ID 匹配失败（有时 AI 会幻觉 ID），尝试标题模糊匹配作为后备
        console.warn("ID match failed, AI might have hallucinated IDs.");
      }

      setSearchResults(enrichedResults);
      setStatus('confirming');
    } catch (err) {
      console.error("AI Search Error:", err);
      setStatus('error');
    }
  };

  const handleConfirm = async () => {
    if (!config || !suggestion || !files.length) return;
    setStatus('analyzing');
    try {
      const fileIndex = files.findIndex((f: FavoriteFile) => f.filename === suggestion.file);
      const targetFile = files[fileIndex];
      const github = new GitHubService(config);
      const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
      const updatedRaw = insertLinkToMarkdown(currentRaw, suggestion.dir, suggestion.title, url);
      const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = { ...targetFile, content: updatedRaw, sha: newSha, tree: parseMarkdown(updatedRaw) };
      setFiles(updatedFiles);
      setStatus('success');
      setUrl('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <motion.div
        animate={{ width: isMinimized ? 48 : 340, height: isMinimized ? 48 : "auto", borderRadius: isMinimized ? 24 : 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={clsx("bg-card border shadow-2xl overflow-hidden flex flex-col", isMinimized ? "cursor-pointer" : "p-4")}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className={clsx("flex items-center justify-between shrink-0", isMinimized ? "h-full w-full" : "mb-4")}>
          <div className={clsx("flex items-center gap-2", isMinimized ? "w-full justify-center" : "")}>
            <Sparkles className={clsx("text-primary", isMinimized ? "w-6 h-6" : "w-4 h-4")} />
            {!isMinimized && (
              <div className="flex bg-muted p-0.5 rounded-lg border text-[10px] font-bold">
                <button onClick={(e) => { e.stopPropagation(); setMode('organize'); setStatus('idle'); }} className={clsx("px-2 py-0.5 rounded", mode === 'organize' ? "bg-background text-primary" : "text-muted-foreground")}>{t('ai.organizeMode')}</button>
                <button onClick={(e) => { e.stopPropagation(); setMode('search'); setStatus('idle'); }} className={clsx("px-2 py-0.5 rounded", mode === 'search' ? "bg-background text-primary" : "text-muted-foreground")}>{t('ai.searchMode')}</button>
              </div>
            )}
          </div>
          {!isMinimized && <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className="text-muted-foreground"><Minimize2 className="w-3.5 h-3.5" /></button>}
        </div>

        {!isMinimized && (
          <AnimatePresence mode="wait">
            <motion.div key={mode + status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {mode === 'organize' ? (
                status === 'confirming' ? (
                  <div className="space-y-4 text-xs">
                    <div className="bg-muted/50 p-3 rounded border border-dashed space-y-1">
                      <p><strong>{t('ai.aiTitle')}:</strong> {suggestion?.title}</p>
                      <p><strong>{t('ai.file')}:</strong> {suggestion?.file}</p>
                      <p><strong>{t('ai.path')}:</strong> {suggestion?.dir}</p>
                      <p className="italic opacity-70">"{suggestion?.reason}"</p>
                    </div>
                    <div className="flex gap-2"><button onClick={() => setStatus('idle')} className="flex-1 py-1.5 border rounded">{t('common.cancel')}</button><button onClick={handleConfirm} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded">{t('common.save')}</button></div>
                  </div>
                ) : status === 'success' ? (
                  <div className="flex flex-col items-center py-4 text-green-600"><Check className="w-8 h-8 mb-2" /><span className="text-xs">{t('ai.success')}</span></div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder={t('ai.pasteUrl')} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} className="w-full pl-3 pr-10 py-2 bg-muted/50 border rounded text-sm outline-none" />
                    <button onClick={handleAnalyze} className="absolute right-2 top-1.5 text-primary">{status === 'analyzing' ? <Loader2 className="animate-spin w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}</button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <input type="text" placeholder={t('ai.aiSearchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAISearch()} className="w-full pl-3 pr-10 py-2 bg-muted/50 border rounded text-sm outline-none" />
                    <button onClick={handleAISearch} className="absolute right-2 top-1.5 text-primary">{status === 'analyzing' ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}</button>
                  </div>
                  {status === 'confirming' && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.map((res, i) => (
                        <div 
                          key={i} 
                          onClick={() => { 
                            setActiveFileIndex(res.fileIndex); 
                            setSelectedUrl(res.url); 
                            // 关键：同步搜索词到全局，让左侧树自动定位和展开
                            useStore.getState().setSearchQuery(res.title);
                            if (window.innerWidth < 768) useStore.getState().setMobileActivePane('content'); 
                          }} 
                          className="p-2 rounded border bg-muted/30 hover:border-primary/30 cursor-pointer transition-all"
                        >
                          <div className="text-xs font-bold truncate">{res.title}</div>
                          <div className="text-[10px] opacity-60 italic">"{res.reason}"</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
};
