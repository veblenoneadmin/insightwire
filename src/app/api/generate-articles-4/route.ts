import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import BNA_STYLE_PROFILE from '@/lib/bna-style-profile';
import { WORKFLOW_SECTIONS } from '@/lib/insightwire-workflow';

// Workflow Section 5: Article generation begins only after the writer confirms the brief.
// Uses: Section 2 (Hard Sources) + Section 5 (Article Generation) + Section 6 (References) + full BNA style guide
const ARTICLE_SYSTEM_PROMPT = `${WORKFLOW_SECTIONS.HARD_SOURCES}

${WORKFLOW_SECTIONS.ARTICLE_GENERATION}

${WORKFLOW_SECTIONS.REFERENCES}

${BNA_STYLE_PROFILE}

You are a journalist for Business News Australia. The writer has confirmed the brief below. Using the confirmed brief and the hard sources, generate a complete BNA-style article.

Rules:
- Use hard sources only. No external knowledge. No inference. No gap-filling.
- Follow the BNA style guide exactly for structure, tone, headlines, attribution, and formatting.
- Attribute every key claim, quote, and figure to its hard source using natural attribution.
- Every claim must be traceable to a hard source. If it cannot be attributed, do not include it.
- Do not editorialise. Do not insert opinion or speculation.
- Generate 3–5 headline variants labelled by pattern type.
- End on a quote, financial metric, or share price note — never a summary paragraph.
- If the hard sources do not contain enough material, state what is missing rather than filling the gap.

After the article, return the references as a JSON array inside a fenced code block tagged json:references.
Each reference must include: index, claim, source_title, source_type, origin, source_id, url (or null).

After the references, return the fact-check checklist as a JSON array inside a fenced code block tagged json:checklist.
Each item must include: item (string), pass (boolean).

After the checklist, add an "Editor Q&A" section with 3 suggested follow-up questions as plain text.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });
    const body = await req.json();

    // Workflow Section 5 Rule 1: Do not generate any article content until the writer has confirmed the brief.
    const brief: string = body.brief;
    if (!brief) {
      return NextResponse.json({ error: 'Brief must be confirmed before article generation (Workflow Section 5, Rule 1)' }, { status: 400 });
    }

    const sourceTexts: { id: string; label: string; text: string; type: string }[] = body.sourceTexts || [];
    const topic: string = body.topic || '';

    const topicBlock = topic ? `ANGLE/FOCUS: ${topic}\n\n` : '';
    const sourceContent = sourceTexts.map(s => ({
      type: 'text' as const,
      text: `[SOURCE — ${s.label} (${s.type}), id: ${s.id}]\n${s.text}`,
    }));

    const articleMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      system: ARTICLE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${topicBlock}CONFIRMED BRIEF:\n${brief}\n\nHere are the hard sources:` },
          ...sourceContent,
          { type: 'text', text: 'Generate the full BNA-style article based on the confirmed brief and hard sources. Include references JSON, fact-check checklist JSON, and Editor Q&A.' },
        ],
      }],
    });

    const fullOutput = articleMessage.content[0]?.type === 'text' ? articleMessage.content[0].text : '';

    // Parse output blocks per style guide Section 11 (Output Block Structure)
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

    // Editor Q&A: everything after the last ``` closing block
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
