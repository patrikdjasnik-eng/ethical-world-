import { memo, useState } from "react";

export const RemoteImage = memo(function RemoteImage({ src, alt }: { src?: string; alt?: string }) {
  const [allowed, setAllowed] = useState(false);
  if (!src || !/^https:\/\//i.test(src)) return <span>{alt || "Obrázek"}</span>;
  if (allowed) return <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" loading="lazy" />;
  return <button type="button" className="remote-image-placeholder" onClick={() => setAllowed(true)}>
    Načíst vzdálený obrázek: {alt || "obrázek"}
  </button>;
});
