import ToolStrip from "@/components/ToolStrip";
import ToolPanel from "@/components/ToolPanel";
import LLMDialog from "@/components/LLMDialogue";

export default function Page() {
  return (
    // takes the height given by layout (flex-1 min-h-0)
    <div className="h-full grid grid-rows-3 gap-3">
      {/* Row 1: tool strip (horizontal scroll) */}
      <div className="min-h-0 overflow-x-auto">
        <ToolStrip />
      </div>


      {/* Row 3: selected tool panel */}
      <div className="min-h-0 overflow-auto border rounded">
        <ToolPanel />
      </div>
      {/* Row 2: LLM dialogue */}
      <div className="min-h-0 overflow-hidden">
        <LLMDialog />
      </div>


    </div>
  );
}
