export type MasaPetState = "idle" | "thinking" | "speaking" | "proposal" | "working" | "offline" | "error";

export const masaPetLabels: Record<MasaPetState, string> = {
  idle: "Jsem tady",
  thinking: "Přemýšlím…",
  speaking: "Píšu odpověď…",
  proposal: "Mám návrh ke kontrole",
  working: "Ukládám změnu…",
  offline: "Čekám na připojení",
  error: "Potřebuju tvoji pozornost"
};

interface MasaActivity {
  sending: boolean;
  streaming: boolean;
  applying: boolean;
  error: boolean;
  pending: boolean;
  checking: boolean;
  online: boolean;
}

export function getMasaPetState(activity: MasaActivity): MasaPetState {
  if (activity.applying) return "working";
  if (activity.sending) return activity.streaming ? "speaking" : "thinking";
  if (activity.error) return "error";
  if (activity.pending) return "proposal";
  if (activity.checking) return "thinking";
  return activity.online ? "idle" : "offline";
}
