'use client';

import { useState } from 'react';
import { Upload, Copy, Download, Maximize2, Minimize2, Loader2, CheckCircle2, ThumbsUp, ThumbsDown, Eye, ArrowRight, Pencil, Eye as EyeIcon, BookmarkPlus, X } from 'lucide-react';

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
  const [fileContents, setFileContents] = useState<string[]>([]);
  const [fileNames, setFileNames]       = useState<string[]>([]);
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

  // ── Saved Sources Modal state ───────────────────────────
  const [savedModalOpen, setSavedModalOpen]     = useState(false);
  const [savedSources, setSavedSources]         = useState<{ id: number; url: string; title: string; source_type: string; rationale: string }[]>([]);
  const [savedLoading, setSavedLoading]         = useState(false);
  const [selectedSaved, setSelectedSaved]       = useState<Set<number>>(new Set());

  const openSavedModal = async () => {
    setSavedModalOpen(true);
    setSavedLoading(true);
    setSelectedSaved(new Set());
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

  const addSelectedSources = () => {
    const selected = savedSources.filter(s => selectedSaved.has(s.id));
    const newUrls = selected.filter(s => s.url).map(s => s.url);
    if (newUrls.length > 0) {
      setSourceUrls(prev => {
        const filtered = prev.filter(u => u.trim());
        return [...filtered, ...newUrls, ''];
      });
    }
    setSavedModalOpen(false);
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const text = await extractFileText(file);
        if (!text.trim()) { setError(`Could not extract text from ${file.name}`); continue; }
        setFileContents(prev => [...prev, text.trim()]);
        setFileNames(prev => [...prev, file.name]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to process ${file.name}`);
      }
    }
  };

  const removeFile = (idx: number) => {
    setFileContents(prev => prev.filter((_, i) => i !== idx));
    setFileNames(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Step 2: Generate brief (Workflow Section 4) ─────────
  const handleGenerateBrief = async () => {
    setError('');
    const urls = sourceUrls.filter(s => s.trim());
    const texts = pastedTexts.filter(s => s.trim());
    if (urls.length === 0 && fileContents.length === 0 && texts.length === 0) {
      setError('Please provide at least one hard source (URL, file, or pasted text).'); return;
    }
    setBriefLoading(true);
    setBrief('');
    setBriefConfirmed(false);
    setSoftSuggestions([]);
    setArticleText('');
    setStage('brief');
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: urls, fileContents: [...fileContents, ...texts], topic }),
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
          sourceLabels: [...urls, ...fileNames],
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

      const res = await fetch('/api/generate-articles-4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, sourceTexts, topic, additionalPrompts }),
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

          <label style={lbl}>Hard Sources — URLs</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '7px' }}>
            {sourceUrls.map((src, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.text2, width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <input style={{ ...inp, flex: 1 }} type="url" value={src} onChange={e => setSourceUrls(prev => prev.map((s, j) => j === i ? e.target.value : s))} placeholder="https://…" />
                {i > 0 && <button onClick={() => setSourceUrls(prev => prev.filter((_, j) => j !== i))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>×</button>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button onClick={() => setSourceUrls(prev => [...prev, ''])} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 9px', borderRadius: '4px', border: `1px dashed ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer' }}>+ URL</button>
            <button onClick={openSavedModal} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 9px', borderRadius: '4px', border: `1px dashed ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookmarkPlus size={10} /> Add Source
            </button>
            <label style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 9px', borderRadius: '4px', border: `1px dashed ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Upload size={10} /> Upload file
              <input type="file" accept=".pdf,.doc,.docx,.txt" multiple style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files)} />
            </label>
          </div>

          {fileNames.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Hard Sources — Files</label>
              {fileNames.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: VS.accentGlow, borderRadius: '4px', fontSize: '11px', color: VS.text1, fontFamily: 'monospace', marginBottom: '4px' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <button onClick={() => removeFile(i)} style={{ width: '18px', height: '18px', borderRadius: '3px', border: `1px solid ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Hard Sources — Pasted Text</label>
            {pastedTexts.map((txt, i) => (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '9px', color: VS.accent, background: VS.accentGlow, padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>TEXT {i + 1}</span>
                  <button onClick={() => setPastedTexts(prev => prev.filter((_, j) => j !== i))} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(244,71,71,0.3)', background: 'rgba(244,71,71,0.05)', color: VS.error, cursor: 'pointer' }}>Remove</button>
                </div>
                <textarea
                  value={txt}
                  onChange={e => setPastedTexts(prev => prev.map((t, j) => j === i ? e.target.value : t))}
                  rows={4}
                  placeholder="Paste raw text here — press release, ASX announcement, article content…"
                  style={{ ...inp, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5, resize: 'vertical' }}
                />
              </div>
            ))}
            <button onClick={() => setPastedTexts(prev => [...prev, ''])} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 9px', borderRadius: '4px', border: `1px dashed ${VS.border}`, background: 'transparent', color: VS.text2, cursor: 'pointer' }}>+ Paste Text</button>
          </div>

          <button onClick={handleGenerateBrief} disabled={briefLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: `linear-gradient(135deg, ${VS.accent}, ${VS.accentDim})`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 14px rgba(255,128,0,0.2)', opacity: briefLoading ? 0.5 : 1 }}>
            {briefLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating Brief…</> : <><ArrowRight size={14} /> Generate Brief</>}
          </button>

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

              {/* ── Confirm Brief & Generate ── */}
              {!briefConfirmed && (
                <button onClick={handleConfirmAndGenerate} disabled={articleLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: `linear-gradient(135deg, ${VS.success}, #2d9980)`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 14px rgba(78,201,176,0.2)' }}>
                  <CheckCircle2 size={14} /> Confirm Brief & Generate Article
                </button>
              )}
              {briefConfirmed && (
                <div style={{ padding: '10px', background: 'rgba(78,201,176,0.08)', border: '1px solid rgba(78,201,176,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={14} style={{ color: VS.success }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.success }}>Brief confirmed — article generating</span>
                </div>
              )}
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

          {!hasArticle && !articleLoading && (
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

      {/* ── Saved Sources Modal ────────────────────────────── */}
      {savedModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSavedModalOpen(false)}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: '12px', width: '520px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${VS.border}` }}>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.accent, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Saved Sources</div>
              <button onClick={() => setSavedModalOpen(false)} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
              {savedLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px' }}>
                  <Loader2 size={16} style={{ color: VS.accent, animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: VS.text2 }}>Loading saved sources…</span>
                </div>
              )}
              {!savedLoading && savedSources.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '12px', color: VS.text2 }}>No saved sources yet.</div>
              )}
              {savedSources.map(s => {
                const checked = selectedSaved.has(s.id);
                return (
                  <div key={s.id} onClick={() => toggleSavedSelection(s.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: checked ? VS.accentGlow : VS.bg2, border: `1px solid ${checked ? VS.accent : VS.border}`, borderRadius: '6px', marginBottom: '6px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${checked ? VS.accent : VS.border}`, background: checked ? VS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      {checked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: VS.text0, fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ fontSize: '10px', color: VS.text2, fontFamily: 'monospace', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(86,156,214,0.15)', color: VS.blue }}>{s.source_type}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${VS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: VS.text2 }}>{selectedSaved.size} selected</span>
              <button onClick={addSelectedSources} disabled={selectedSaved.size === 0}
                style={{ fontFamily: 'monospace', fontSize: '11px', padding: '7px 16px', borderRadius: '6px', border: 'none', background: selectedSaved.size > 0 ? VS.accent : VS.bg3, color: selectedSaved.size > 0 ? '#fff' : VS.text2, cursor: selectedSaved.size > 0 ? 'pointer' : 'default', fontWeight: 600 }}>
                Add {selectedSaved.size > 0 ? `${selectedSaved.size} Source${selectedSaved.size > 1 ? 's' : ''}` : 'Sources'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
