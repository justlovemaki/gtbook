import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { Sparkles, Loader2, Check, Minimize2, Search, PlusCircle, ArrowLeftRight, Trash2, Plus, Globe, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { GitHubService } from '../lib/github';
import { toast } from '../store/useToast';
import { insertLinkToMarkdown, parseMarkdown, compareLinks, extractLinkInfos, type LinkInfo, type ComparisonResult } from '../lib/markdown';
import { safeParseJSON } from '../lib/ai';
import type { FavoriteFile, Bookmark, Directory } from '../lib/types';

type AssistantMode = 'organize' | 'search' | 'compare';

export const AIAssistant: React.FC = () => {
  const { t } = useTranslation();
  const { config, files, setFiles, setSelectedUrl, setActiveFileIndex, expandParents } = useStore();
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AssistantMode>('organize');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'confirming' | 'success' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<{ file: string; dir: string; title: string; reason: string } | null>(null);
  const [batchSuggestions, setBatchSuggestions] = useState<{ file: string; dir: string; title: string; reason: string; url?: string }[] | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; fileIndex: number; reason: string; filename: string; path: string }[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);

  if (!config) return null;

  const getAllDirPaths = (items: (Bookmark | Directory)[], parentPath = ''): string[] => {
    const paths: string[] = [];
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

    // Try to parse as JSON for batch import
    try {
      const trimmed = url.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0] as any).file) {
          setBatchSuggestions(parsed as any[]);
          setStatus('confirming');
          return;
        }
      }
    } catch (e) {
      // Not a valid batch JSON, continue to single URL analysis
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

      const baseUrl = (config.openaiBaseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiKey}` },
        body: JSON.stringify({
          model: config.openaiModel ?? "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const rawContent = data.choices[0].message.content ?? '{}';
      setSuggestion(safeParseJSON(rawContent, null));
      setStatus('confirming');
    } catch (err) {
      setStatus('error');
    }
  };

  const handleCompare = () => {
    if (!url) return;
    setStatus('analyzing');
    try {
      const repoLinks: LinkInfo[] = [];
      files.forEach(f => {
        repoLinks.push(...extractLinkInfos(f.content));
      });
      const result = compareLinks(url, repoLinks);
      setComparison(result);
      setStatus('confirming');
    } catch (err) {
      setStatus('error');
    }
  };

  const handleCopy = (links: LinkInfo[]) => {
    const text = links.map(l => `* [${l.title}](${l.url})${l.reason ? `: ${l.reason}` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success(t('content.copied'));
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

      const baseUrl = (config.openaiBaseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiKey}` },
        body: JSON.stringify({
          model: config.openaiModel ?? "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a professional assistant that returns ONLY JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const aiResponse = safeParseJSON<{ results: any[] }>(data.choices[0].message.content, { results: [] });
      
      const enrichedResults = (aiResponse.results ?? []).map((r: any) => {
        const original = bookmarkMap.get(r.id);
        return original ? { 
          title: original.title, 
          url: original.url, 
          fileIndex: original.fileIndex, 
          reason: r.reason,
          filename: files[original.fileIndex].filename,
          path: original.path
        } : null;
      }).filter((item): item is { title: string; url: string; fileIndex: number; reason: string; filename: string; path: string } => item !== null);

      setSearchResults(enrichedResults);
      setStatus('confirming');
    } catch (err) {
      console.error("AI Search Error:", err);
      setStatus('error');
    }
  };

  const handleBatchConfirm = async () => {
    if (!config || !batchSuggestions || !files.length) return;
    setStatus('analyzing');
    try {
      const github = new GitHubService(config);
      // Group items by file
      const groups = batchSuggestions.reduce((acc, item) => {
        if (!acc[item.file]) acc[item.file] = [];
        acc[item.file].push(item);
        return acc;
      }, {} as Record<string, typeof batchSuggestions>);

      let currentFiles = [...files];

      for (const [filename, items] of Object.entries(groups)) {
        let fileIndex = currentFiles.findIndex(f => f.filename === filename);
        let targetFile: FavoriteFile;

        if (fileIndex === -1) {
          // Create file if it doesn't exist
          targetFile = await github.createFile(filename);
          // Wait a bit for GitHub to reflect the change
          const freshFiles = await github.fetchFiles(true);
          setFiles(freshFiles);
          currentFiles = freshFiles;
          fileIndex = currentFiles.findIndex(f => f.filename === filename);
          targetFile = currentFiles[fileIndex];
        } else {
          targetFile = currentFiles[fileIndex];
        }

        const { content: currentRaw, sha: latestSha } = await github.getFileRawContent(targetFile.path);
        let newRaw = currentRaw;
        
        for (const item of items) {
          // If URL is missing, assume it's a GitHub repo from title
          const itemUrl = item.url || (item.title.includes('/') && !item.title.includes(' ') ? `https://github.com/${item.title}` : item.title);
          
          // Ensure directory exists in markdown
          const dirExists = new RegExp(`^((?:\\s*\\*+\\s*)+)\\[${item.dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(dir\\)`, 'm').test(newRaw);
          
          if (!dirExists && item.dir !== 'root') {
            const suffix = newRaw.endsWith('\n') ? '' : '\n';
            newRaw += `${suffix}* [${item.dir}](dir)\n`;
          }
          
          newRaw = insertLinkToMarkdown(newRaw, item.dir, item.title, itemUrl, item.reason);
        }

        const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, newRaw);
        currentFiles[fileIndex] = { ...targetFile, content: newRaw, sha: newSha, tree: parseMarkdown(newRaw) };
      }

      setFiles(currentFiles, true);
      setStatus('success');
      setUrl('');
      setBatchSuggestions(null);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error("Batch Import Error:", err);
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
      try {
        const newSha = await github.updateFile({ ...targetFile, sha: latestSha }, updatedRaw);
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = { ...targetFile, content: updatedRaw, sha: newSha, tree: parseMarkdown(updatedRaw) };
        setFiles(updatedFiles, true);
        setStatus('success');
      } catch (err) {
        useStore.getState().addPendingChange({ path: targetFile.path, content: updatedRaw, sha: latestSha });
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = { ...targetFile, content: updatedRaw, tree: parseMarkdown(updatedRaw), sha: latestSha };
        setFiles(updatedFiles);
        setStatus('success'); // Still show success but it's offline
      }
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
                <button onClick={(e) => { e.stopPropagation(); setMode('compare'); setStatus('idle'); setComparison(null); }} className={clsx("px-2 py-0.5 rounded", mode === 'compare' ? "bg-background text-primary" : "text-muted-foreground")}>{t('ai.compareMode')}</button>
              </div>
            )}
          </div>
          {!isMinimized && <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className="text-muted-foreground"><Minimize2 className="w-3.5 h-3.5" /></button>}
        </div>

        {!isMinimized && (
          <AnimatePresence mode="wait">
            <motion.div key={mode + status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {status === 'confirming' && batchSuggestions ? (
                <div className="space-y-4 text-xs">
                  <div className="bg-muted/50 p-3 rounded border border-dashed">
                    <p className="font-bold mb-1 text-primary">{t('ai.batchImport')}</p>
                    <p>{t('ai.batchCount', { count: batchSuggestions.length })}</p>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 opacity-70">
                      {batchSuggestions.slice(0, 5).map((s, i) => (
                        <div key={i} className="truncate">• {s.title} ({s.file})</div>
                      ))}
                      {batchSuggestions.length > 5 && <div>{t('ai.andMore', { count: batchSuggestions.length - 5 })}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setStatus('idle'); setBatchSuggestions(null); }} className="flex-1 py-1.5 border rounded">{t('common.cancel')}</button>
                    <button onClick={handleBatchConfirm} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded">{t('ai.confirm')}</button>
                  </div>
                </div>
              ) : mode === 'organize' ? (
                status === 'confirming' ? (
                  <div className="space-y-4 text-xs">
                    <>
                      <div className="bg-muted/50 p-3 rounded border border-dashed space-y-1">
                        <p><strong>{t('ai.aiTitle')}:</strong> {suggestion?.title}</p>
                        <p><strong>{t('ai.file')}:</strong> {suggestion?.file}</p>
                        <p><strong>{t('ai.path')}:</strong> {suggestion?.dir}</p>
                        <p className="italic opacity-70">"{suggestion?.reason}"</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setStatus('idle')} className="flex-1 py-1.5 border rounded">{t('common.cancel')}</button>
                        <button onClick={handleConfirm} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded">{t('common.save')}</button>
                      </div>
                    </>
                  </div>
                ) : status === 'success' ? (
                  <div className="flex flex-col items-center py-4 text-green-600"><Check className="w-8 h-8 mb-2" /><span className="text-xs">{t('ai.success')}</span></div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder={t('ai.pasteUrl')} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} className="w-full pl-3 pr-10 py-2 bg-muted/50 border rounded text-sm outline-none" />
                    <button onClick={handleAnalyze} className="absolute right-2 top-1.5 text-primary">{status === 'analyzing' ? <Loader2 className="animate-spin w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}</button>
                  </div>
                )
              ) : mode === 'compare' ? (
                status === 'confirming' && comparison ? (
                  <div className="space-y-4 text-xs">
                    <div className="bg-muted/50 p-3 rounded border border-dashed max-h-64 overflow-y-auto space-y-4">
                      <p className="font-bold border-b pb-1 flex items-center gap-2"><ArrowLeftRight className="w-3 h-3" />{t('ai.compareResult')}</p>
                      
                      {comparison.added.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-green-600 font-bold flex items-center gap-1"><Plus className="w-3 h-3" />{t('ai.addedLinks')} ({comparison.added.length})</p>
                            <button onClick={() => handleCopy(comparison.added)} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground" title={t('common.copy')}>
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {comparison.added.map((l, i) => (
                            <div key={i} className="pl-4 space-y-0.5">
                              <a 
                                href={l.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="block truncate opacity-80 hover:text-primary hover:opacity-100 transition-colors" 
                                title={l.url}
                              >
                                • {l.title}
                              </a>
                              {l.folder && l.folder !== 'root' && (
                                <div className="pl-3 text-[9px] opacity-40 font-medium">in {l.folder}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {comparison.removed.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-red-600 font-bold flex items-center gap-1"><Trash2 className="w-3 h-3" />{t('ai.removedLinks')} ({comparison.removed.length})</p>
                            <button onClick={() => handleCopy(comparison.removed)} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground" title={t('common.copy')}>
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {comparison.removed.map((l, i) => (
                            <div key={i} className="pl-4 space-y-0.5">
                              <a 
                                href={l.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="block truncate opacity-80 hover:text-primary hover:opacity-100 transition-colors" 
                                title={l.url}
                              >
                                • {l.title}
                              </a>
                              {l.folder && l.folder !== 'root' && (
                                <div className="pl-3 text-[9px] opacity-40 font-medium">from {l.folder}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {comparison.added.length === 0 && comparison.removed.length === 0 && (
                        <p className="text-muted-foreground italic py-2">{t('ai.noChanges')}</p>
                      )}
                    </div>
                    <button onClick={() => setStatus('idle')} className="w-full py-1.5 border rounded">{t('common.close')}</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-2 py-1 bg-primary/5 rounded border border-primary/10">
                      <Globe className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t('nav.searchResults').split(' ')[0]} ({files.length} {t('ai.file')})</span>
                    </div>
                    <textarea 
                      placeholder={t('ai.comparePlaceholder')} 
                      value={url} 
                      onChange={(e) => setUrl(e.target.value)} 
                      className="w-full px-3 py-2 bg-muted/50 border rounded text-sm outline-none min-h-[100px] max-h-[300px] resize-none"
                    />
                    <button 
                      onClick={handleCompare} 
                      className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {status === 'analyzing' ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                      {t('ai.compareMode')}
                    </button>
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
                            // 展开父级并清除搜索词以进入精确位置
                            expandParents(res.fileIndex, res.url);
                            if (window.innerWidth < 768) useStore.getState().setMobileActivePane('content'); 
                          }} 
                          className="p-2 rounded border bg-muted/30 hover:border-primary/30 cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="text-xs font-bold truncate text-foreground">{res.title}</div>
                          <div className="flex flex-wrap items-center gap-1 text-[9px] uppercase font-bold opacity-50">
                            <span className="bg-primary/10 text-primary px-1 rounded">{res.filename.replace('.md', '')}</span>
                            {res.path && res.path !== 'Root' && (
                              <>
                                <ArrowLeftRight className="w-2 h-2 rotate-90" />
                                <span className="truncate max-w-[150px]">{res.path}</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] opacity-60 italic leading-tight">"{res.reason}"</div>
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
