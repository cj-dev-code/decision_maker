import ToolStrip from "@/components/ToolStrip";
import ToolPanel from "@/components/ToolPanel";
import LLMDialog from "@/components/LLMDialogue";
import { POST_META } from "@/components/tools/registry";

export default function Page() {
  return (
    <div className="h-full grid grid-rows-3 gap-3">
      <div className="min-h-0 overflow-x-auto"><ToolStrip toolsMeta={POST_META} /></div>
      <div className="min-h-0 overflow-auto border rounded"><ToolPanel toolsMeta={POST_META} /></div>
      <div className="min-h-0 overflow-hidden"><LLMDialog tool="speed_checker"/></div>
    </div>
  );
}