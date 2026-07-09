"use client";

import { useState } from "react";
import { Plane } from "lucide-react";

/** Logo da Iza Travel. Usa /logo.png (suba o arquivo em public/logo.png);
 *  enquanto não existir, mostra um fallback com a marca. */
export default function Logo({ height = 36 }: { height?: number }) {
  const [ok, setOk] = useState(true);

  if (ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt="Iza Travel"
        style={{ height }}
        className="w-auto object-contain"
        onError={() => setOk(false)}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
        <Plane size={20} />
      </span>
      <span className="text-lg font-bold tracking-tight text-primary-strong">
        IZA<span className="text-accent">✈</span>
      </span>
    </span>
  );
}
