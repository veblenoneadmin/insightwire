'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, ChevronRight, Copy, Download, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Loader2, CheckCircle2, Paperclip, X } from 'lucide-react';
import BnaStyleGuide from '@/components/shared/BnaStyleGuide';

// ── VS Dark palette ───────────────────────────────────────
const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  accent: '#FF8000', accentGlow: 'rgba(255,128,0,0.10)', accentDim: '#CC6600',
  error: '#f44747',
};

// ── Markdown → HTML (mirrors PHP md_to_html) ─────────────
function mdToHtml(text: string): string {
  let t = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs, '<em>$1</em>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n{2,}/g, '</p><p>');
  t = '<p>' + t + '</p>';
  t = t.replace(/<p>\s*<(h[1-4]|hr|blockquote)/gi, '<$1');
  t = t.replace(/<\/(h[1-4]|blockquote)>\s*<\/p>/gi, '</$1>');
  t = t.replace(/<p><\/p>/g, '');
  return t;
}

const LOADING_MSGS = [
  ['Connecting to engine…', 'Establishing pipeline'],
  ['Fetching source URLs…', 'Reaching out to sources'],
  ['Scraping article data…', 'Extracting text and metadata'],
  ['Preparing prompt…', 'Applying style guide'],
  ['AI is writing…', 'Generating original BNA-style content'],
  ['Refining structure…', 'Polishing lede and flow'],
  ['Quality check…', 'Verifying BNA style compliance'],
  ['Finalizing output…', 'Packaging articles'],
  ['Almost there…', 'Applying final formatting'],
];

type ArticleInput  = { topic: string; sources: string[] };
type ArticleResult = { index: number; topic: string; articleText: string };
type UploadedFile  = { name: string; text: string };

// ── BNA Preview ───────────────────────────────────────────
function BnaPreview({ article, imgSrc, onImgChange }: {
  article: ArticleResult;
  imgSrc: string;
  onImgChange: (src: string) => void;
}) {
  const [urlBarOpen, setUrlBarOpen] = useState(false);
  const [urlInput, setUrlInput]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver]     = useState(false);

  const articleBody = article.articleText.split(/\n+#{1,3}\s*Headline Variants/)[0];
  const html = mdToHtml(articleBody);
  const tmp  = document.createElement('div');
  tmp.innerHTML = html;
  const h1 = tmp.querySelector('h1');
  const headline = h1 ? h1.innerHTML : '';
  if (h1) h1.remove();
  const bodyHtml = tmp.innerHTML;
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => onImgChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ background: '#f0efe8', minHeight: '100%' }}>
      {/* BNA Header */}
      <div style={{ background: '#fff', borderBottom: '3px solid #000', position: 'sticky', top: 0, zIndex: 5 }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Pragati Narrow', 'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: '#000', letterSpacing: '-0.5px' }}>
            Business<span style={{ color: '#00AEEF' }}>News</span>Australia
          </span>
          <div style={{ display: 'flex', gap: '14px' }}>
            {['Entrepreneurship', 'Technology', 'Capital Raising', 'Leadership', 'Property'].map(n => (
              <span key={n} style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#333', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>{n}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Article body */}
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '28px 20px 60px', display: 'grid', gridTemplateColumns: '1fr 290px', gap: '28px' }}>
        <div>
          {headline && (
            <h1 style={{ fontFamily: "'Pragati Narrow', 'Playfair Display', serif", fontSize: '30px', fontWeight: 700, color: '#000', lineHeight: 1.2, margin: '0 0 12px', letterSpacing: '-0.2px' }}
              dangerouslySetInnerHTML={{ __html: headline }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
            <span style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#333', fontWeight: 700 }}>
              By <span style={{ color: '#00AEEF' }}>InsightWire</span>
            </span>
            <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#999' }}>{today}</span>
          </div>

          {/* Image area */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div
            onClick={() => imgSrc ? setUrlBarOpen(v => !v) : setUrlBarOpen(true)}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file?.type.startsWith('image/')) handleFile(file);
              else { const url = e.dataTransfer.getData('text'); if (url) onImgChange(url); }
            }}
            style={{ marginBottom: '6px', background: dragOver ? '#eaf5ff' : '#e8e8e0', borderRadius: '2px', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative', outline: dragOver ? '3px dashed #00AEEF' : 'none' }}
          >
            {imgSrc
              ? <img src={imgSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#bbb', textAlign: 'center', padding: '20px' }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="28" height="20" rx="2"/><circle cx="10" cy="13" r="3"/><path d="M2 22l8-6 6 5 4-3 10 7"/></svg>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#aaa' }}>Click or drop image</span>
                  <span style={{ fontSize: '11px' }}>JPG, PNG, WebP — or paste a URL</span>
                </div>
            }
            {urlBarOpen && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.82)', padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 3 }}
                onClick={e => e.stopPropagation()}>
                <input
                  value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { onImgChange(urlInput); setUrlBarOpen(false); setUrlInput(''); } }}
                  placeholder="Paste image URL…"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', padding: '5px 9px', color: '#fff', fontSize: '12px', outline: 'none' }}
                  autoFocus
                />
                <button onClick={() => { onImgChange(urlInput); setUrlBarOpen(false); setUrlInput(''); }}
                  style={{ background: '#00AEEF', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
                <button onClick={() => { setUrlBarOpen(false); fileRef.current?.click(); }}
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>Upload</button>
                <button onClick={() => setUrlBarOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
            {imgSrc && (
              <button onClick={e => { e.stopPropagation(); onImgChange(''); }}
                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 3 }}>×</button>
            )}
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#999', fontStyle: 'italic', marginBottom: '18px', textAlign: 'right' }}>Image caption</div>

          {/* Article body */}
          <div
            className="bna-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            style={{ fontFamily: 'sans-serif', fontSize: '16px', color: '#656565', lineHeight: 1.72 }}
          />
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#A12611', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #A12611', letterSpacing: '0.5px' }}>Latest News</div>
            {['Brisbane startup secures $5m Series A to expand nationally', 'Gold Coast developer launches $120m mixed-use precinct', 'Melbourne fintech Paytime names new CEO as growth accelerates', 'Perth mining tech firm lists on ASX raising $18m', 'Sydney biotech advances Phase 2 trial with $30m raise'].map((title, i) => (
              <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid #eee' }}>
                <a href="#" style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#000', textDecoration: 'none', fontWeight: 700, lineHeight: 1.35, display: 'block' }}>{title}</a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .bna-body p { margin: 0 0 15px; }
        .bna-body h1 { font-family: sans-serif; font-size: 28px; color: #000; margin: 0 0 12px; font-weight: 700; }
        .bna-body h2 { font-family: sans-serif; font-size: 24px; color: #000; margin: 24px 0 10px; font-weight: 700; }
        .bna-body h3 { font-family: sans-serif; font-size: 20px; color: #00AEEF; margin: 22px 0 8px; }
        .bna-body h4 { font-size: 14px; color: #A12611; margin: 18px 0 6px; text-transform: uppercase; font-weight: 700; }
        .bna-body strong { color: #333; font-weight: 700; }
        .bna-body em { font-style: italic; }
        .bna-body a { color: #00AEEF; text-decoration: none; }
        .bna-body blockquote { border-left: 4px solid #00AEEF; padding: 10px 16px; margin: 20px 0; background: #f4f9ff; color: #444; font-style: italic; }
        .bna-body hr { border: none; border-top: 1px solid #eee; margin: 22px 0; }
      `}</style>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function CreateArticlePage() {
  const [mode, setMode]           = useState<'editor' | 'categorical'>('editor');
  const [tone, setTone]           = useState('Authoritative');
  const [mood, setMood]           = useState('News Report');
  const [articles, setArticles]   = useState<ArticleInput[]>([{ topic: '', sources: [''] }]);
  const [categories, setCategories] = useState(['', '', '']);
  const [wordCount, setWordCount] = useState('');
  const [catWordCount, setCatWordCount] = useState('');
  const [catRegion, setCatRegion] = useState('');
  const [whitelist, setWhitelist] = useState('');
  const [optOpen, setOptOpen]     = useState(false);
  const [wlOpen, setWlOpen]       = useState(false);
  const [catOptOpen, setCatOptOpen] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [results, setResults]     = useState<ArticleResult[]>([]);
  const [imgSrcs, setImgSrcs]     = useState<Record<number, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [viewMode, setViewMode]   = useState<'preview' | 'raw' | 'guide'>('preview');
  const [error, setError]         = useState('');
  const [saved, setSaved]         = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileKey = (artIdx: number, srcIdx: number) => `${artIdx}_${srcIdx}`;

  const handleFileUpload = async (artIdx: number, srcIdx: number, file: File) => {
    const key = fileKey(artIdx, srcIdx);
    setUploading(u => ({ ...u, [key]: true }));
    try {
      const name = file.name.toLowerCase();
      let text = '';

      if (name.endsWith('.txt') || name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/extract-text', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`Failed to extract text from ${file.name}`);
        const data = await res.json();
        text = data.text;
      } else {
        setError('Unsupported file type. Use .txt, .pdf, or .docx');
        return;
      }

      if (!text.trim()) { setError('Could not extract text from file.'); return; }
      setUploadedFiles(f => ({ ...f, [key]: { name: file.name, text: text.trim() } }));
      updateSource(artIdx, srcIdx, '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file');
    } finally {
      setUploading(u => ({ ...u, [key]: false }));
    }
  };

  const clearUpload = (artIdx: number, srcIdx: number) => {
    const key = fileKey(artIdx, srcIdx);
    setUploadedFiles(f => { const n = { ...f }; delete n[key]; return n; });
  };

  // Load most recent saved articles on mount
  useEffect(() => {
    fetch('/api/articles')
      .then(r => r.json())
      .then(data => {
        const saved = Array.isArray(data) ? data : data.articles;
        if (!Array.isArray(saved) || !saved.length) return;
        const recent = saved.slice(0, 10).map((a: { id: number; topic?: string; article_text?: string; articleText?: string }, i: number) => ({
          index: i,
          topic: a.topic || '',
          articleText: a.article_text || a.articleText || '',
        }));
        setResults(recent);
        setCurrentIdx(0);
        setSaved(true);
      })
      .catch(() => {});
  }, []);

  // ── Loading ticker ─────────────────────────────────────
  const startLoading = useCallback(() => {
    setLoading(true); setLoadingMsg(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i = i >= LOADING_MSGS.length - 1 ? LOADING_MSGS.length - 3 : i + 1;
      setLoadingMsg(i);
    }, 4000);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Article input helpers ──────────────────────────────
  const addArticle = () => setArticles(a => [...a, { topic: '', sources: [''] }]);
  const removeArticle = (i: number) => setArticles(a => a.filter((_, j) => j !== i));
  const updateArticleTopic = (i: number, v: string) => setArticles(a => a.map((art, j) => j === i ? { ...art, topic: v } : art));
  const addSource = (i: number) => setArticles(a => a.map((art, j) => j === i ? { ...art, sources: [...art.sources, ''] } : art));
  const removeSource = (i: number, si: number) => setArticles(a => a.map((art, j) => j === i ? { ...art, sources: art.sources.filter((_, k) => k !== si) } : art));
  const updateSource = (i: number, si: number, v: string) => setArticles(a => a.map((art, j) => j === i ? { ...art, sources: art.sources.map((s, k) => k === si ? v : s) } : art));
  const updateCategory = (i: number, v: string) => setCategories(c => c.map((cat, j) => j === i ? v : cat));

  // ── Submit ─────────────────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    if (mode === 'editor') {
      const valid = articles.filter((a, i) => a.sources.some((s, si) => s.trim() || uploadedFiles[fileKey(i, si)]));
      if (!valid.length) { setError('Please provide at least one source URL or uploaded file.'); return; }
    } else {
      if (!categories.some(c => c.trim())) { setError('Please provide at least one category.'); return; }
    }
    startLoading();
    try {
      let payload: object;
      if (mode === 'editor') {
        const arts = articles
          .map((a, i) => ({
            sources: a.sources.map((s, si) => {
              const up = uploadedFiles[fileKey(i, si)];
              return up ? `inline:${up.text}` : s;
            }).filter(s => s.trim()),
            topic: a.topic.trim(),
          }))
          .filter(a => a.sources.length > 0);
        payload = { articles: arts, tone, mood, ...(wordCount ? { wordCount: parseInt(wordCount) } : {}) };
      } else {
        const wl = whitelist.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const cats = categories.filter(c => c.trim()).map(c => ({
          sources: [], topic: c, categorical: true,
          ...(catRegion ? { region: catRegion } : {}),
          ...(wl.length ? { whitelist: wl } : {}),
        }));
        payload = {
          articles: cats, categorical: true, tone, mood,
          ...(catWordCount ? { wordCount: parseInt(catWordCount) } : {}),
          ...(catRegion ? { region: catRegion } : {}),
          ...(wl.length ? { whitelist: wl } : {}),
        };
      }
      const res = await fetch('/api/generate-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || `HTTP ${res.status}`); return; }
      if (!data.articles?.length) { setError('No articles returned.'); return; }
      setResults(data.articles);
      setCurrentIdx(data.articles[0].index);
      setImgSrcs({});
      setSaved(false);
      // Auto-save all generated articles
      for (const article of data.articles) {
        await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: article.topic || '', articleText: article.articleText, tone, mood }),
        }).catch(() => {});
      }
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      stopLoading();
    }
  };

  const currentArticle = results.find(a => a.index === currentIdx);

  const copyArticle = () => {
    if (!currentArticle) return;
    navigator.clipboard.writeText(currentArticle.articleText);
  };

  const saveArticle = async () => {
    if (!currentArticle) return;
    setSaved(false);
    try {
      await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentArticle.topic || '',
          articleText: currentArticle.articleText,
          tone, mood,
        }),
      });
      setSaved(true);
    } catch { /* silently fail */ }
  };
  const downloadArticle = () => {
    if (!currentArticle) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([currentArticle.articleText], { type: 'text/plain' }));
    a.download = `bna-article-${currentIdx}.txt`;
    a.click();
  };

  // ── Shared input style ─────────────────────────────────
  const inp: React.CSSProperties = { background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '6px', padding: '8px 11px', color: VS.text0, fontFamily: 'inherit', fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '9px', fontFamily: 'monospace', color: VS.text2, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '4px' };

  return (
    <>
      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,6,11,0.93)', backdropFilter: 'blur(14px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <Loader2 size={40} style={{ color: VS.accent, animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: VS.text1 }}>{LOADING_MSGS[loadingMsg][0]}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.text2, marginTop: '4px' }}>{LOADING_MSGS[loadingMsg][1]}</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: VS.bg0, fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Left: Form panel ─────────────────────────── */}
        <div style={{ width: formCollapsed ? 0 : '400px', minWidth: formCollapsed ? 0 : '400px', overflowY: 'auto', overflowX: 'hidden', borderRight: `1px solid ${VS.border}`, background: VS.bg1, transition: 'width 0.25s ease, min-width 0.25s ease', flexShrink: 0 }}>
          {!formCollapsed && (
            <div style={{ padding: '18px' }}>
              {error && (
                <div style={{ background: 'rgba(244,71,71,0.08)', border: '1px solid rgba(244,71,71,0.2)', color: VS.error, padding: '9px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px', fontFamily: 'monospace' }}>
                  {error}
                </div>
              )}

              {/* Mode tabs */}
              <div style={{ display: 'flex', border: `1px solid ${VS.border}`, borderRadius: '7px', overflow: 'hidden', marginBottom: '14px' }}>
                {(['editor', 'categorical'] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 10px', background: mode === m ? VS.accentGlow : 'transparent', border: 'none', color: mode === m ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', cursor: 'pointer', fontWeight: mode === m ? 600 : 400 }}>
                    {m === 'editor' ? 'Source URLs' : 'By Topic'}
                  </button>
                ))}
              </div>

              {/* ── Editor mode ── */}
              {mode === 'editor' && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: VS.text2, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'monospace', marginBottom: '12px' }}>Articles</div>
                  {articles.map((art, i) => (
                    <div key={i} style={{ border: `1px solid ${VS.border}`, borderRadius: '8px', padding: '12px', marginBottom: '10px', background: VS.bg2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.accent, background: VS.accentGlow, padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>ARTICLE {i + 1}</span>
                        {i > 0 && <button onClick={() => removeArticle(i)} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(244,71,71,0.3)', background: 'rgba(244,71,71,0.05)', color: VS.error, cursor: 'pointer' }}>Remove</button>}
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={lbl}>Angle (optional)</label>
                        <input style={inp} value={art.topic} onChange={e => updateArticleTopic(i, e.target.value)} placeholder="e.g. Lead with funding implications for QLD tech" />
                      </div>
                      <label style={lbl}>Sources</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '7px' }}>
                        {art.sources.map((src, si) => {
                          const key = fileKey(i, si);
                          const up = uploadedFiles[key];
                          const isUploading = uploading[key];
                          const fileInputRef = { current: null as HTMLInputElement | null };
                          return (
                            <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.text2, width: '14px', textAlign: 'right', flexShrink: 0 }}>{si + 1}</span>
                                {up ? (
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: '6px', padding: '6px 10px' }}>
                                    <Paperclip size={11} style={{ color: VS.accent, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: '11px', color: VS.text1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{up.name}</span>
                                    <button onClick={() => clearUpload(i, si)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, display: 'flex', padding: 0 }}><X size={12} /></button>
                                  </div>
                                ) : (
                                  <input style={{ ...inp, flex: 1 }} type="url" value={src} onChange={e => updateSource(i, si, e.target.value)} placeholder="https://…" />
                                )}
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".txt,.pdf,.doc,.docx"
                                  style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(i, si, f); e.target.value = ''; }}
                                />
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploading}
                                  title="Upload file (.txt, .pdf, .docx)"
                                  style={{ width: '28px', height: '28px', borderRadius: '4px', border: `1px solid ${up ? VS.accent : VS.border}`, background: up ? VS.accentGlow : 'transparent', color: up ? VS.accent : VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isUploading ? 0.5 : 1 }}
                                >
                                  {isUploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={11} />}
                                </button>
                                {si > 0 && <button onClick={() => { removeSource(i, si); clearUpload(i, si); }} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>×</button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => addSource(i)} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 9px', borderRadius: '4px', border: `1px dashed ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer' }}>+ Source</button>
                    </div>
                  ))}
                  <button onClick={addArticle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px', border: `1px dashed ${VS.border}`, borderRadius: '8px', background: 'transparent', color: VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                    <Plus size={12} /> Add Article
                  </button>

                  {/* Options accordion */}
                  <div style={{ border: `1px solid ${VS.border}`, borderRadius: '7px', overflow: 'hidden', marginBottom: '12px' }}>
                    <button onClick={() => setOptOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: VS.bg1, border: 'none', color: optOpen ? VS.accent : VS.text2, cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ChevronRight size={11} style={{ transform: optOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        Optional overrides
                      </span>
                      <span style={{ fontSize: '9px', color: VS.text2, fontWeight: 400 }}>BNA style by default</span>
                    </button>
                    {optOpen && (
                      <div style={{ padding: '12px', borderTop: `1px solid ${VS.border}`, background: VS.bg2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={lbl}>Tone</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['Authoritative', 'Conversational', 'Analytical', 'Punchy'].map(t => (
                              <button key={t} onClick={() => setTone(t)} style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${tone === t ? VS.accent : VS.border}`, background: tone === t ? VS.accentGlow : 'transparent', color: tone === t ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', fontWeight: tone === t ? 600 : 400 }}>{t}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Format</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['News Report', 'Opinion/Analysis', 'Explainer', 'Trend Piece'].map(m => (
                              <button key={m} onClick={() => setMood(m)} style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${mood === m ? VS.accent : VS.border}`, background: mood === m ? VS.accentGlow : 'transparent', color: mood === m ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', fontWeight: mood === m ? 600 : 400 }}>{m}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={lbl}>Word count</label>
                            <input style={inp} type="number" value={wordCount} onChange={e => setWordCount(e.target.value)} min={200} max={2000} step={50} placeholder="~600" />
                          </div>
                          <div>
                            <label style={lbl}>Region</label>
                            <input style={inp} type="text" placeholder="e.g. Queensland" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={handleGenerate} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: `linear-gradient(135deg, ${VS.accent}, ${VS.accentDim})`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 14px rgba(255,128,0,0.2)', opacity: loading ? 0.5 : 1 }}>
                    Generate Articles
                  </button>
                </div>
              )}

              {/* ── By Topic mode ── */}
              {mode === 'categorical' && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: VS.text2, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'monospace', marginBottom: '6px' }}>Topics</div>
                  <p style={{ fontSize: '12px', color: VS.text2, marginBottom: '10px' }}>Up to 3 topics — BNA generates one article each.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '10px' }}>
                    {categories.map((cat, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.accent, background: VS.accentGlow, padding: '2px 8px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                        <input style={{ ...inp, flex: 1 }} value={cat} onChange={e => updateCategory(i, e.target.value)} placeholder={['e.g. Brisbane fintech raises Q1 2025', 'e.g. QLD construction M&A activity', 'e.g. ASX health tech expanding to US'][i]} />
                      </div>
                    ))}
                  </div>

                  {/* Whitelist accordion */}
                  <div style={{ border: `1px solid ${VS.border}`, borderRadius: '7px', overflow: 'hidden', marginBottom: '8px' }}>
                    <button onClick={() => setWlOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: VS.bg1, border: 'none', color: wlOpen ? VS.accent : VS.text2, cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ChevronRight size={11} style={{ transform: wlOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        Source whitelist
                      </span>
                      <span style={{ fontSize: '9px', color: whitelist.trim() ? VS.accent : VS.text2, fontWeight: 400 }}>
                        {whitelist.trim() ? `${whitelist.split('\n').filter(Boolean).length} domain(s)` : 'No restrictions'}
                      </span>
                    </button>
                    {wlOpen && (
                      <div style={{ padding: '12px', borderTop: `1px solid ${VS.border}`, background: VS.bg2 }}>
                        <label style={lbl}>Allowed domains</label>
                        <textarea value={whitelist} onChange={e => setWhitelist(e.target.value)} rows={4} placeholder={'businessnewsaustralia.com\nafr.com\nsmartcompany.com.au'} style={{ ...inp, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6, resize: 'vertical' }} />
                        <div style={{ fontSize: '9px', color: VS.text2, fontFamily: 'monospace', marginTop: '5px' }}>One domain per line. Leave blank for no restriction.</div>
                      </div>
                    )}
                  </div>

                  {/* Cat options accordion */}
                  <div style={{ border: `1px solid ${VS.border}`, borderRadius: '7px', overflow: 'hidden', marginBottom: '12px' }}>
                    <button onClick={() => setCatOptOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: VS.bg1, border: 'none', color: catOptOpen ? VS.accent : VS.text2, cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ChevronRight size={11} style={{ transform: catOptOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        Optional overrides
                      </span>
                      <span style={{ fontSize: '9px', color: VS.text2, fontWeight: 400 }}>BNA style by default</span>
                    </button>
                    {catOptOpen && (
                      <div style={{ padding: '12px', borderTop: `1px solid ${VS.border}`, background: VS.bg2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={lbl}>Tone</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['Authoritative', 'Conversational', 'Analytical', 'Punchy'].map(t => (
                              <button key={t} onClick={() => setTone(t)} style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${tone === t ? VS.accent : VS.border}`, background: tone === t ? VS.accentGlow : 'transparent', color: tone === t ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', fontWeight: tone === t ? 600 : 400 }}>{t}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Format</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['News Report', 'Opinion/Analysis', 'Explainer', 'Trend Piece'].map(m => (
                              <button key={m} onClick={() => setMood(m)} style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${mood === m ? VS.accent : VS.border}`, background: mood === m ? VS.accentGlow : 'transparent', color: mood === m ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', fontWeight: mood === m ? 600 : 400 }}>{m}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={lbl}>Word count</label>
                            <input style={inp} type="number" value={catWordCount} onChange={e => setCatWordCount(e.target.value)} min={200} max={2000} step={50} placeholder="~600" />
                          </div>
                          <div>
                            <label style={lbl}>Region</label>
                            <input style={inp} type="text" value={catRegion} onChange={e => setCatRegion(e.target.value)} placeholder="e.g. Queensland" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={handleGenerate} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: `linear-gradient(135deg, ${VS.accent}, ${VS.accentDim})`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 14px rgba(255,128,0,0.2)', opacity: loading ? 0.5 : 1 }}>
                    Generate Articles
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Preview panel ─────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: results.length ? '#f0efe8' : VS.bg0, minWidth: 0, position: fullscreen ? 'fixed' : 'relative', inset: fullscreen ? 0 : undefined, zIndex: fullscreen ? 500 : undefined }}>

          {/* Preview toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: results.length ? '#fff' : VS.bg1, borderBottom: `1px solid ${results.length ? '#ddd' : VS.border}`, flexShrink: 0, gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              {/* Collapse toggle */}
              <button onClick={() => setFormCollapsed(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${results.length ? '#ddd' : VS.border}`, background: results.length ? '#f5f5f0' : VS.bg2, color: results.length ? '#666' : VS.text2, cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', flexShrink: 0 }}>
                {formCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
                {formCollapsed ? 'Show editor' : 'Hide editor'}
              </button>
              {/* Article tabs */}
              {results.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', overflow: 'auto', flexWrap: 'nowrap' }}>
                  {results.map((art) => (
                    <button key={art.index} onClick={() => setCurrentIdx(art.index)}
                      style={{ fontFamily: 'monospace', fontSize: '10px', padding: '5px 12px', borderRadius: '5px', border: art.index === currentIdx ? '1px solid #FF8000' : '1px solid #ddd', background: art.index === currentIdx ? '#FF8000' : '#f5f5f0', color: art.index === currentIdx ? '#fff' : '#666', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: art.index === currentIdx ? 600 : 400 }}>
                      {art.topic || `Article ${art.index}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {results.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {(['preview', 'raw'] as const).map(v => (
                      <button key={v} onClick={() => setViewMode(v)}
                        style={{ fontFamily: 'monospace', fontSize: '10px', padding: '5px 12px', borderRadius: '5px', border: '1px solid #ddd', background: viewMode === v ? '#000' : '#f5f5f0', color: viewMode === v ? '#fff' : '#666', cursor: 'pointer' }}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button onClick={copyArticle} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
                    <Copy size={11} /> Copy
                  </button>
                  <button onClick={downloadArticle} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
                    <Download size={11} /> .txt
                  </button>
                  <button onClick={saveArticle} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${saved ? '#4ec9b0' : '#ddd'}`, background: saved ? 'rgba(78,201,176,0.1)' : '#fff', color: saved ? '#4ec9b0' : '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
                    {saved ? <><CheckCircle2 size={11} />Saved</> : <><Copy size={11} />Save</>}
                  </button>
                </>
              )}
              <button onClick={() => setViewMode(v => v === 'guide' ? (results.length ? 'preview' : 'preview') : 'guide')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${viewMode === 'guide' ? VS.accent : (results.length ? '#ddd' : VS.border)}`, background: viewMode === 'guide' ? VS.accentGlow : (results.length ? '#fff' : VS.bg2), color: viewMode === 'guide' ? VS.accent : (results.length ? '#666' : VS.text2), cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: viewMode === 'guide' ? 600 : 400 }}>
                Style Guide
              </button>
              <button onClick={() => setFullscreen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${results.length ? '#ddd' : VS.border}`, background: results.length ? '#fff' : VS.bg2, color: results.length ? '#666' : VS.text2, cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
                {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </div>
          </div>

          {/* Preview content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {viewMode === 'guide' ? (
              <BnaStyleGuide />
            ) : !results.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 40px', textAlign: 'center', color: VS.text2, gap: '14px' }}>
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.25}>
                  <rect x="8" y="6" width="32" height="36" rx="3"/>
                  <line x1="14" y1="16" x2="34" y2="16"/>
                  <line x1="14" y1="22" x2="34" y2="22"/>
                  <line x1="14" y1="28" x2="26" y2="28"/>
                </svg>
                <h3 style={{ fontFamily: 'inherit', fontSize: '18px', color: VS.text1, fontWeight: 400, margin: 0 }}>No articles yet</h3>
                <p style={{ fontSize: '13px', maxWidth: '280px', lineHeight: 1.6, margin: 0 }}>Generate articles using the editor — they'll appear here as a BNA-style preview.</p>
              </div>
            ) : viewMode === 'raw' ? (
              <pre style={{ padding: '28px', fontFamily: 'monospace', fontSize: '12px', color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff', minHeight: '100%', margin: 0 }}>
                {currentArticle?.articleText ?? ''}
              </pre>
            ) : currentArticle ? (
              <BnaPreview
                key={currentIdx}
                article={currentArticle}
                imgSrc={imgSrcs[currentIdx] ?? ''}
                onImgChange={(src) => setImgSrcs(m => ({ ...m, [currentIdx]: src }))}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
