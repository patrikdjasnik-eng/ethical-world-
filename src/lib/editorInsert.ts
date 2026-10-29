export type MarkdownInsertRequest =
  | { kind: "wiki-link"; title: string }
  | { kind: "code"; language: string }
  | { kind: "task" }
  | { kind: "callout"; calloutType: "NOTE" | "TIP" | "WARNING" | "INFO" }
  | { kind: "quote" }
  | { kind: "table" }
  | { kind: "divider" }
  | { kind: "heading"; level: 2 | 3 }
  | { kind: "inline-code" };

export interface MarkdownInsertResult {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

function clampRange(content: string, start: number, end: number): [number, number] {
  const safeStart = Math.max(0, Math.min(start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(end, content.length));
  return [safeStart, safeEnd];
}

function prefixLines(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function applyMarkdownInsert(
  content: string,
  start: number,
  end: number,
  request: MarkdownInsertRequest
): MarkdownInsertResult {
  const [safeStart, safeEnd] = clampRange(content, start, end);
  const selected = content.slice(safeStart, safeEnd);
  let inserted = "";
  let cursorOffset = 0;

  switch (request.kind) {
    case "wiki-link":
      inserted = `[[${request.title}]]`;
      cursorOffset = inserted.length;
      break;

    case "code": {
      const opening = "```" + request.language + "\n";
      const body = selected || "";
      inserted = opening + body + "\n```";
      cursorOffset = selected ? inserted.length : opening.length;
      break;
    }

    case "task":
      inserted = selected ? prefixLines(selected, "- [ ] ") : "- [ ] ";
      cursorOffset = inserted.length;
      break;

    case "callout": {
      const body = selected ? prefixLines(selected, "> ") : "> ";
      inserted = `> [!${request.calloutType}]\n${body}`;
      cursorOffset = inserted.length;
      break;
    }

    case "quote":
      inserted = selected ? prefixLines(selected, "> ") : "> ";
      cursorOffset = inserted.length;
      break;

    case "table":
      inserted = "| Sloupec 1 | Sloupec 2 |\n| --- | --- |\n| Hodnota | Hodnota |";
      cursorOffset = inserted.length;
      break;

    case "divider":
      inserted = "\n---\n";
      cursorOffset = inserted.length;
      break;

    case "heading": {
      const prefix = "#".repeat(request.level);
      inserted = selected ? `${prefix} ${selected}` : `${prefix} `;
      cursorOffset = inserted.length;
      break;
    }

    case "inline-code":
      inserted = selected ? "`" + selected + "`" : "``";
      cursorOffset = selected ? inserted.length : 1;
      break;
  }

  const nextContent = `${content.slice(0, safeStart)}${inserted}${content.slice(safeEnd)}`;
  const cursor = safeStart + cursorOffset;

  return {
    content: nextContent,
    selectionStart: cursor,
    selectionEnd: cursor
  };
}
