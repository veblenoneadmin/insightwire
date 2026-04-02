import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import BNA_STYLE_PROFILE from '@/lib/bna-style-profile';

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const text = await res.text();
  // Trim to 3500 words to match n8n pipeline behaviour
  return text.split(/\s+/).slice(0, 3500).join(' ');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });

    const body = await req.json();
    const articles: { sources: string[]; topic: string; categorical?: boolean; fileContents?: string[] }[] = body.articles || [];

    const results = [];

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];

      // Scrape source URLs via Jina reader
      const scrapedSources: string[] = [];
      for (const src of art.sources || []) {
        if (src.trim()) {
          try {
            const text = await scrapeUrl(src.trim());
            scrapedSources.push(`=== SOURCE: ${src} ===\n${text}`);
          } catch {
            scrapedSources.push(`=== SOURCE: ${src} ===\n[Failed to fetch — URL may be paywalled or unavailable]`);
          }
        }
      }

      const fileBlocks = (art.fileContents || []).map((text, fi) =>
        `=== FILE SOURCE ${fi + 1} ===\n${text.split(/\s+/).slice(0, 3500).join(' ')}`
      );

      const allSources = [...scrapedSources, ...fileBlocks];
      const sourceBlock = allSources.length
        ? `\n\nSOURCE MATERIAL:\n${allSources.join('\n\n---\n\n')}`
        : '';

      const topicBlock = art.topic ? `ANGLE/FOCUS: ${art.topic}\n\n` : '';

      const userPrompt = art.categorical
        ? `${topicBlock}Write an original BNA-style article on the topic above. No source material provided — draw on your knowledge of the subject. Output the article only.`
        : `${topicBlock}Using the source material below, write an original BNA-style business news article. Output the article only.${sourceBlock}`;

      const message = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 3000,
        system: BNA_STYLE_PROFILE,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const articleText = message.content[0]?.type === 'text' ? message.content[0].text : '';
      results.push({ index: i, topic: art.topic || '', articleText });
    }

    return NextResponse.json({ articles: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-articles-4] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
