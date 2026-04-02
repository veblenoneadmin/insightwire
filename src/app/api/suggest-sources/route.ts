import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WORKFLOW_SECTIONS } from '@/lib/insightwire-workflow';

// Workflow Section 2 (Hard Sources) + Section 3 (Soft Sources)
const SUGGEST_SYSTEM_PROMPT = `${WORKFLOW_SECTIONS.HARD_SOURCES}

${WORKFLOW_SECTIONS.SOFT_SOURCES}

You are an editorial assistant for Business News Australia. Based on the hard sources and the confirmed brief, recommend up to 3 soft sources that are likely relevant to the article angle.

Each recommendation must include:
- source_type: the type of source (e.g. "ASX announcement", "government report", "competitor article", "industry data", "prior BNA coverage")
- description: a one-sentence rationale for why it is relevant
- url: a direct URL to the suggested source. Provide the most likely real URL. If you cannot determine an exact URL, provide the best Google search URL as a fallback using https://www.google.com/search?q=...
- search_query: a specific search query the writer could use to find this source

Return your recommendations as a JSON array inside a fenced code block tagged json:suggestions. Example:

\`\`\`json:suggestions
[
  { "source_type": "ASX announcement", "description": "The company's most recent half-year results would provide revenue and EBITDA figures for context.", "url": "https://www.asx.com.au/asx/statistics/announcements.do?by=asxCode&asxCode=XXX", "search_query": "CompanyName ASX half year results 2025" },
  { "source_type": "prior BNA coverage", "description": "BNA covered this company's previous capital raise 6 months ago — referencing it adds prior coverage context.", "url": "https://www.google.com/search?q=site%3Abusinessnewsaustralia.com+CompanyName+raises", "search_query": "site:businessnewsaustralia.com CompanyName raises" }
]
\`\`\`

Output the JSON block only — no other text.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });
    const body = await req.json();

    const brief: string = body.brief || '';
    const sourceLabels: string[] = body.sourceLabels || [];
    const topic: string = body.topic || '';

    const topicBlock = topic ? `ANGLE/FOCUS: ${topic}\n` : '';

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: SUGGEST_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${topicBlock}BRIEF:\n${brief}\n\nHard sources loaded:\n${sourceLabels.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nRecommend up to 3 relevant soft sources.`,
      }],
    });

    const output = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const match = output.match(/```json:suggestions\s*\n([\s\S]*?)```/);
    let suggestions = [];
    if (match) {
      try { suggestions = JSON.parse(match[1].trim()); } catch { /* ignore */ }
    }

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[suggest-sources] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
