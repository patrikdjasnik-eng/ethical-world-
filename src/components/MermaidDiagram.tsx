import { memo, useEffect, useId, useState } from "react";

interface MermaidDiagramProps {
  source: string;
}

export const MermaidDiagram = memo(function MermaidDiagram({ source }: MermaidDiagramProps) {
  const reactId = useId();
  const renderId = "ethical-mermaid-" + reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      setSvg("");
      setError(null);

      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          suppressErrorRendering: true,
          maxTextSize: 50_000,
          maxEdges: 500
        });

        const result = await mermaid.render(renderId, source);
        if (!cancelled) setSvg(result.svg);
      } catch (reason) {
        if (!cancelled) {
          const message = reason instanceof Error ? reason.message : "Neplatná Mermaid syntaxe.";
          setError(message);
        }
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [renderId, source]);

  if (error) {
    return (
      <figure className="mermaid-diagram mermaid-error">
        <figcaption>Mermaid diagram se nepodařilo vykreslit · {error}</figcaption>
        <pre><code className="language-mermaid">{source}</code></pre>
      </figure>
    );
  }

  if (!svg) {
    return <div className="mermaid-diagram mermaid-loading">Vykresluji Mermaid diagram…</div>;
  }

  return (
    <figure className="mermaid-diagram">
      <div className="mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
});
