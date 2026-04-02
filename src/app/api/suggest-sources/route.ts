import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WORKFLOW_SECTIONS } from '@/lib/insightwire-workflow';

// Workflow Section 2 (Hard Sources) + Section 3 (Soft Sources)
// Web search enabled per Section 7: "The soft source stage is the only stage that requires web search."
const SUGGEST_SYSTEM_PROMPT = `${WORKFLOW_SECTIONS.HARD_SOURCES}

${WORKFLOW_SECTIONS.SOFT_SOURCES}

You are an editorial assistant for Business News Australia. Based on the hard sources and the confirmed brief, recommend up to 3 soft sources.

CRITICAL: Each recommendation must be a specific, fetchable URL — not a search suggestion. Use web search to find the actual source page and return the direct link.

Return your recommendations as a JSON array inside a fenced code block tagged json:suggestions using this exact format:

\`\`\`json:suggestions
[
  {
    "url": "https://actual-direct-url-to-the-source.com/page",
    "title": "Exact headline or document name as it appears at the URL",
    "source_type": "ASX announcement",
    "rationale": "One sentence explaining why this source is relevant."
  }
]
\`\`\`

If you cannot find a real URL for a source through web search, do not include it. Return fewer than 3 rather than returning fake or guessed URLs.

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
      max_tokens: 1500,
      system: SUGGEST_SYSTEM_PROMPT,
      // Enable web search per workflow Section 7
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
      messages: [{
        role: 'user',
        content: `${topicBlock}BRIEF:\n${brief}\n\nHard sources loaded:\n${sourceLabels.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nUse web search to find up to 3 relevant soft sources as specific URLs. Return as JSON per the soft source output format.`,
      }],
    });

    // Extract text from response (may have tool_use blocks from web search)
    const textBlocks = message.content.filter(b => b.type === 'text');
    const output = textBlocks.map(b => b.type === 'text' ? b.text : '').join('\n');

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
