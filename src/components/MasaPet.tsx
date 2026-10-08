import { memo, useState } from "react";
import { masaPetLabels, type MasaPetState } from "../lib/masaPet";
import "./masaPet.css";

const sharkImage = new URL("../assets/masa-shark.png", import.meta.url).href;

export const MasaPetPortrait = memo(function MasaPetPortrait({ state }: { state: MasaPetState }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className={`masa-pet-portrait masa-pet-${state}`} aria-hidden="true">
      {imageFailed ? <span className="masa-pet-fallback">🦈</span> : (
        <img src={sharkImage} alt="" draggable={false} onError={() => setImageFailed(true)} />
      )}
    </span>
  );
});

interface MasaPetProps {
  state: MasaPetState;
  onOpen: () => void;
  onHide: () => void;
}

export const MasaPet = memo(function MasaPet({ state, onOpen, onHide }: MasaPetProps) {
  const label = masaPetLabels[state];

  return (
    <div className="masa-pet-dock" data-state={state}>
      <button className="masa-pet-hide" type="button" onClick={onHide} aria-label="Skrýt postavičku Máši" title="Skrýt postavičku Máši">×</button>
      <button className="masa-pet-launcher" type="button" onClick={onOpen} aria-label={`Otevřít Mášu · ${label}`} title="Otevřít Mášu (Ctrl+J)">
        <MasaPetPortrait state={state} />
        <span className="masa-pet-caption"><strong>Máša</strong><span>{label}</span></span>
      </button>
    </div>
  );
});
