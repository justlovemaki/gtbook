import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  ExternalLink, 
  Globe, 
  Layout, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  Code, 
  Globe2, 
  Copy, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

type ContentType = 'markdown' | 'html' | 'text';

export const ContentView: React.FC = () => {
  const { selectedUrl, readerMode, setReaderMode, showSource, setShowSource, setMobileActivePane } = useStore();
  const [loading, setLoading] = useState(false);
  const [showErrorTip, setShowErrorTip] = useState(false);
  const [content, setContent] = useState<string>('');
  const [contentType, setContentType] = useState<ContentType>('markdown');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedUrl) {
      setLoading(true);
      setShowErrorTip(false);
      setContent('');
      
      if (readerMode) {
        fetchReaderContent(selectedUrl);
      } else {
        const timer = setTimeout(() => setLoading(false), 1000);
        const errorTimer = setTimeout(() => setShowErrorTip(true), 3000);
        return () => {
          clearTimeout(timer);
          clearTimeout(errorTimer);
        };
      }
    }
  }, [selectedUrl, readerMode]);

  const handleCopy = () => {
    if (selectedUrl) {
      navigator.clipboard.writeText(selectedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchReaderContent = async (url: string) => {
    setLoading(true);
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          'Accept': 'text/plain',
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch reader content');
      
      const text = await response.text();
      setContent(text);
      
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        setContentType('html');
      } else if (text.includes('# ') || text.includes('**') || text.includes('](')) {
        setContentType('markdown');
      } else {
        setContentType('text');
      }
    } catch (err) {
      console.error(err);
      setContent('Failed to load content in reader mode.');
      setContentType('text');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 p-8">
        <div className="md:hidden absolute top-4 left-4">
           <button 
            onClick={() => setMobileActivePane('bookmarks')}
            className="p-1.5 hover:bg-muted rounded-lg text-primary transition-colors border"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-primary/5 p-6 rounded-full mb-6">
          <Layout className="w-12 h-12 text-primary/20" />
        </div>
        <h2 className="text-xl font-medium text-foreground">Select a bookmark to read</h2>
        <p className="max-w-xs text-center mt-2 text-sm">
          Click a link in the middle panel to preview content here.
        </p>
      </div>
    );
  }

  const isHttp = selectedUrl.startsWith('http://');

  const renderReaderContent = () => {
    if (showSource) {
      return (
        <pre className="p-8 text-xs whitespace-pre-wrap font-mono leading-relaxed bg-muted/20 min-h-full">
          {content}
        </pre>
      );
    }

    switch (contentType) {
      case 'html':
        return (
          <div className="prose prose-sm max-w-none p-8 dark:prose-invert">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      case 'markdown':
        return (
          <div className="prose prose-sm max-w-4xl mx-auto p-8 dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {content}
            </ReactMarkdown>
          </div>
        );
      default:
        return (
          <pre className="p-8 text-sm whitespace-pre-wrap font-mono leading-relaxed max-w-4xl mx-auto">
            {content}
          </pre>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
      <div className="p-2 border-b flex items-center justify-between bg-background/95 backdrop-blur-sm z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-2 ml-1">
          {/* Mobile Back Button */}
          <button 
            onClick={() => setMobileActivePane('bookmarks')}
            className="md:hidden p-1.5 hover:bg-muted rounded-lg text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex bg-muted p-0.5 rounded-lg border ml-1">
            <button
              onClick={() => setReaderMode(false)}
              className={clsx(
                "px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-bold uppercase rounded-md transition-all",
                !readerMode ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Web</span>
            </button>
            <button
              onClick={() => setReaderMode(true)}
              className={clsx(
                "px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-bold uppercase rounded-md transition-all flex items-center gap-1 md:gap-1.5",
                readerMode ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </button>
          </div>
          
          {readerMode && !loading && (
            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex items-center gap-1 bg-muted/50 px-1.5 md:px-2 py-1 rounded text-[10px] font-medium text-muted-foreground border border-border/50">
                {contentType === 'markdown' && <FileText className="w-3 h-3" />}
                {contentType === 'html' && <Code className="w-3 h-3" />}
                {contentType === 'text' && <Globe2 className="w-3 h-3" />}
                <span className="uppercase hidden sm:inline">{contentType}</span>
              </div>
              <button
                onClick={() => setShowSource(!showSource)}
                className={clsx(
                  "px-1.5 md:px-2 py-1 text-[10px] font-bold uppercase rounded border transition-all",
                  showSource ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {showSource ? (
                  <>
                    <span className="hidden sm:inline">Render</span>
                    <Layout className="w-3 h-3 sm:hidden" />
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Source</span>
                    <Code className="w-3 h-3 sm:hidden" />
                  </>
                )}
              </button>
            </div>
          )}
          
          <div className="h-4 w-px bg-border hidden md:block" />
          
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-[400px]">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate opacity-70">{selectedUrl}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={handleCopy}
            title="Copy Link"
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs font-semibold bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-all shadow-sm"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
          <a
            href={selectedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:ring-2 hover:ring-primary/20 transition-all shadow-sm"
          >
            <span className="hidden md:inline">Open</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="flex-1 w-full relative bg-white overflow-auto">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary/40" />
              <span className="text-xs text-muted-foreground animate-pulse">
                {readerMode ? 'AI is parsing content...' : 'Establishing connection...'}
              </span>
            </div>
          </div>
        )}

        {readerMode ? (
          <div className="bg-background min-h-full">
            {renderReaderContent()}
          </div>
        ) : (
          <div className="h-full w-full relative">
            {showErrorTip && !loading && (
              <div className="absolute inset-0 z-0 flex items-center justify-center p-6 text-center pointer-events-none">
                <div className="max-w-md p-6 bg-background/95 backdrop-blur border rounded-2xl shadow-2xl pointer-events-auto space-y-4">
                  <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">Connection Denied?</h3>
                    <p className="text-sm text-muted-foreground">
                      Many sites (GitHub, etc.) block previewing in a window for security.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setReaderMode(true)}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Switch to AI Reader (Recommended)
                    </button>
                    <a
                      href={selectedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-muted text-muted-foreground rounded-xl text-sm font-medium"
                    >
                      Open directly in new tab
                    </a>
                  </div>
                </div>
              </div>
            )}

            {isHttp && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-lg">
                <div className="bg-destructive text-destructive-foreground px-4 py-3 rounded-xl shadow-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold mb-1">Mixed Content Blocked</p>
                    <p className="opacity-90">HTTPS site cannot load HTTP link. Use AI Reader or Open Site.</p>
                  </div>
                </div>
              </div>
            )}

            <iframe
              key={selectedUrl}
              src={selectedUrl || ''}
              onLoad={() => setLoading(false)}
              className="w-full h-full border-none relative z-5"
              title="Content Preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          </div>
        )}
      </div>
    </div>
  );
};
