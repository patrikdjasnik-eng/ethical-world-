import type { Plugin } from "unified";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

const CALLOUT_TYPES = new Set([
  "NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION", "SUCCESS",
  "QUESTION", "FAILURE", "DANGER", "BUG", "EXAMPLE", "QUOTE",
  "ABSTRACT", "TODO"
]);


function makeInlineNode(value: string, className: string): MarkdownNode {
  return {
    type: "obsidianTag",
    children: [{ type: "text", value }],
    data: {
      hName: "span",
      hProperties: { className: [className], "data-value": value }
    }
  };
}

function transformText(node: MarkdownNode): MarkdownNode[] {
  const value = node.value ?? "";
  const pattern = /(==([^=\n]+)==|(^|[\s([{])#([\p{L}\p{N}_/-]+))/gu;
  const result: MarkdownNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ type: "text", value: value.slice(cursor, index) });

    if (match[2] !== undefined) {
      result.push({
        type: "obsidianHighlight",
        children: [{ type: "text", value: match[2] }],
        data: { hName: "mark", hProperties: { className: ["markdown-highlight"] } }
      });
    } else {
      const prefix = match[3] ?? "";
      if (prefix) result.push({ type: "text", value: prefix });
      const tag = match[4] ?? "";
      result.push(makeInlineNode("#" + tag, "markdown-tag"));
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
  return result.length ? result : [node];
}

function transformNode(node: MarkdownNode): void {
  if (node.type === "blockquote" && node.children?.length) {
    const firstParagraph = node.children[0];
    if (firstParagraph.type === "paragraph" && firstParagraph.children?.length) {
      const firstTextIndex = firstParagraph.children.findIndex((child) =>
        child.type === "text" && /^\s*\[![A-Z]+\]/i.test(child.value ?? "")
      );
      const firstText = firstTextIndex >= 0 ? firstParagraph.children[firstTextIndex] : null;
      const marker = firstText
        ? /^\s*\[!([A-Z]+)\](?:[ \t]+([^\n]*))?/i.exec(firstText.value ?? "")
        : null;
      const type = marker?.[1]?.toUpperCase();

      if (marker && type && CALLOUT_TYPES.has(type) && firstText) {
        node.data = {
          ...node.data,
          hName: "aside",
          hProperties: {
            ...(node.data?.hProperties ?? {}),
            className: ["markdown-callout", "callout-" + type.toLowerCase()],
            "data-callout": type.toLowerCase()
          }
        };

        const remainder = (firstText.value ?? "").slice(marker[0].length);
        const newline = remainder.indexOf("\n");
        firstText.value = newline >= 0 ? remainder.slice(newline + 1) : remainder;
        const title = marker[2]?.trim();
        if (!firstText.value) {
          firstParagraph.children.splice(firstTextIndex, 1);
          if (firstParagraph.children[firstTextIndex]?.type === "break") {
            firstParagraph.children.splice(firstTextIndex, 1);
          }
        }
        if (title) {
          firstParagraph.children.unshift({
            type: "strong",
            children: [{ type: "text", value: title }]
          });
        }
      }
    }
  }

  if (!node.children) return;
  const next: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      next.push(...transformText(child));
    } else {
      transformNode(child);
      next.push(child);
    }
  }
  node.children = next;
}

export const remarkObsidian: Plugin = () => (tree) => {
  transformNode(tree as MarkdownNode);
};
