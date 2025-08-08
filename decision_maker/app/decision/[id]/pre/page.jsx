import ToolStrip from "@/components/ToolStrip";
import ToolPanel from "@/components/ToolPanel";
import LLMDialog from "@/components/LLMDialogue";
import { PRE_META } from "@/components/tools/registry";

export default function Page() {
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
        <LLMDialog />
      </div>


    </div>
  );
}
