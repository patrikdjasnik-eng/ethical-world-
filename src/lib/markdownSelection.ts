import type { MarkdownFile } from "./markdownConnector";

export const maxMarkdownFiles = 100_000;
const maxFileBytes = 2 * 1024 * 1024;

export async function readMarkdownSelection(files: File[], onProgress?: (count: number) => void): Promise<MarkdownFile[]> {
  if (files.length > maxMarkdownFiles) throw new Error("Najednou lze importovat nejvýše 100 000 Markdown souborů.");
  for (const file of files) {
    if (!/\.(md|mdx)$/i.test(file.name)) throw new Error("Soubor „" + file.name + "“ není Markdown (.md nebo .mdx).");
    if (file.size > maxFileBytes) throw new Error("Soubor „" + file.name + "“ přesahuje limit 2 MiB. Žádné soubory nebyly importovány.");
  }
  const result: MarkdownFile[] = [];
  for (let index = 0; index < files.length; index += 8) {
    const batch = await Promise.all(files.slice(index, index + 8).map(async (file) => ({
      relativePath: file.webkitRelativePath || file.name,
      content: await file.text()
    })));
    result.push(...batch);
    if (result.length % 128 === 0 || result.length === files.length) {
      onProgress?.(result.length);
      // Give the renderer a chance to paint progress during large imports.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  return result;
}
