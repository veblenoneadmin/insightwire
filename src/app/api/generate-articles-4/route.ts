import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import BNA_STYLE_PROFILE from '@/lib/bna-style-profile';

// Article generation uses the BNA style guide (final_bna.md) Sections 1-10 only.
// Section 11 is application-level instructions for the developer, not for the model.
const ARTICLE_SYSTEM_PROMPT = BNA_STYLE_PROFILE.split('## 11. AI Article Generation Rules')[0].trim()

  + `\n\nCRITICAL OUTPUT RULES:
- Start the article with a single # headline following Section 3 exactly. This is the only heading in the entire output.
- After the headline, write the article body as flowing prose paragraphs — lede, then body, then closing. No ## or ### subheadings anywhere in the article body. Per Section 5: "No subheadings in standard news articles."
- Do not add any labels like "Lede:", "Body:", "Quote:", "Headline Variants:", "Editor Q&A:", "References:", "Fact-check:" etc.
- Do not add any sections after the article. Output ends with the final paragraph of the article (a quote, share price note, or forward-looking fact per Section 5).
- Output ONLY: # headline, then article prose. Nothing else.`;

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
    const tone: string = body.tone || '';
    const mood: string = body.mood || '';
    const wordCount: number | undefined = body.wordCount;
    const region: string = body.region || '';
    const announcementQuotes: { source: string; quote: string; placement?: string }[] = body.announcementQuotes || [];

    const topicBlock = topic ? `ANGLE/FOCUS: ${topic}\n\n` : '';

    // Advanced options overrides
    const optionBlocks: string[] = [];
    if (tone) optionBlocks.push(`TONE: ${tone}`);
    if (mood) optionBlocks.push(`FORMAT: ${mood}`);
    if (wordCount) optionBlocks.push(`TARGET WORD COUNT: approximately ${wordCount} words`);
    if (region) optionBlocks.push(`REGIONAL FOCUS: ${region}`);
    const optionsBlock = optionBlocks.length > 0 ? `\n\n${optionBlocks.join('\n')}` : '';

    // Hard sources as user message content per workflow Section 7
    const sourceContent = sourceTexts.map(s => ({
      type: 'text' as const,
      text: `[SOURCE — ${s.label} (${s.type}), id: ${s.id}]\n${s.text}`,
    }));

    // Additional prompts from promoted soft sources
    const additionalBlock = additionalPrompts.filter(p => p.trim()).length > 0
      ? `\n\nADDITIONAL INSTRUCTIONS FROM WRITER:\n${additionalPrompts.filter(p => p.trim()).join('\n')}`
      : '';

    // Quotes selected by writer from announcements — must be used verbatim in the article
    const quotesBlock = announcementQuotes.length > 0
      ? `\n\nREQUIRED QUOTES (selected by writer from announcements — include these verbatim as direct quotes in the article, with appropriate attribution. Follow the writer's placement instruction for each):\n${announcementQuotes.map((q, i) => `${i + 1}. From "${q.source}"${q.placement ? ` — placement: ${q.placement}` : ''}:\n   "${q.quote}"`).join('\n\n')}`
      : '';

    const articleMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 5000,
      system: ARTICLE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${topicBlock}CONFIRMED BRIEF:\n${brief}${optionsBlock}${additionalBlock}${quotesBlock}\n\nHere are the hard sources:` },
          ...sourceContent,
          { type: 'text', text: 'Using the confirmed brief and the hard sources above, write a complete BNA-style article. Follow the style guide exactly. Output only the article.' },
        ],
      }],
    });

    const articleText = articleMessage.content[0]?.type === 'text' ? articleMessage.content[0].text : '';

    return NextResponse.json({ articleText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-articles-4] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
