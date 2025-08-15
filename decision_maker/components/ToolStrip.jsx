// components/ToolStrip.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ToolStrip({ toolsMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const selected = sp.get("tool") || toolsMeta[0].slug;
  const activeAxis = sp.get("axis") || "";

  // ---- axes state (populated by backend via window event) ----
  const [axes, setAxes] = useState([]);
  useEffect(() => {
    const onUpdate = (e) => setAxes(Array.isArray(e.detail) ? e.detail : []);
    window.addEventListener("axes:update", onUpdate);
    return () => window.removeEventListener("axes:update", onUpdate);
  }, []);

  const selectTool = (slug) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("tool", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const selectAxis = (axisKey) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (axisKey) params.set("axis", axisKey); else params.delete("axis");
    // Jump straight into Speed Check for this axis
    params.set("tool", "speed_checker");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Render Axes card (2nd position)
  const AxesCard = (
    <div className="w-full h-full border p-3 rounded snap-start shrink-0 bg-white">
      <div className="text-sm font-medium mb-2">Axes</div>
      <div className="flex items-center gap-2">
        {/* active badge */}
        {activeAxis && (
          <span className="text-xs px-2 py-0.5 border rounded bg-indigo-50 border-indigo-300">
            {activeAxis}
          </span>
        )}
        <select
          className="border rounded px-2 py-1 text-sm"
          value={activeAxis || ""}
          onChange={(e) => selectAxis(e.target.value)}
        >
          <option value="">{axes.length ? "— Select axis —" : "No axes yet"}</option>
          {axes.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  // tools with Axes injected after index 0
  const cards = useMemo(() => {
    const rendered = [];
    toolsMeta.forEach((t, i) => {
      if (i === 1) rendered.push({ kind: "axes" });
      rendered.push({ kind: "tool", t });
    });
    // if there is only 1 tool, still inject axes at the end
    if (toolsMeta.length === 1) rendered.push({ kind: "axes" });
    return rendered;
  }, [toolsMeta]);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[minmax(180px,20vw)] gap-3 snap-x snap-mandatory px-4 py-3">
        {cards.map((item, idx) =>
          item.kind === "axes" ? (
            <div key={`axes-${idx}`}>{AxesCard}</div>
          ) : (
            <button
              key={item.t.slug}
              onClick={() => selectTool(item.t.slug)}
              className={classNames(
                "w-full h-full border p-3 snap-start shrink-0 rounded text-left transition bg-white",
                selected === item.t.slug ? "ring-2 ring-blue-500" : "hover:bg-gray-50"
              )}
            >
              {item.t.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
