// components/tools/index.js
import DecisionExplorer from "./DecisionExplorer";
import DecisionMultiverse from "./DecisionMultiverse";
import DecisionStacker from "./DecisionStacker";
import PerspectiveTracker from "./PerspectiveTracker";
import OptionExplorer from "./OptionExplorer";

export const TOOLS = [
  { slug: "decision-context", label: "Decision Context", Comp: DecisionMultiverse },
  { slug: "decision-stacker", label: "Decision Stacker", Comp: DecisionStacker },
  { slug: "decision-exploration", label: "Decision Exploration", Comp: DecisionExplorer },
  { slug: "perspective-tracking", label: "Perspective Tracking", Comp: PerspectiveTracker },
  { slug: "option-exploration", label: "Option Exploration", Comp: OptionExplorer },
];
