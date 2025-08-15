// app/decision/[id]/pre/page.jsx
"use client";

import ToolStrip from "@/components/ToolStrip";
import ToolPanel from "@/components/ToolPanel";
import LLMDialogue from "@/components/LLMDialogue";
import { PRE_META } from "@/components/tools/registry";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const sp = useSearchParams();
  const selectedTool = sp.get("tool") || PRE_META[0].slug;
  const axis = sp.get("axis") || undefined;
  const chatTool = sp.get("chattool") || selectedTool;

  return (
    <div className="h-full grid grid-rows-3 gap-3">
      <div className="min-h-0 overflow-x-auto">
        <ToolStrip toolsMeta={PRE_META}/>
      </div>
      <div className="min-h-0 overflow-auto border rounded">
        <ToolPanel toolsMeta={PRE_META} />
      </div>
      <div className="min-h-0 overflow-hidden">
        <LLMDialogue tool={chatTool} axis={axis} />
      </div>
    </div>
  );
}
