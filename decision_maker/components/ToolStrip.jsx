"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function ToolStrip({ toolsMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selected = sp.get("tool") || toolsMeta[0].slug;

  const select = (slug) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("tool", slug);
    // keep scroll position & avoid full navigation
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[minmax(180px,20vw)] gap-3 snap-x snap-mandatory px-4 py-3">
        {toolsMeta.map((t) => (
          <button
            key={t.slug}
            onClick={() => select(t.slug)}
            className={`w-full h-full border p-3 snap-start shrink-0 rounded text-left transition
              ${selected === t.slug ? "ring-2 ring-blue-500" : "hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
