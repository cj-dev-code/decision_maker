// components/ToolPanel.jsx
"use client";

import { useSearchParams } from "next/navigation";
import { TOOLS } from "./tools";

export default function ToolPanel() {
  const searchParams = useSearchParams();
  const selected = searchParams.get("tool") || TOOLS[0].slug;
  const match = TOOLS.find((t) => t.slug === selected) || TOOLS[0];
  const Comp = match.Comp;

  return (
    <div className="mt-4 border rounded p-4 min-h-[50vh]">
      <Comp />
    </div>
  );
}
