"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// map slugs -> dynamic imports (default exports)
const Comps = {
  "smart-goal":           dynamic(() => import("./tools/SmartGoal"), { ssr: false }),
  "decision-multiverse": dynamic(() => import("./tools/DecisionMultiverse"), { ssr: false }),
  "decision-stacker":    dynamic(() => import("./tools/DecisionStacker")),
  "decision-exploration":dynamic(() => import("./tools/DecisionExplorer")),
  "perspective-tracking":dynamic(() => import("./tools/PerspectiveTracker")),
  "option-exploration":  dynamic(() => import("./tools/OptionExplorer")),
  // post tools
  "resulting":           dynamic(() => import("./tools/Unresulter")),
  "debrief":             dynamic(() => import("./tools/Debriefer")),
  "luck-vs-skill":       dynamic(() => import("./tools/LuckVsSkiller")),
};

export default function ToolPanel({ toolsMeta }) {
  const sp = useSearchParams();
  const selected = sp.get("tool") || toolsMeta[0].slug;
  const Comp = Comps[selected] ?? (() => <div>Tool not found: {selected}</div>);
  return (
    <div className="h-full">
      <Comp />
    </div>
  );
}
