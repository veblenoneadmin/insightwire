'use client';

import { useState } from 'react';
import { Plus, Upload, Copy, Download, Maximize2, Minimize2, Loader2, CheckCircle2, ThumbsUp, ThumbsDown, Eye, ArrowRight, Pencil, Eye as EyeIcon, X, ChevronRight } from 'lucide-react';

// ── Palette ───────────────────────────────────────────────
const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  accent: '#FF8000', accentGlow: 'rgba(255,128,0,0.10)', accentDim: '#CC6600',
  error: '#f44747', success: '#4ec9b0', blue: '#569cd6',
};

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

// ── Types ─────────────────────────────────────────────────
type SourceItem = { id: string; label: string; type: string; text: string };
type SoftSuggestion = { url: string; title: string; source_type: string; rationale: string; status: 'pending' | 'saved' | 'discarded'; additionalPrompt: string };

type WorkflowStage = 'sources' | 'brief' | 'article';

const inp: React.CSSProperties = { background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '6px', padding: '8px 11px', color: VS.text0, fontFamily: 'inherit', fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '9px', fontFamily: 'monospace', color: VS.text2, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '4px' };
const pillBtn = (active: boolean): React.CSSProperties => ({ fontFamily: 'monospace', fontSize: '10px', padding: '5px 12px', borderRadius: '5px', border: active ? '1px solid #FF8000' : `1px solid ${VS.border}`, background: active ? VS.accentGlow : 'transparent', color: active ? VS.accent : VS.text2, cursor: 'pointer', fontWeight: active ? 600 : 400 });

// ── Main Page ─────────────────────────────────────────────
export default function CreateArticle4Page() {
  // ── Source Manager state (Left Panel) ───────────────────
  const [sourceUrls, setSourceUrls] = useState<string[]>(['']);
  const [announcementContents, setAnnouncementContents] = useState<string[]>([]);
  const [announcementNames, setAnnouncementNames]       = useState<string[]>([]);
  const [pastedTexts, setPastedTexts]   = useState<string[]>([]);
  const [topic, setTopic]               = useState('');
  const [error, setError]               = useState('');

  // ── Brief & Suggestions state (Middle Panel) ────────────
  const [stage, setStage]                   = useState<WorkflowStage>('sources');
  const [brief, setBrief]                   = useState('');
  const [briefLoading, setBriefLoading]     = useState(false);
  const [softSuggestions, setSoftSuggestions] = useState<SoftSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  const [scrapedSources, setScrapedSources] = useState<SourceItem[]>([]);

  // ── Article Output state (Right Panel) ──────────────────
  const [articleText, setArticleText]       = useState('');
  const [articleLoading, setArticleLoading] = useState(false);
  const [fullscreen, setFullscreen]         = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [viewingAnn, setViewingAnn]         = useState<number | null>(null);
  const [annQuotes, setAnnQuotes]           = useState<Record<number, string[]>>({});
  const [ctxMenu, setCtxMenu]               = useState<{ x: number; y: number; text: string } | null>(null);

  // ── Staged Quotes (shown in output panel for editing) ───
  type StagedQuote = { source: string; quote: string; placement: string };
  const [stagedQuotes, setStagedQuotes]     = useState<StagedQuote[]>([]);
  const [stagedContent, setStagedContent]   = useState<{ source: string; content: string } | null>(null);
  const [contentEditMode, setContentEditMode] = useState(false);

  // ── Advanced Options state ──────────────────────────────
  const [optOpen, setOptOpen]               = useState(false);
  const [tone, setTone]                     = useState('Authoritative');
  const [mood, setMood]                     = useState('News Report');
  const [wordCount, setWordCount]           = useState('');
  const [region, setRegion]                 = useState('');

  // ── Add Source Modal state ───────────────────────────────
  const [addModalOpen, setAddModalOpen]         = useState(false);
  const [addModalTab, setAddModalTab]           = useState<'url' | 'text' | 'announcement' | 'saved'>('url');
  const [modalUrl, setModalUrl]                 = useState('');
  const [modalText, setModalText]               = useState('');
  const [savedSources, setSavedSources]         = useState<{ id: number; url: string; title: string; source_type: string; rationale: string }[]>([]);
  const [savedLoading, setSavedLoading]         = useState(false);
  const [selectedSaved, setSelectedSaved]       = useState<Set<number>>(new Set());

  const openAddModal = async () => {
    setAddModalOpen(true);
    setAddModalTab('url');
    setModalUrl('');
    setModalText('');
    setSelectedSaved(new Set());
    setSavedLoading(true);
    try {
      const res = await fetch('/api/sources');
      if (res.ok) {
        const data = await res.json();
        setSavedSources(data.sources || []);
      }
    } catch { /* ignore */ }
    finally { setSavedLoading(false); }
  };

  const toggleSavedSelection = (id: number) => {
    setSelectedSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addModalUrlSource = () => {
    if (!modalUrl.trim()) return;
    setSourceUrls(prev => [...prev.filter(u => u.trim()), modalUrl.trim(), '']);
    setModalUrl('');
    setAddModalOpen(false);
  };

  const addModalAnnouncementSource = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const text = await extractFileText(file);
        if (!text.trim()) { setError(`Could not extract text from ${file.name}`); continue; }
        setAnnouncementContents(prev => [...prev, text.trim()]);
        setAnnouncementNames(prev => [...prev, file.name]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to process ${file.name}`);
      }
    }
    // Stay in modal so user can see uploaded files and view contents
  };

  const removeAnnouncement = (idx: number) => {
    setAnnouncementContents(prev => prev.filter((_, i) => i !== idx));
    setAnnouncementNames(prev => prev.filter((_, i) => i !== idx));
  };

  const addModalTextSource = () => {
    if (!modalText.trim()) return;
    setPastedTexts(prev => [...prev, modalText.trim()]);
    setModalText('');
    setAddModalOpen(false);
  };

  const addModalSavedSources = () => {
    const selected = savedSources.filter(s => selectedSaved.has(s.id));
    const newUrls = selected.filter(s => s.url).map(s => s.url);
    if (newUrls.length > 0) {
      setSourceUrls(prev => [...prev.filter(u => u.trim()), ...newUrls, '']);
    }
    setAddModalOpen(false);
  };

  // ── File extraction (client-side) ───────────────────────
  const extractFileText = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.txt')) {
      return await file.text();
    } else if (name.endsWith('.pdf')) {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      }
      return pages.join('\n\n');
    } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    throw new Error('Unsupported file type. Use .txt, .pdf, or .docx');
  };


  // ── Step 2: Generate brief (Workflow Section 4) ─────────
  const handleGenerateBrief = async () => {
    setError('');
    const urls = sourceUrls.filter(s => s.trim());
    const texts = pastedTexts.filter(s => s.trim());
    if (urls.length === 0 && texts.length === 0) {
      setError('Please provide at least one hard source.'); return;
    }
    setBriefLoading(true);
    setBrief('');
    setBriefConfirmed(false);
    setSoftSuggestions([]);
    setArticleText('');
    setStage('brief');
    try {
      // Include any journalist-selected quotes from announcements so the
      // brief can surface "who is quoted" (per workflow Section 4 rule 2).
      const briefQuotes = stagedQuotes.map(sq => ({ source: sq.source, quote: sq.quote }));

      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: urls, fileContents: texts, topic, journalistQuotes: briefQuotes }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); setError(d?.error || `Brief generation failed: HTTP ${res.status}`); return; }
      const data = await res.json();
      setBrief(data.brief);
      setScrapedSources(data.scrapedSources || []);

      // Workflow Section 3: After brief is generated, recommend soft sources
      setSuggestionsLoading(true);
      const sugRes = await fetch('/api/suggest-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: data.brief,
          sourceLabels: urls,
          topic,
        }),
      });
      if (sugRes.ok) {
        const sugData = await sugRes.json();
        setSoftSuggestions((sugData.suggestions || []).map((s: Omit<SoftSuggestion, 'status' | 'additionalPrompt'>) => ({ ...s, status: 'pending' as const, additionalPrompt: '' })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setBriefLoading(false);
      setSuggestionsLoading(false);
    }
  };

  // ── Step 5: Generate article (Workflow Section 5) ───────
  const handleConfirmAndGenerate = async () => {
    setError('');
    setBriefConfirmed(true);
    setArticleLoading(true);
    setStage('article');
    try {
      // Build source texts including any promoted soft sources
      const sourceTexts = scrapedSources.map(s => ({
        id: s.id, label: s.label, text: s.text || s.label, type: s.type,
      }));

      // Collect additional prompts from promoted soft sources
      const additionalPrompts = softSuggestions
        .filter(s => s.status === 'saved' && s.additionalPrompt.trim())
        .map(s => `[${s.source_type}]: ${s.additionalPrompt.trim()}`);

      // Use staged quotes (confirmed from announcement view)
      const announcementQuotes = stagedQuotes.map(sq => ({
        source: sq.source, quote: sq.quote,
      }));

      const res = await fetch('/api/generate-articles-4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, sourceTexts, topic, additionalPrompts, tone, mood, wordCount: wordCount ? parseInt(wordCount) : undefined, region, announcementQuotes }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); setError(d?.error || `Article generation failed: HTTP ${res.status}`); return; }
      const data = await res.json();
      setArticleText(data.articleText || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Article generation failed');
    } finally {
      setArticleLoading(false);
    }
  };

  // ── Soft source feedback (Workflow Section 3, Rule 5) ───
  const updateSuggestionStatus = (idx: number, status: 'saved' | 'discarded') => {
    setSoftSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));
  };

  const saveSource = async (idx: number) => {
    const sug = softSuggestions[idx];
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sug.url, title: sug.title, source_type: sug.source_type, rationale: sug.rationale }),
      });
      if (!res.ok) { setError('Failed to save source'); return; }
      updateSuggestionStatus(idx, 'saved');
    } catch {
      setError('Failed to save source');
    }
  };

  // ── Render helpers ──────────────────────────────────────
  const hasArticle = articleText.length > 0;

  const articleHtml = hasArticle ? (() => {
    const body = articleText.split(/\n+#{1,3}\s*Headline Variants/)[0];
    const html = mdToHtml(body);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const h1 = tmp.querySelector('h1');
    const headline = h1 ? h1.innerHTML : '';
    if (h1) h1.remove();
    return { headline, bodyHtml: tmp.innerHTML };
  })() : null;

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const copyArticle = () => navigator.clipboard.writeText(articleText);
  const downloadArticle = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([articleText], { type: 'text/plain' }));
    a.download = 'bna-article.txt';
    a.click();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: VS.bg0, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ════════════════════════════════════════════════════
          LEFT PANEL — Source Manager (Workflow Section 2)
          ════════════════════════════════════════════════════ */}
      <div style={{ width: '320px', minWidth: '320px', overflowY: 'auto', borderRight: `1px solid ${VS.border}`, background: VS.bg1, flexShrink: 0 }}>
        <div style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.accent, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', fontWeight: 600 }}>Source Manager</div>

          {error && (
            <div style={{ background: 'rgba(244,71,71,0.08)', border: '1px solid rgba(244,71,71,0.2)', color: VS.error, padding: '8px 10px', borderRadius: '6px', marginBottom: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Angle / Focus (optional)</label>
            <input style={inp} value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Lead with funding implications for QLD tech" />
          </div>

          <label style={lbl}>Hard Sources</label>
          {/* List of added sources */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {sourceUrls.filter(u => u.trim()).map((src, i) => (
              <div key={`url-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '4px', fontSize: '11px', color: VS.text1, fontFamily: 'monospace' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(86,156,214,0.15)', color: VS.blue, flexShrink: 0 }}>URL</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src}</span>
                <button onClick={() => setSourceUrls(prev => prev.filter((_, j) => j !== i))} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>×</button>
              </div>
            ))}
            {pastedTexts.map((txt, i) => (
              <div key={`text-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '4px', fontSize: '11px', color: VS.text1, fontFamily: 'monospace' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(255,128,0,0.15)', color: VS.accent, flexShrink: 0 }}>TEXT</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt.slice(0, 60)}{txt.length > 60 ? '…' : ''}</span>
                <button onClick={() => setPastedTexts(prev => prev.filter((_, j) => j !== i))} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px', border: `1px dashed ${VS.border}`, borderRadius: '8px', background: 'transparent', color: VS.text2, fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer', marginBottom: '14px' }}>
            <Plus size={12} /> Add Source
          </button>

          {announcementNames.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Announcements</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {announcementNames.map((name, i) => (
                  <div key={`ann-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '4px', fontSize: '11px', color: VS.text1, fontFamily: 'monospace' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(206,147,216,0.2)', color: '#ce93d8', flexShrink: 0 }}>ANN</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <button onClick={() => setViewingAnn(i)} style={{ fontFamily: 'monospace', fontSize: '8px', padding: '2px 6px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', flexShrink: 0 }}>View</button>
                    <button onClick={() => removeAnnouncement(i)} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ border: `1px solid ${VS.border}`, borderRadius: '7px', overflow: 'hidden', marginBottom: '12px' }}>
            <button onClick={() => setOptOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: VS.bg1, border: 'none', color: optOpen ? VS.accent : VS.text2, cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ChevronRight size={11} style={{ transform: optOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                Advanced Options
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
                    <input style={inp} type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Queensland" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={handleGenerateBrief} disabled={briefLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: `linear-gradient(135deg, ${VS.accent}, ${VS.accentDim})`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 14px rgba(255,128,0,0.2)', opacity: briefLoading ? 0.5 : 1 }}>
            {briefLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating Brief…</> : <><ArrowRight size={14} /> Generate Brief</>}
          </button>

          <button
            onClick={handleConfirmAndGenerate}
            disabled={!brief || articleLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', marginTop: '10px',
              background: (!brief || articleLoading) ? VS.bg3 : `linear-gradient(135deg, ${VS.success}, #2d9980)`,
              color: (!brief || articleLoading) ? VS.text2 : '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: (!brief || articleLoading) ? 'not-allowed' : 'pointer',
              boxShadow: (!brief || articleLoading) ? 'none' : '0 3px 14px rgba(78,201,176,0.2)',
            }}
          >
            {articleLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating Article…</> : <><CheckCircle2 size={14} /> Generate Article</>}
          </button>
          {!brief && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: VS.text2, fontFamily: 'monospace', textAlign: 'center' }}>
              Generate brief first
            </div>
          )}

          <div style={{ marginTop: '14px', padding: '10px', background: VS.bg2, borderRadius: '6px', border: `1px solid ${VS.border}` }}>
            <div style={{ fontFamily: 'monospace', fontSize: '8px', color: VS.text2, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Workflow</div>
            {(['sources', 'brief', 'article'] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '10px', fontFamily: 'monospace', color: stage === s ? VS.accent : s === 'sources' || (s === 'brief' && stage !== 'sources') || (s === 'article' && stage === 'article') ? VS.text1 : VS.text2 }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: `1px solid ${stage === s ? VS.accent : VS.border}`, background: stage === s ? VS.accentGlow : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                {s === 'sources' ? 'Load hard sources' : s === 'brief' ? 'Review brief & suggestions' : 'Generate article'}
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ════════════════════════════════════════════════════
          MIDDLE PANEL — Brief & Suggestions (Workflow Sections 3 + 4)
          ════════════════════════════════════════════════════ */}
      <div style={{ width: '380px', minWidth: '380px', overflowY: 'auto', borderRight: `1px solid ${VS.border}`, background: VS.bg0, flexShrink: 0 }}>
        <div style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.blue, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', fontWeight: 600 }}>Brief & Suggestions</div>

          {!brief && !briefLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', color: VS.text2 }}>
              <div style={{ fontSize: '13px', lineHeight: 1.6 }}>Load hard sources in the left panel and click "Generate Brief". The AI will produce an editorial brief from your sources only.</div>
            </div>
          )}

          {briefLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
              <Loader2 size={24} style={{ color: VS.accent, animation: 'spin 1s linear infinite' }} />
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: VS.text2 }}>Generating brief from hard sources…</div>
            </div>
          )}

          {brief && (
            <>
              {/* ── Brief ── */}
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Editorial Brief — from hard sources only</label>
                <div style={{ padding: '14px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '8px', fontSize: '13px', color: VS.text0, lineHeight: 1.7 }}>
                  {brief.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '').replace(/^[-•]\s*/gm, '• ').split('\n').map((line, i) => (
                    <span key={i}>{line}{i < brief.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>

              {/* ── Journalist-Selected Quotes ── */}
              {stagedQuotes.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={lbl}>Journalist-Selected Quotes ({stagedQuotes.length})</label>
                  <div style={{ fontSize: '10px', color: VS.text2, marginBottom: '8px', fontFamily: 'monospace' }}>
                    These were sent to the brief and will be used in the article.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {stagedQuotes.map((sq, i) => (
                      <div key={`jq-${i}`} style={{ padding: '10px 12px', background: 'rgba(206,147,216,0.06)', border: '1px solid rgba(206,147,216,0.3)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(206,147,216,0.2)', color: '#ce93d8' }}>QUOTE {i + 1}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sq.source}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: VS.text0, lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{sq.quote}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Soft Source Suggestions (Workflow Section 3) ── */}
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Soft Source Suggestions</label>
                <div style={{ fontSize: '10px', color: VS.text2, marginBottom: '8px', fontFamily: 'monospace' }}>
                  AI recommendations — not used until you promote them. Per Workflow Section 3.
                </div>
                {suggestionsLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', color: VS.text2 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>Finding relevant sources…</span>
                  </div>
                )}
                {softSuggestions.map((sug, i) => {
                  const isSelected = selectedSuggestion === i;
                  return (
                    <div key={i}
                      onClick={() => sug.status === 'pending' && setSelectedSuggestion(isSelected ? null : i)}
                      style={{ padding: '10px 12px', background: sug.status === 'saved' ? 'rgba(78,201,176,0.08)' : sug.status === 'discarded' ? 'rgba(244,71,71,0.05)' : isSelected ? 'rgba(86,156,214,0.08)' : VS.bg2, border: `1px solid ${sug.status === 'saved' ? 'rgba(78,201,176,0.3)' : sug.status === 'discarded' ? 'rgba(244,71,71,0.2)' : isSelected ? 'rgba(86,156,214,0.4)' : VS.border}`, borderRadius: '6px', marginBottom: '8px', cursor: sug.status === 'pending' ? 'pointer' : 'default', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(86,156,214,0.15)', color: VS.blue }}>{sug.source_type}</span>
                        {sug.status === 'saved' && <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.success }}>SAVED</span>}
                        {sug.status === 'discarded' && <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.error }}>DISCARDED</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: VS.text0, fontWeight: 600, lineHeight: 1.4, marginBottom: '4px' }}>{sug.title}</div>
                      <div style={{ fontSize: '11px', color: VS.text2, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{sug.url}</div>
                      <div style={{ fontSize: '12px', color: VS.text1, lineHeight: 1.5, marginBottom: '6px' }}>{sug.rationale}</div>

                      {/* Expanded panel when selected */}
                      {isSelected && sug.status === 'pending' && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: '8px' }}>
                          <label style={lbl}>Additional instructions (optional)</label>
                          <textarea
                            value={sug.additionalPrompt}
                            onChange={e => setSoftSuggestions(prev => prev.map((s, j) => j === i ? { ...s, additionalPrompt: e.target.value } : s))}
                            placeholder="e.g. Focus on the revenue figures from this source, ignore the opinion sections…"
                            rows={3}
                            style={{ ...inp, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5, resize: 'vertical' }}
                          />
                        </div>
                      )}

                      {sug.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => saveSource(i)} style={{ ...pillBtn(false), display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: VS.success, borderColor: 'rgba(78,201,176,0.3)' }}><ThumbsUp size={10} /> Save Source</button>
                          <button onClick={() => window.open(sug.url, '_blank')} style={{ ...pillBtn(false), display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}><Eye size={10} /> View</button>
                          <button onClick={() => updateSuggestionStatus(i, 'discarded')} style={{ ...pillBtn(false), display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: VS.error, borderColor: 'rgba(244,71,71,0.3)' }}><ThumbsDown size={10} /> Discard</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          RIGHT PANEL — Article Output (Workflow Section 5)
          ════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: hasArticle ? '#f0efe8' : VS.bg0, minWidth: 0, position: fullscreen ? 'fixed' : 'relative', inset: fullscreen ? 0 : undefined, zIndex: fullscreen ? 500 : undefined }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: hasArticle ? '#fff' : VS.bg1, borderBottom: `1px solid ${hasArticle ? '#ddd' : VS.border}`, flexShrink: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: hasArticle ? '#666' : VS.text2, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Article Output</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {hasArticle && (
              <>
                <button onClick={() => setEditMode(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: editMode ? '1px solid #FF8000' : '1px solid #ddd', background: editMode ? 'rgba(255,128,0,0.08)' : '#fff', color: editMode ? '#FF8000' : '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>{editMode ? <><EyeIcon size={11} /> Preview</> : <><Pencil size={11} /> Edit</>}</button>
                <button onClick={copyArticle} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}><Copy size={11} /> Copy</button>
                <button onClick={downloadArticle} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}><Download size={11} /> .txt</button>
              </>
            )}
            <button onClick={() => setFullscreen(v => !v)} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${hasArticle ? '#ddd' : VS.border}`, background: hasArticle ? '#fff' : VS.bg2, color: hasArticle ? '#666' : VS.text2, cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
              {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {articleLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
              <Loader2 size={36} style={{ color: VS.accent, animation: 'spin 1s linear infinite' }} />
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: VS.text2 }}>Generating article from confirmed brief…</div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.text2 }}>Hard sources only. No external knowledge.</div>
            </div>
          )}

          {!hasArticle && !articleLoading && stagedQuotes.length === 0 && !stagedContent && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 40px', textAlign: 'center', color: VS.text2, gap: '14px' }}>
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.25}>
                <rect x="8" y="6" width="32" height="36" rx="3"/>
                <line x1="14" y1="16" x2="34" y2="16"/>
                <line x1="14" y1="22" x2="34" y2="22"/>
                <line x1="14" y1="28" x2="26" y2="28"/>
              </svg>
              <h3 style={{ fontFamily: 'inherit', fontSize: '18px', color: VS.text1, fontWeight: 400, margin: 0 }}>No article yet</h3>
              <p style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.6, margin: 0 }}>
                1. Load hard sources in the left panel<br/>
                2. Review the brief in the middle panel<br/>
                3. Confirm the brief to generate the article
              </p>
            </div>
          )}

          {!hasArticle && !articleLoading && (stagedQuotes.length > 0 || stagedContent) && (
            <div style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>

              {/* Announcement Content */}
              {stagedContent && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <h2 style={{ fontFamily: 'sans-serif', fontSize: '18px', color: '#333', marginBottom: '2px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', padding: '2px 8px', borderRadius: '3px', background: 'rgba(206,147,216,0.2)', color: '#a055b8' }}>ANN</span>
                        {stagedContent.source}
                      </h2>
                      <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{contentEditMode ? 'Edit mode — make any changes needed.' : 'Saved quotes are highlighted. Click Edit to modify the content.'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setContentEditMode(v => !v)}
                        style={{ fontFamily: 'monospace', fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: contentEditMode ? '1px solid #FF8000' : '1px solid #ddd', background: contentEditMode ? 'rgba(255,128,0,0.08)' : '#fff', color: contentEditMode ? '#FF8000' : '#666', cursor: 'pointer' }}
                      >{contentEditMode ? 'View' : 'Edit'}</button>
                      <button
                        onClick={() => setStagedContent(null)}
                        style={{ fontFamily: 'monospace', fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer' }}
                      >Hide</button>
                    </div>
                  </div>
                  {contentEditMode ? (
                    <textarea
                      value={stagedContent.content}
                      onChange={e => {
                        const newContent = e.target.value;
                        const srcName = stagedContent.source;
                        setStagedContent({ source: srcName, content: newContent });
                        // Keep the pasted-text hard source in sync
                        setPastedTexts(prev => {
                          const tag = `[FROM ANNOUNCEMENT: ${srcName}]\n`;
                          const kept = prev.filter(t => !t.startsWith(tag));
                          return [...kept, `${tag}${newContent}`];
                        });
                      }}
                      style={{ width: '100%', minHeight: '300px', padding: '16px 20px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#444', lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <div style={{ padding: '16px 20px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', minHeight: '300px', maxHeight: '500px', overflowY: 'auto', fontSize: '13px', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {(() => {
                        const sourceQuotes = stagedQuotes.filter(sq => sq.source === stagedContent.source).map(sq => sq.quote).filter(Boolean);
                        if (sourceQuotes.length === 0) return stagedContent.content;
                        // Sort by length descending so longer quotes match before shorter substrings
                        const sorted = [...sourceQuotes].sort((a, b) => b.length - a.length);
                        const escaped = sorted.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                        const regex = new RegExp(`(${escaped.join('|')})`, 'g');
                        const parts = stagedContent.content.split(regex);
                        return parts.map((part, i) => {
                          if (sourceQuotes.includes(part)) {
                            return <mark key={i} style={{ background: 'rgba(206,147,216,0.35)', color: '#333', padding: '1px 3px', borderRadius: '2px', fontStyle: 'italic' }}>{part}</mark>;
                          }
                          return <span key={i}>{part}</span>;
                        });
                      })()}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '6px', fontFamily: 'monospace' }}>
                    {stagedContent.content.split(/\s+/).filter(Boolean).length} words • {stagedContent.content.length} characters
                    {stagedQuotes.filter(sq => sq.source === stagedContent.source).length > 0 && ` • ${stagedQuotes.filter(sq => sq.source === stagedContent.source).length} quote(s) highlighted`}
                  </div>
                </div>
              )}

              {/* Staged Quotes */}
              {stagedQuotes.length > 0 && (
              <>
              <h2 style={{ fontFamily: 'sans-serif', fontSize: '18px', color: '#333', marginBottom: '4px', fontWeight: 700 }}>Staged Quotes</h2>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Edit the quote text and placement below. When you&apos;re ready, click Generate Article below (or confirm the brief in the middle panel).</p>
              </>
              )}

              {stagedQuotes.map((sq, i) => (
                <div key={i} style={{ padding: '14px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', padding: '2px 8px', borderRadius: '3px', background: 'rgba(206,147,216,0.2)', color: '#a055b8', fontWeight: 600 }}>QUOTE {i + 1}</span>
                    <button
                      onClick={() => setStagedQuotes(prev => prev.filter((_, j) => j !== i))}
                      style={{ fontFamily: 'monospace', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #f44747', background: 'rgba(244,71,71,0.05)', color: '#f44747', cursor: 'pointer' }}
                    >Remove</button>
                  </div>

                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Source</label>
                  <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginBottom: '10px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>{sq.source}</div>

                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Quote (editable)</label>
                  <textarea
                    value={sq.quote}
                    onChange={e => setStagedQuotes(prev => prev.map((q, j) => j === i ? { ...q, quote: e.target.value } : q))}
                    rows={3}
                    style={{ width: '100%', padding: '8px 11px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', color: '#333', lineHeight: 1.5, fontFamily: 'sans-serif', fontStyle: 'italic', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

            </div>
          )}

          {hasArticle && editMode && (
            <textarea
              value={articleText}
              onChange={e => setArticleText(e.target.value)}
              style={{ width: '100%', height: '100%', padding: '28px', fontFamily: 'monospace', fontSize: '13px', color: '#333', lineHeight: 1.8, background: '#fff', border: 'none', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          )}

          {hasArticle && !editMode && articleHtml && (
            <div>
              {/* BNA Preview */}
              <div style={{ background: '#f0efe8' }}>
                <div style={{ background: '#fff', borderBottom: '3px solid #000', position: 'sticky', top: 0, zIndex: 5 }}>
                  <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: "'Pragati Narrow', 'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: '#000', letterSpacing: '-0.5px' }}>
                      Business<span style={{ color: '#00AEEF' }}>News</span>Australia
                    </span>
                  </div>
                </div>
                <div style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 20px 40px' }}>
                  {articleHtml.headline && (
                    <h1 style={{ fontFamily: "'Pragati Narrow', 'Playfair Display', serif", fontSize: '30px', fontWeight: 700, color: '#000', lineHeight: 1.2, margin: '0 0 12px' }}
                      dangerouslySetInnerHTML={{ __html: articleHtml.headline }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
                    <span style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#333', fontWeight: 700 }}>By <span style={{ color: '#00AEEF' }}>InsightWire</span></span>
                    <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#999' }}>{today}</span>
                  </div>
                  <div className="bna-body" dangerouslySetInnerHTML={{ __html: articleHtml.bodyHtml }}
                    style={{ fontFamily: 'sans-serif', fontSize: '16px', color: '#656565', lineHeight: 1.72 }} />
                </div>
              </div>

            </div>
          )}
        </div>

        <style>{`
          .bna-body p { margin: 0 0 15px; }
          .bna-body h1 { font-family: sans-serif; font-size: 28px; color: #000; margin: 0 0 12px; font-weight: 700; }
          .bna-body h2 { font-family: sans-serif; font-size: 24px; color: #000; margin: 24px 0 10px; font-weight: 700; }
          .bna-body h3 { font-family: sans-serif; font-size: 20px; color: #00AEEF; margin: 22px 0 8px; }
          .bna-body strong { color: #333; font-weight: 700; }
          .bna-body em { font-style: italic; }
          .bna-body blockquote { border-left: 4px solid #00AEEF; padding: 10px 16px; margin: 20px 0; background: #f4f9ff; color: #444; font-style: italic; }
          .bna-body hr { border: none; border-top: 1px solid #eee; margin: 22px 0; }
        `}</style>
      </div>

      {/* ── Add Source Modal ──────────────────────────────── */}
      {addModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAddModalOpen(false)}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: '12px', width: '520px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${VS.border}` }}>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.accent, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Add Source</div>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${VS.border}` }}>
              {([['url', 'URL'], ['text', 'Text'], ['announcement', 'Announcement'], ['saved', 'Saved']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setAddModalTab(key)}
                  style={{ flex: 1, padding: '10px 8px', background: addModalTab === key ? VS.bg2 : 'transparent', border: 'none', borderBottom: addModalTab === key ? `2px solid ${VS.accent}` : '2px solid transparent', color: addModalTab === key ? VS.accent : VS.text2, fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', fontWeight: addModalTab === key ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

              {/* URL Tab */}
              {addModalTab === 'url' && (
                <div>
                  <label style={lbl}>Source URL</label>
                  <input style={inp} type="url" value={modalUrl} onChange={e => setModalUrl(e.target.value)} placeholder="https://…" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') addModalUrlSource(); }} />
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={addModalUrlSource} disabled={!modalUrl.trim()}
                      style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: modalUrl.trim() ? VS.accent : VS.bg3, color: modalUrl.trim() ? '#fff' : VS.text2, cursor: modalUrl.trim() ? 'pointer' : 'default', fontWeight: 600 }}>
                      Add URL
                    </button>
                  </div>
                </div>
              )}

              {/* Paste Text Tab */}
              {addModalTab === 'text' && (
                <div>
                  <label style={lbl}>Paste text</label>
                  <textarea
                    value={modalText}
                    onChange={e => setModalText(e.target.value)}
                    rows={8}
                    placeholder="Paste raw text here — press release, ASX announcement, article content…"
                    style={{ ...inp, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5, resize: 'vertical' }}
                    autoFocus
                  />
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={addModalTextSource} disabled={!modalText.trim()}
                      style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: modalText.trim() ? VS.accent : VS.bg3, color: modalText.trim() ? '#fff' : VS.text2, cursor: modalText.trim() ? 'pointer' : 'default', fontWeight: 600 }}>
                      Add Text
                    </button>
                  </div>
                </div>
              )}

              {/* Announcement Tab */}
              {addModalTab === 'announcement' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '12px 0 18px', borderBottom: announcementNames.length > 0 ? `1px solid ${VS.border}` : 'none', marginBottom: announcementNames.length > 0 ? '14px' : 0 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(206,147,216,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={20} style={{ color: '#ce93d8' }} />
                    </div>
                    <div style={{ fontSize: '12px', color: VS.text2, textAlign: 'center' }}>ASX announcements, press releases, company filings</div>
                    <label style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 18px', borderRadius: '6px', background: '#ce93d8', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                      Choose PDF, DOCX, or TXT
                      <input type="file" accept=".pdf,.doc,.docx,.txt" multiple style={{ display: 'none' }} onChange={e => addModalAnnouncementSource(e.target.files)} />
                    </label>
                  </div>

                  {announcementNames.length > 0 && (
                    <div>
                      <label style={lbl}>Uploaded Announcements</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {announcementNames.map((name, i) => (
                          <div key={`modal-ann-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '4px', fontSize: '11px', color: VS.text1, fontFamily: 'monospace' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(206,147,216,0.2)', color: '#ce93d8', flexShrink: 0 }}>ANN</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <button onClick={() => setViewingAnn(i)} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '3px 8px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', flexShrink: 0 }}>View</button>
                            <button onClick={() => removeAnnouncement(i)} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => setAddModalOpen(false)}
                          style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: VS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Saved Sources Tab */}
              {addModalTab === 'saved' && (
                <div>
                  {savedLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px' }}>
                      <Loader2 size={16} style={{ color: VS.accent, animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.text2 }}>Loading…</span>
                    </div>
                  )}
                  {!savedLoading && savedSources.length === 0 && (
                    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '12px', color: VS.text2 }}>No saved sources yet.</div>
                  )}
                  {savedSources.map(s => {
                    const checked = selectedSaved.has(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleSavedSelection(s.id)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: checked ? VS.accentGlow : VS.bg2, border: `1px solid ${checked ? VS.accent : VS.border}`, borderRadius: '6px', marginBottom: '6px', cursor: 'pointer' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${checked ? VS.accent : VS.border}`, background: checked ? VS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                          {checked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: VS.text0, fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                          <div style={{ fontSize: '10px', color: VS.text2, fontFamily: 'monospace', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(86,156,214,0.15)', color: VS.blue }}>{s.source_type}</span>
                        </div>
                      </div>
                    );
                  })}
                  {!savedLoading && savedSources.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.text2 }}>{selectedSaved.size} selected</span>
                      <button onClick={addModalSavedSources} disabled={selectedSaved.size === 0}
                        style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: selectedSaved.size > 0 ? VS.accent : VS.bg3, color: selectedSaved.size > 0 ? '#fff' : VS.text2, cursor: selectedSaved.size > 0 ? 'pointer' : 'default', fontWeight: 600 }}>
                        Add {selectedSaved.size > 0 ? `${selectedSaved.size} Source${selectedSaved.size > 1 ? 's' : ''}` : 'Sources'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View Announcement Content Modal ────────────────── */}
      {viewingAnn !== null && announcementContents[viewingAnn] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setViewingAnn(null); setCtxMenu(null);}}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: '12px', width: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${VS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(206,147,216,0.2)', color: '#ce93d8' }}>ANN</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: VS.text0, fontWeight: 600 }}>{announcementNames[viewingAnn]}</span>
              </div>
              <button onClick={() => { setViewingAnn(null); setCtxMenu(null);}} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
            </div>

            {/* Instructions */}
            <div style={{ padding: '8px 18px', background: VS.bg2, borderBottom: `1px solid ${VS.border}`, fontSize: '10px', color: VS.text2, fontFamily: 'monospace' }}>
              Highlight any text and right-click to copy or save as quote.
            </div>

            {/* Content (selectable) */}
            <div
              onContextMenu={(e) => {
                const sel = window.getSelection();
                const text = sel ? sel.toString().trim() : '';
                if (text) {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, text });
                }
              }}
              style={{ flex: 1, overflowY: 'auto', padding: '18px', fontSize: '12px', color: VS.text1, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', userSelect: 'text', cursor: 'text' }}
            >
              {announcementContents[viewingAnn]}
            </div>

            {/* Saved quotes for this announcement */}
            {(annQuotes[viewingAnn] || []).length > 0 && (
              <div style={{ padding: '12px 18px', borderTop: `1px solid ${VS.border}`, maxHeight: '180px', overflowY: 'auto' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.text2, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Saved Quotes ({(annQuotes[viewingAnn] || []).length})
                </div>
                {(annQuotes[viewingAnn] || []).map((q, qi) => (
                  <div key={qi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: '4px', marginBottom: '5px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#ce93d8', flexShrink: 0, marginTop: '1px' }}>{qi + 1}.</span>
                    <span style={{ flex: 1, fontSize: '11px', color: VS.text1, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{q}&rdquo;</span>
                    <button
                      onClick={() => setAnnQuotes(prev => ({
                        ...prev,
                        [viewingAnn]: (prev[viewingAnn] || []).filter((_, i) => i !== qi),
                      }))}
                      style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Continue button — send quotes to output panel */}
            {(annQuotes[viewingAnn] || []).length > 0 && (
              <div style={{ padding: '12px 18px', borderTop: `1px solid ${VS.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    const srcName = announcementNames[viewingAnn];
                    const srcContent = announcementContents[viewingAnn];
                    const quotes = annQuotes[viewingAnn] || [];
                    setStagedQuotes(prev => {
                      // Remove existing quotes from this source, then add the new ones
                      const kept = prev.filter(sq => sq.source !== srcName);
                      const placements = ['First quote (CEO/founder)', 'Secondary quote', 'Closing quote', 'Supporting quote', 'Additional quote'];
                      return [...kept, ...quotes.map((q, i) => ({ source: srcName, quote: q, placement: placements[i] || 'Additional quote' }))];
                    });
                    setStagedContent({ source: srcName, content: srcContent });
                    // Also add the full announcement content as a pasted-text hard source so the
                    // non-quoted content informs brief and article generation.
                    setPastedTexts(prev => {
                      const tag = `[FROM ANNOUNCEMENT: ${srcName}]\n`;
                      // Remove any previous version of this announcement's content
                      const kept = prev.filter(t => !t.startsWith(tag));
                      return [...kept, `${tag}${srcContent}`];
                    });
                    setViewingAnn(null);
                    setCtxMenu(null);
                  }}
                  style={{ fontFamily: 'monospace', fontSize: '11px', padding: '8px 20px', borderRadius: '6px', border: 'none', background: VS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Continue <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Right-Click Context Menu ───────────────────────── */}
      {ctxMenu && viewingAnn !== null && (
        <>
          <div
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1100 }}
          />
          <div style={{
            position: 'fixed',
            left: Math.min(ctxMenu.x, typeof window !== 'undefined' ? window.innerWidth - 180 : ctxMenu.x),
            top: Math.min(ctxMenu.y, typeof window !== 'undefined' ? window.innerHeight - 100 : ctxMenu.y),
            zIndex: 1101, background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: '6px', overflow: 'hidden', minWidth: '160px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(ctxMenu.text);
                setCtxMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'transparent', border: 'none', color: VS.text0, fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = VS.bg2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Copy</button>
            <button
              onClick={() => {
                setAnnQuotes(prev => ({
                  ...prev,
                  [viewingAnn]: [...(prev[viewingAnn] || []), ctxMenu.text],
                }));
                setCtxMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'transparent', border: 'none', color: '#ce93d8', fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(206,147,216,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Save as Quote</button>
          </div>
        </>
      )}
    </div>
  );
}
