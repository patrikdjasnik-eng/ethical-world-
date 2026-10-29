const mermaidLanguagePattern = /(?:^|\s)language-mermaid(?:\s|$)/i;
const maxMermaidSourceLength = 50_000;

export function normalizeMermaidSource(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\n$/, "").trim();
}

export function mermaidSourceFromCode(className: string | undefined, value: string): string | null {
  if (!className || !mermaidLanguagePattern.test(className)) return null;

  const source = normalizeMermaidSource(value);
  if (!source || source.length > maxMermaidSourceLength) return null;
  return source;
}
