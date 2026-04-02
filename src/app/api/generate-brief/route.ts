import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WORKFLOW_SECTIONS } from '@/lib/insightwire-workflow';

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const text = await res.text();
  return text.split(/\s+/).slice(0, 3500).join(' ');
}

// Workflow Section 2 (Hard Sources) + Section 4 (Brief Generation) — no additions, follow the MD strictly.
const BRIEF_SYSTEM_PROMPT = `${WORKFLOW_SECTIONS.HARD_SOURCES}

${WORKFLOW_SECTIONS.BRIEF_GENERATION}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });
    const body = await req.json();

    const sources: string[] = body.sources || [];
    const fileContents: string[] = body.fileContents || [];
    const topic: string = body.topic || '';

    // Scrape URLs
    const scrapedSources: { id: string; label: string; text: string; type: string }[] = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (src.trim()) {
        try {
          const text = await scrapeUrl(src.trim());
          scrapedSources.push({ id: `src_${i + 1}`, label: src, text, type: 'url' });
        } catch {
          scrapedSources.push({ id: `src_${i + 1}`, label: src, text: '[Failed to fetch — URL may be paywalled or unavailable]', type: 'url' });
        }
      }
    }

    // File sources
    const fileSources = fileContents.map((text, i) => ({
      id: `file_${i + 1}`,
      label: `Uploaded file ${i + 1}`,
      text: text.split(/\s+/).slice(0, 3500).join(' '),
      type: 'document',
    }));

    const allSources = [...scrapedSources, ...fileSources];

    // Build source blocks per workflow Section 7 (hard source injection as user messages)
    const sourceBlocks = allSources.map(
      (s) => `[SOURCE — ${s.label} (${s.type}), id: ${s.id}]\n${s.text}`
    );

    const topicBlock = topic ? `ANGLE/FOCUS: ${topic}\n\n` : '';
    const sourceContent = sourceBlocks.map(b => ({ type: 'text' as const, text: b }));

    const briefMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${topicBlock}Here are the hard sources for this article:` },
          ...sourceContent,
          { type: 'text', text: 'Generate the brief based on these sources only.' },
        ],
      }],
    });

    const brief = briefMessage.content[0]?.type === 'text' ? briefMessage.content[0].text : '';

    return NextResponse.json({
      brief,
      scrapedSources: allSources.map(s => ({ id: s.id, label: s.label, type: s.type, preview: s.text.slice(0, 200) })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-brief] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
