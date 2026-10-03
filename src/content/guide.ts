export type GuideLanguage = "cs" | "en";

export interface GuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  tips?: string[];
}

export interface ProductUpdate {
  version: string;
  date: string;
  title: Record<GuideLanguage, string>;
  items: Record<GuideLanguage, string[]>;
}

export const guideSections: Record<GuideLanguage, GuideSection[]> = {
  cs: [
    {
      id: "start",
      title: "Začínáme",
      paragraphs: [
        "Ethical World je local-first knowledge workspace. Poznámky, složky, wiki odkazy, graph, konektory a Máša žijí v jednom pracovním prostředí.",
        "Pro lokální AI stačí mít Ollamu s modelem masa-cyber. Desktop si FastAPI gateway na portu 8787 spouští automaticky; v dev režimu proto stačí npm run desktop:dev."
      ],
      tips: [
        "Ctrl+N vytvoří poznámku.",
        "Ctrl+Shift+N vytvoří složku.",
        "Ctrl+B přepne Files panel.",
        "Ctrl+J přepne Mášu."
      ]
    },
    {
      id: "masha",
      title: "Máša",
      paragraphs: [
        "READ režim pouze odpovídá a analyzuje. ASSIST režim může připravovat změny v Ethical World, ale zapisovací akce čekají na tvoje potvrzení.",
        "Máša umí běžné technické otázky, programování, databáze, Linux/Windows, sítě a široké cybersecurity vzdělávání včetně ofenzivních a defenzivních konceptů."
      ],
      tips: [
        "Enter odešle zprávu, Shift+Enter vloží nový řádek.",
        "Odpověď Máši lze zkopírovat přímo z chatu."
      ]
    },
    {
      id: "knowledge-notes",
      title: "Knowledge Notes",
      paragraphs: [
        "Požádej Mášu například: „Vytvoř kompletní MD poznámku o OAuth 2.0.“ Máša přepne do Knowledge Note mode a připraví celý dokument.",
        "Podle tématu sama rozhoduje o vhodnosti Mermaid diagramu, Prisma schema, code blocků, tabulek a checklistů. Každá její knowledge note dostane Ethical World badge hlavičku."
      ],
      tips: [
        "Wiki odkazy [[Název poznámky]] používá jen na existující poznámky ve vaultu.",
        "Schémata se přidávají jen tehdy, když skutečně pomáhají vysvětlení."
      ]
    },
    {
      id: "connectors",
      title: "Connectors",
      paragraphs: [
        "Local / VS Code connector importuje a exportuje pouze .md a .mdx. Projektové soubory, node_modules, .git a build výstupy ignoruje.",
        "GitHub connector používá Device OAuth a synchronizuje Markdown přes API bez klonování celého repozitáře. Notion connector používá server-side OAuth a enhanced Markdown API pro import i zápis zpět."
      ]
    },
    {
      id: "identity-security",
      title: "Účty a bezpečnost",
      paragraphs: [
        "Lokální identity databáze používá SQLite. První start vytvoří owner účet a zamkne aplikaci, dokud owner nenastaví vlastní heslo. Hesla se ukládají jako scrypt verifier se saltem a session tokeny jsou v databázi pouze hashované.",
        "Desktop secrets používají OS secure storage. Budoucí private messaging je navržený tak, aby server ukládal pouze ciphertext a E2E vrstva používala auditovaný protokol."
      ]
    }
  ],
  en: [
    {
      id: "start",
      title: "Getting started",
      paragraphs: [
        "Ethical World is a local-first knowledge workspace. Notes, folders, wiki links, graph, connectors and Masha live in one workbench.",
        "For local AI, keep Ollama available with the masa-cyber model. The desktop app starts the FastAPI gateway on port 8787 automatically, so desktop development only needs npm run desktop:dev."
      ],
      tips: [
        "Ctrl+N creates a note.",
        "Ctrl+Shift+N creates a folder.",
        "Ctrl+B toggles the Files panel.",
        "Ctrl+J toggles Masha."
      ]
    },
    {
      id: "masha",
      title: "Masha",
      paragraphs: [
        "READ mode only answers and analyzes. ASSIST mode can prepare changes in Ethical World, but write actions wait for your approval.",
        "Masha handles general technical questions, programming, databases, Linux/Windows, networking and broad cybersecurity education including offensive and defensive concepts."
      ],
      tips: [
        "Enter sends a message, Shift+Enter inserts a new line.",
        "Masha responses can be copied directly from chat."
      ]
    },
    {
      id: "knowledge-notes",
      title: "Knowledge Notes",
      paragraphs: [
        "Ask Masha, for example: “Create a complete Markdown note about OAuth 2.0.” Masha switches to Knowledge Note mode and prepares a full document.",
        "Based on the topic, she decides whether Mermaid diagrams, Prisma schemas, code blocks, tables or checklists are useful. Every generated knowledge note receives the Ethical World badge header."
      ],
      tips: [
        "Wiki links [[Note title]] are created only for notes that actually exist in the vault.",
        "Schemas are inserted only when they improve the explanation."
      ]
    },
    {
      id: "connectors",
      title: "Connectors",
      paragraphs: [
        "The Local / VS Code connector imports and exports only .md and .mdx files. Project sources, node_modules, .git and build outputs are ignored.",
        "The GitHub connector uses Device OAuth and synchronizes Markdown through the API without cloning the whole repository. The Notion connector uses server-side OAuth and the enhanced Markdown API for import and write-back."
      ]
    },
    {
      id: "identity-security",
      title: "Accounts and security",
      paragraphs: [
        "The local identity database uses SQLite. First start creates an owner account and locks the app until the owner chooses a personal password. Passwords are stored as salted scrypt verifiers and database sessions keep only token hashes.",
        "Desktop secrets use OS secure storage. Future private messaging is designed so the server stores ciphertext only and the E2E layer uses an audited protocol."
      ]
    }
  ]
};

export const productUpdates: ProductUpdate[] = [
  {
    version: "0.1-dev.7",
    date: "2026-10-04",
    title: {
      cs: "Standalone desktop, Notion a owner onboarding",
      en: "Standalone desktop, Notion and owner onboarding"
    },
    items: {
      cs: [
        "Desktop automaticky spouští lokální backend; standalone build umí přibalit vlastní backend EXE.",
        "GitHub Device OAuth používá zabudovaný veřejný Client ID.",
        "Notion OAuth podporuje výběr stránky, Markdown import a zápis obsahu zpět.",
        "První start vytvoří owner účet a vynutí nastavení vlastního hesla.",
        "Máša je kompaktní spodní dock a už nezmenšuje editor.",
        "Nový Ethical World SVG mark je v topbaru, Identity a faviconu."
      ],
      en: [
        "Desktop starts the local backend automatically and the standalone build can bundle its own backend executable.",
        "GitHub Device OAuth uses the embedded public Client ID.",
        "Notion OAuth supports page selection, Markdown import and write-back.",
        "First start creates an owner account and forces a personal password.",
        "Masha is now a compact bottom dock and no longer shrinks the editor.",
        "The new Ethical World SVG mark is used in the top bar, Identity and favicon."
      ]
    }
  },
  {
    version: "0.1-dev.6",
    date: "2026-10-03",
    title: {
      cs: "Máša Knowledge Engineer",
      en: "Masha Knowledge Engineer"
    },
    items: {
      cs: [
        "Kompletní Markdown knowledge notes přes raw Markdown envelope.",
        "Automatické Ethical World badges na AI poznámkách.",
        "Mermaid diagramy, Prisma schema, code blocky, tabulky a checklisty podle kontextu.",
        "Wiki odkazy jsou validované proti existujícím názvům ve vaultu.",
        "Delší output budget pro tvorbu komplexních poznámek."
      ],
      en: [
        "Complete Markdown knowledge notes through a raw Markdown envelope.",
        "Automatic Ethical World badges on AI-authored notes.",
        "Context-aware Mermaid diagrams, Prisma schemas, code blocks, tables and checklists.",
        "Wiki links are validated against existing vault note titles.",
        "Larger output budget for complex note generation."
      ]
    }
  },
  {
    version: "0.1-dev.5",
    date: "2026-10-03",
    title: {
      cs: "Connectors a identity",
      en: "Connectors and identity"
    },
    items: {
      cs: [
        "Local / VS Code Markdown import a export.",
        "GitHub Device OAuth a Markdown-only synchronizace.",
        "SQLite users DB, scrypt hesla a secure desktop session."
      ],
      en: [
        "Local / VS Code Markdown import and export.",
        "GitHub Device OAuth and Markdown-only sync.",
        "SQLite users DB, scrypt passwords and secure desktop session."
      ]
    }
  },
  {
    version: "0.1-dev.4",
    date: "2026-10-03",
    title: {
      cs: "Máša agent tools",
      en: "Masha agent tools"
    },
    items: {
      cs: [
        "READ a ASSIST permissions.",
        "Vytváření a úpravy poznámek, vytváření složek a otevírání notes po potvrzení."
      ],
      en: [
        "READ and ASSIST permissions.",
        "Approved note creation/editing, folder creation and note opening."
      ]
    }
  }
];
