import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import BNA_STYLE_PROFILE from '@/lib/bna-style-profile';
import { WORKFLOW_SECTIONS } from '@/lib/insightwire-workflow';

// Full system prompt per style guide Section 11 + workflow Sections 2, 5, 6.
// The BNA_STYLE_PROFILE already contains the complete style guide (Sections 1-11).
// WORKFLOW_SECTIONS provide the hard source rules, article generation rules, and references format.
const ARTICLE_SYSTEM_PROMPT = `${WORKFLOW_SECTIONS.HARD_SOURCES}

${WORKFLOW_SECTIONS.ARTICLE_GENERATION}

${WORKFLOW_SECTIONS.REFERENCES}

${BNA_STYLE_PROFILE}`;

// Explicit output format instructions, separate from the style guide itself.
// This enforces Section 11 "Output Block Structure" exactly.
const OUTPUT_FORMAT_INSTRUCTIONS = `OUTPUT FORMAT — you MUST produce exactly three blocks in this order. Do not skip any block.

=== BLOCK 1: ARTICLE BODY (markdown) ===

The article MUST contain ALL of the following, in this order:

1. HEADLINE — a single # heading. Follow Section 3 exactly:
   - [Company/Subject] + [active verb] + [object/outcome] + [context or dollar figure]
   - Never start with "The"
   - Use strong active verbs from Section 3 (raises, secures, acquires, etc.)
   - Dollar figures abbreviated: $49m, $1.2b (lowercase). Percentages: 42pc

2. HEADLINE VARIANTS — immediately after the main headline, a section headed "### Headline Variants" with 3–5 alternative headlines. Label each by pattern type from Section 3 (e.g. "Company + verb + dollar amount", "Wordplay/pun", "Contrast/tension").

3. ARTICLE BODY — following the structure in Section 5 exactly:
   - Lede (1 sentence): [City]-based + company + (ASX: XXX) + has [verb] + dollar figure + context. Never start with "The". Never open with a quote. Present perfect tense.
   - Deal mechanics / expansion (1–3 paragraphs)
   - Company background (1–2 paragraphs)
   - First quote — CEO/founder (1–2 paragraphs). Quote first, then attribution. Use "said" for press release/ASX sources, "says" for live interviews.
   - Financial/operational detail (2–4 paragraphs)
   - Secondary quotes (1–3 paragraphs)
   - Market/competitive context (1–2 paragraphs)
   - Forward-looking close (1 paragraph)
   - Share price note if ASX story: "Shares in [Company] were trading X per cent [higher/lower] at $X.XX at [time] (AEST/AEDT)."
   - End on a quote, financial metric, or share price note — NEVER a summary conclusion.

   Formatting rules from Sections 7-9:
   - 1–3 sentences per paragraph, never more than 4
   - "per cent" (two words) in body, never "%"
   - "$49 million" / "$1.2 billion" spelled out in body
   - Australian English (organisation, recognise, colour)
   - No subheadings in standard news articles
   - No bullet points in editorial copy
   - No exclamation marks
   - Never use: utilise, leverage (as verb), going forward, in order to, according to
   - All quotes traceable to named individuals in the source — never invent quotes
   - If no usable quote exists: [No quote available in source — seek comment from CEO/spokesperson]

=== BLOCK 2: REFERENCES JSON ===

Return as a fenced code block tagged json:references — per workflow Section 6:

\`\`\`json:references
[
  { "index": 1, "claim": "exact claim from article", "source_title": "source name", "source_type": "url|pdf|docx|text_file", "origin": "ASX announcement|media release|etc", "source_id": "src_001", "url": "https://..." }
]
\`\`\`

Include a reference for every key factual claim, direct quote, and significant figure.

=== BLOCK 3: FACT-CHECK CHECKLIST JSON ===

Return as a fenced code block tagged json:checklist — per style guide Section 11:

\`\`\`json:checklist
[
  { "item": "Dollar figure matches source", "pass": true },
  { "item": "ASX ticker included on first mention (if listed)", "pass": true },
  { "item": "City-based descriptor on first mention", "pass": true },
  { "item": "All quotes attributed to named individuals from the source", "pass": true },
  { "item": "No summary conclusion paragraph", "pass": true },
  { "item": "Headline does not start with The", "pass": true },
  { "item": "Announcement date confirmed as current (within 2-3 days)", "pass": false }
]
\`\`\`

Evaluate each check against the article you just generated and the hard sources.

=== AFTER BLOCK 3: EDITOR Q&A (plain text) ===

After the checklist, add a section headed "## Editor Q&A" with 3 suggested follow-up questions. This is plain text, not JSON. Example prompts:
- "What is [term used in article]?"
- "Has this company raised money before?"
- "Who are their main competitors?"

=== END OF OUTPUT FORMAT ===

Do NOT omit any block. Do NOT add any other sections or appendices.`;

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

    // Per workflow Section 7: pass hard source content as user messages, not system prompt
    const sourceContent = sourceTexts.map(s => ({
      type: 'text' as const,
      text: `[SOURCE — ${s.label} (${s.type}), id: ${s.id}]\n${s.text}`,
    }));

    const articleMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 5000,
      system: ARTICLE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${topicBlock}CONFIRMED BRIEF:\n${brief}\n\nHere are the hard sources:` },
          ...sourceContent,
          { type: 'text', text: OUTPUT_FORMAT_INSTRUCTIONS },
        ],
      }],
    });

    const fullOutput = articleMessage.content[0]?.type === 'text' ? articleMessage.content[0].text : '';

    // ── Parse the three output blocks per Section 11 ──────

    // Block 1: Article body (everything before first json: block)
    const articleBody = fullOutput.split(/```json:references/)[0]?.trim() ?? fullOutput;

    // Block 2: References JSON
    const refsMatch = fullOutput.match(/```json:references\s*\n([\s\S]*?)```/);
    let references = null;
    if (refsMatch) {
      try { references = JSON.parse(refsMatch[1].trim()); } catch { /* ignore parse errors */ }
    }

    // Block 3: Fact-check checklist JSON
    const checkMatch = fullOutput.match(/```json:checklist\s*\n([\s\S]*?)```/);
    let checklist = null;
    if (checkMatch) {
      try { checklist = JSON.parse(checkMatch[1].trim()); } catch { /* ignore parse errors */ }
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
