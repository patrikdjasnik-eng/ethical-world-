import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkObsidian } from "./remarkObsidian";

function renderMarkdown(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm, remarkObsidian] },
      markdown
    )
  );
}

describe("remarkObsidian", () => {
  it("renders hashtag labels as visible badges", () => {
    const html = renderMarkdown("Projekt #important a #projekt/ethics");

    expect(html).toContain('class="markdown-tag"');
    expect(html).toContain("#important");
    expect(html).toContain("#projekt/ethics");
  });

  it("renders Obsidian highlight syntax", () => {
    const html = renderMarkdown("Toto je ==důležitý text==.");

    expect(html).toContain('<mark class="markdown-highlight">důležitý text</mark>');
  });

  it("renders multi-line callouts and removes the source marker", () => {
    const html = renderMarkdown("> [!WARNING]\n> Pozor na tento krok.");

    expect(html).toContain('class="markdown-callout callout-warning"');
    expect(html).toContain("Pozor na tento krok.");
    expect(html).not.toContain("[!WARNING]");
  });
});
