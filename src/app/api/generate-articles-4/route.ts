import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import BNA_STYLE_PROFILE from '@/lib/bna-style-profile';

// Article generation uses ONLY the BNA style guide (final_bna.md).
// The workflow (insightwire_workflow.md) was already applied during brief generation.
// By this point the brief is confirmed and hard sources are gathered.
const ARTICLE_SYSTEM_PROMPT = BNA_STYLE_PROFILE;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });
    const body = await req.json();

    const brief: string = body.brief;
    if (!brief) {
      return NextResponse.json({ error: 'Brief must be confirmed before article generation' }, { status: 400 });
    }

    const sourceTexts: { id: string; label: string; text: string; type: string }[] = body.sourceTexts || [];
    const topic: string = body.topic || '';
    const additionalPrompts: string[] = body.additionalPrompts || [];

    const topicBlock = topic ? `ANGLE/FOCUS: ${topic}\n\n` : '';

    // Hard sources as user message content
    const sourceContent = sourceTexts.map(s => ({
      type: 'text' as const,
      text: `[SOURCE — ${s.label} (${s.type}), id: ${s.id}]\n${s.text}`,
    }));

    // Additional prompts from promoted soft sources
    const additionalBlock = additionalPrompts.filter(p => p.trim()).length > 0
      ? `\n\nADDITIONAL INSTRUCTIONS FROM WRITER:\n${additionalPrompts.filter(p => p.trim()).join('\n')}`
      : '';

    const articleMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 5000,
      system: ARTICLE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${topicBlock}CONFIRMED BRIEF:\n${brief}${additionalBlock}\n\nHere are the hard sources:` },
          ...sourceContent,
          { type: 'text', text: `Using the confirmed brief and the hard sources above, write a complete BNA-style article following the style guide exactly.

Your output must contain exactly these blocks in order:

1. The article as markdown — with a headline (# heading), then a "### Headline Variants" section with 3-5 alternatives labelled by pattern type, then the full article body following Section 5 structure.

2. A references JSON block mapping every key claim to its hard source:
\`\`\`json:references
[{ "index": 1, "claim": "...", "source_title": "...", "source_type": "...", "origin": "...", "source_id": "...", "url": "..." }]
\`\`\`

3. A fact-check checklist JSON block:
\`\`\`json:checklist
[{ "item": "Dollar figure matches source", "pass": true }, ...]
\`\`\`

4. An "## Editor Q&A" section with 3 suggested follow-up questions as plain text.

Do not omit any block.` },
        ],
      }],
    });

    const fullOutput = articleMessage.content[0]?.type === 'text' ? articleMessage.content[0].text : '';

    // Parse the output blocks
    const articleBody = fullOutput.split(/```json:references/)[0]?.trim() ?? fullOutput;

    const refsMatch = fullOutput.match(/```json:references\s*\n([\s\S]*?)```/);
    let references = null;
    if (refsMatch) {
      try { references = JSON.parse(refsMatch[1].trim()); } catch { /* ignore */ }
    }

    const checkMatch = fullOutput.match(/```json:checklist\s*\n([\s\S]*?)```/);
    let checklist = null;
    if (checkMatch) {
      try { checklist = JSON.parse(checkMatch[1].trim()); } catch { /* ignore */ }
    }

    const lastBlockEnd = fullOutput.lastIndexOf('```');
    const editorQA = lastBlockEnd > -1 ? fullOutput.slice(lastBlockEnd + 3).trim() : '';

    return NextResponse.json({
      articleText: articleBody,
      references,
      checklist,
      editorQA,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-articles-4] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
