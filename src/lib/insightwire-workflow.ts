// Auto-generated from insightwire_workflow.md — do not edit manually.
// Bundled at build time to avoid runtime filesystem dependency.

const INSIGHTWIRE_WORKFLOW = `# InsightWire — Source Handling & Article Generation Workflow

**System:** InsightWire — AI-powered article generation for Business News Australia (BNA)
**Version:** 1.1
**Last updated:** 2 April 2026

---

## 1. System Architecture

InsightWire operates across three panels:

- **Left panel — Source Manager:** The writer loads all source material here. These are hard sources.
- **Middle panel — Brief & Suggestions:** The AI generates a brief from hard sources, then recommends soft sources. The writer reviews, promotes, or discards suggestions here.
- **Right panel — Article Output:** The final article renders here with revision, download, share, and delete controls.

---

## 2. Hard Sources

Hard sources are the sole basis for all generated content. They are uploaded directly by the writer.

### Accepted formats

URLs, PDFs, Word documents, images, audio files, pasted text, plain text files.

### Rules

1. Use only facts, figures, quotes, and claims that exist within the hard sources. Do not draw on external knowledge, training data, or general reasoning to supplement them.
2. Do not infer, extrapolate, or synthesise claims that are not explicitly stated in a hard source. If a hard source says revenue was $12M, do not calculate growth rates unless another hard source provides the prior figure.
3. If two hard sources contradict each other, do not resolve the contradiction. Surface it in the brief and let the writer decide.
4. Every claim in the generated article must be traceable to a specific hard source. If a claim cannot be attributed, do not include it.
5. Treat all hard sources with equal weight unless the writer instructs otherwise.

---

## 3. Soft Sources

Soft sources are AI-generated recommendations. They are suggestions only and carry no authority until the writer explicitly promotes them.

### Rules

1. After hard sources are loaded and the brief is generated, recommend up to three soft sources that are likely relevant to the article angle. Each recommendation must include the source type (e.g. ASX announcement, government report, competitor article) and a one-sentence rationale for why it is relevant.
2. Never use a soft source — or any information derived from it — in the brief or the article. A soft source has zero standing until the writer promotes it.
3. The writer can approve a soft source as-is, edit the recommendation before approving, or discard it entirely.
4. Once a writer promotes a soft source, it becomes a hard source. From that point, apply all hard source rules to it without exception.
5. Present a feedback mechanism for each suggestion: like, edit, view, or dislike.

---

## 4. Brief Generation

The brief is the editorial anchor. It is produced from hard sources only and must be confirmed by the writer before article generation begins.

### Rules

1. Generate the brief immediately after hard sources are loaded. Use only the hard sources — no soft sources, no external knowledge.
2. The brief must be three to five sentences and must surface:
   - **The main news hook** — what happened, who did it, and why it matters.
   - **Key figures and dollar amounts** — revenue, valuations, deal sizes, percentages, dates.
   - **Who is quoted** — named individuals and their roles, with a note on the tone or stance of their quotes.
   - **Gaps or contradictions** — anything missing from the sources that a complete article would normally require, and any conflicts between sources.
3. Do not smooth over contradictions. State them plainly (e.g. "Source A reports FY25 revenue of $48M; Source B states $52M. These figures have not been reconciled.").
4. Do not begin article generation until the writer explicitly confirms the brief.

---

## 5. Article Generation

Article generation begins only after the writer confirms the brief. The article draws exclusively from hard sources and follows the BNA style guide.

### Rules

1. Do not generate any article content until the writer has reviewed and confirmed the brief.
2. Use hard sources only. No soft sources, no training data, no external knowledge.
3. Follow the BNA style guide (maintained in a separate document) for structure, tone, headline conventions, attribution style, and formatting.
4. Attribute every key claim, quote, and figure to its hard source within the article body using natural attribution (e.g. "according to the company's ASX filing" or "Smith told BNA").
5. Do not editorialise. Do not insert opinion, speculation, or evaluative language unless it is directly quoted from a hard source.
6. If the hard sources do not contain enough material to produce a complete article, state what is missing and ask the writer to supply additional sources rather than filling the gap with inference.
7. End every article with a structured references section (see Section 6).

---

## 6. References Section

Every article must end with a references block that maps claims to their hard sources.

### Format

Each reference entry must include:

| Field | Description |
|---|---|
| **Claim or quote** | The specific statement, figure, or quote used in the article. |
| **Source title** | The name or headline of the hard source. |
| **Source type** | URL, PDF, Word document, image, audio, pasted text, or text file. |
| **Origin** | Where the source came from (e.g. ASX announcement, company media release, interview transcript, government report). |

### Rules

1. Include a reference entry for every key factual claim, direct quote, and significant figure in the article.
2. If a single claim draws on multiple hard sources, list all contributing sources.
3. Do not include soft sources — whether promoted or not — in the references section unless they were explicitly promoted to hard source status before article generation.
4. Order references by their first appearance in the article.

### Human-readable format (rendered in article)

\`\`\`
## References

1. "Revenue rose 14 per cent to $48 million" — FY25 Annual Report (PDF), sourced from ASX company filing.
2. "We expect continued growth across all verticals" — CEO Interview Transcript (audio), sourced from BNA editorial recording.
3. "The acquisition was completed on 12 March 2025" — Company Media Release (URL), sourced from corporate newsroom.
\`\`\`

### Structured JSON format (for programmatic parsing)

When the application needs to render references as interactive UI elements (e.g. clickable links, source previews, tooltips), instruct the model to return the references as a JSON array alongside the article. The frontend can then parse and render them independently.

\`\`\`json
{
  "references": [
    {
      "index": 1,
      "claim": "Revenue rose 14 per cent to $48 million",
      "source_title": "FY25 Annual Report",
      "source_type": "pdf",
      "origin": "ASX company filing",
      "source_id": "src_001",
      "url": "https://example.com/fy25-annual-report.pdf"
    },
    {
      "index": 2,
      "claim": "We expect continued growth across all verticals",
      "source_title": "CEO Interview Transcript",
      "source_type": "audio",
      "origin": "BNA editorial recording",
      "source_id": "src_002",
      "url": null
    }
  ]
}
\`\`\`

**Field definitions:**

| Field | Type | Required | Description |
|---|---|---|---|
| \`index\` | integer | Yes | Order of first appearance in the article. |
| \`claim\` | string | Yes | The specific statement, figure, or quote used. |
| \`source_title\` | string | Yes | Name or headline of the hard source. |
| \`source_type\` | string | Yes | One of: \`url\`, \`pdf\`, \`docx\`, \`image\`, \`audio\`, \`pasted_text\`, \`text_file\`. |
| \`origin\` | string | Yes | Where the source came from (e.g. ASX announcement, media release). |
| \`source_id\` | string | Yes | Internal ID matching the source in the Source Manager. |
| \`url\` | string or null | No | Direct link if the source is a URL or has a public link. Null otherwise. |

---

## 7. Implementation — JS Integration

InsightWire's backend is hardcoded in JavaScript. This section defines how Genesis (the developer) should load and segment these rules at runtime.

### Loading the prompt files

Maintain two separate markdown files:

1. **\`insightwire_workflow.md\`** — this document. Governs source handling, brief logic, and references.
2. **\`bna_style_guide.md\`** — the BNA editorial style guide. Governs tone, structure, headline conventions, attribution style, and formatting.

Load both files at application startup or build time and store them as string constants. Do not inline them as string literals in the JS source — read from the filesystem so either file can be updated without code changes.

### Prompt segmentation by stage

Not every API call needs the full document. Send only the sections relevant to the current stage to keep token usage efficient.

| Stage | Sections to include in system prompt |
|---|---|
| **Brief generation** | Section 2 (Hard Sources) + Section 4 (Brief Generation) |
| **Soft source suggestions** | Section 2 (Hard Sources) + Section 3 (Soft Sources) |
| **Article generation** | Section 2 (Hard Sources) + Section 5 (Article Generation) + Section 6 (References) + full BNA style guide |
| **Revision / rewrite** | Same as article generation, plus the writer's revision instructions as a user message |

### Hard source injection

When calling the API, pass hard source content as user messages — not as part of the system prompt. This keeps the system prompt stable across calls and makes source content easy to swap.

### Structured output handling

For article generation, instruct the model to return its response in two clearly separated blocks: the article body (as markdown) and the references (as JSON). Split on a delimiter or use a structured output instruction.

The model should wrap the JSON in a fenced code block tagged \`json:references\`:

Return the article as markdown. After the article, return the references as a JSON array inside a fenced code block tagged \`json:references\`. Do not include the references in the article body.

### Source ID mapping

Each hard source in the Source Manager should have a stable \`source_id\` (e.g. \`src_001\`). Pass this ID alongside the source content so the model can reference it in the structured JSON output. This allows the frontend to link references back to the original source in the Source Manager panel.

---

## 8. Quick Reference

| Stage | Source basis | Trigger |
|---|---|---|
| Source loading | Writer uploads hard sources | Manual |
| Brief generation | Hard sources only | Automatic after sources loaded |
| Soft source suggestions | AI recommendation (not used in output) | Automatic after brief generated |
| Soft source promotion | Writer approves → becomes hard source | Manual |
| Article generation | Hard sources only | Writer confirms brief |
| References section | Hard sources only | Automatic with article |

### Core constraints

- **Hard sources only.** No external knowledge. No inference. No gap-filling.
- **Soft sources are inert.** They do not exist in the article pipeline until promoted.
- **Brief before article.** Never generate an article without a confirmed brief.
- **Contradictions are surfaced, not resolved.** The writer decides.
- **Every claim is traceable.** If it cannot be mapped to a hard source, it does not appear in the article.
- **Australian English throughout.** Spell accordingly (e.g. organised, recognised, labour, colour).`;

export default INSIGHTWIRE_WORKFLOW;

// Pre-split sections for prompt segmentation
export const WORKFLOW_SECTIONS = {
  HARD_SOURCES: INSIGHTWIRE_WORKFLOW.split('## 2. Hard Sources')[1]?.split('## 3. Soft Sources')[0]?.trim() ?? '',
  SOFT_SOURCES: INSIGHTWIRE_WORKFLOW.split('## 3. Soft Sources')[1]?.split('## 4. Brief Generation')[0]?.trim() ?? '',
  BRIEF_GENERATION: INSIGHTWIRE_WORKFLOW.split('## 4. Brief Generation')[1]?.split('## 5. Article Generation')[0]?.trim() ?? '',
  ARTICLE_GENERATION: INSIGHTWIRE_WORKFLOW.split('## 5. Article Generation')[1]?.split('## 6. References Section')[0]?.trim() ?? '',
  REFERENCES: INSIGHTWIRE_WORKFLOW.split('## 6. References Section')[1]?.split('## 7. Implementation')[0]?.trim() ?? '',
};
