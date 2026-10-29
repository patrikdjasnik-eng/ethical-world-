import { memo, useState } from "react";

export const RemoteImage = memo(function RemoteImage({ src, alt }: { src?: string; alt?: string }) {
  const [allowedSrc, setAllowedSrc] = useState<string | null>(null);
  if (!src || !/^https:\/\//i.test(src)) return <span>{alt || "Obrázek"}</span>;
  if (allowedSrc === src) return <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" loading="lazy" />;
  return <button type="button" className="remote-image-placeholder" onClick={() => setAllowedSrc(src)}>
    Načíst vzdálený obrázek: {alt || "obrázek"}
  </button>;
});
