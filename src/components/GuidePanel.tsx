import { memo, useMemo, useState } from "react";
import {
  guideSections,
  productUpdates,
  type GuideLanguage
} from "../content/guide";

type GuideTab = "guide" | "updates";

export const GuidePanel = memo(function GuidePanel() {
  const [language, setLanguage] = useState<GuideLanguage>("cs");
  const [tab, setTab] = useState<GuideTab>("guide");

  const copy = useMemo(() => ({
    guide: language === "cs" ? "Návod" : "Guide",
    updates: "Updates",
    subtitle: language === "cs"
      ? "Živý návod k Ethical World. Aktualizujeme ho spolu s funkcemi."
      : "A living Ethical World guide, updated together with the product.",
    latest: language === "cs" ? "Nejnovější změny" : "Latest changes"
  }), [language]);

  return (
    <main className="guide-pane">
      <section className="guide-shell">
        <header className="guide-heading">
          <div>
            <span>ETHICAL WORLD</span>
            <h1>{copy.guide}</h1>
            <p>{copy.subtitle}</p>
          </div>

          <div className="guide-language">
            <button
              type="button"
              className={language === "cs" ? "active" : ""}
              onClick={() => setLanguage("cs")}
            >
              CZ
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
        </header>

        <div className="guide-tabs">
          <button type="button" className={tab === "guide" ? "active" : ""} onClick={() => setTab("guide")}>
            {copy.guide}
          </button>
          <button type="button" className={tab === "updates" ? "active" : ""} onClick={() => setTab("updates")}>
            {copy.updates}
          </button>
        </div>

        {tab === "guide" ? (
          <div className="guide-sections">
            {guideSections[language].map((section) => (
              <article className="guide-card" key={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.tips && (
                  <div className="guide-tips">
                    {section.tips.map((tip) => <span key={tip}>• {tip}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="updates-list">
            <div className="updates-title">{copy.latest}</div>
            {productUpdates.map((update) => (
              <article className="update-card" key={update.version}>
                <div className="update-meta">
                  <strong>{update.version}</strong>
                  <span>{update.date}</span>
                </div>
                <h2>{update.title[language]}</h2>
                <div className="update-items">
                  {update.items[language].map((item) => <span key={item}>✓ {item}</span>)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
});

export default GuidePanel;
