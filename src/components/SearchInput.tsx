"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Buscar..."}
        className="w-72 rounded-lg border bg-surface py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
