// components/ToolStrip.jsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TOOLS } from "./tools";

export default function ToolStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("tool") || TOOLS[0].slug;

  const select = (slug) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tool", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[minmax(180px,20vw)] gap-3 snap-x snap-mandatory px-4 py-3">
        {TOOLS.map((t) => (
          <button
            key={t.slug}
            onClick={() => select(t.slug)}
            className={`border p-3 snap-start shrink-0 rounded text-left transition
              ${selected === t.slug ? "ring-2 ring-blue-500" : "hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
