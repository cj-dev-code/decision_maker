"use client";

import ToolStrip from "@/components/ToolStrip";
import ToolPanel from "@/components/ToolPanel";
import LLMDialog from "@/components/LLMDialogue"; // ✅ fixed import path
import { PRE_META } from "@/components/tools/registry";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const sp = useSearchParams();
  const selectedTool = sp.get("tool") || PRE_META[0].slug;

  return (
    // takes the height given by layout (flex-1 min-h-0)
    <div className="h-full grid grid-rows-3 gap-3">
      {/* Row 1: tool strip (horizontal scroll) */}
      <div className="min-h-0 overflow-x-auto">
        <ToolStrip toolsMeta={PRE_META}/>
      </div>

      {/* Row 3: selected tool panel */}
      <div className="min-h-0 overflow-auto border rounded">
        <ToolPanel toolsMeta={PRE_META} />
      </div>

      {/* Row 2: LLM dialogue */}
      <div className="min-h-0 overflow-hidden">
        {/* Pass the URL-synced tool into the dialog so it can save-on-switch + open matching chat */}
        <LLMDialog tool={selectedTool} />
      </div>
    </div>
  );
}
