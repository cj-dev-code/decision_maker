// components/tools/index.js
import SmartGoal from "./SmartGoal";
import DecisionExplorer from "./DecisionExplorer";
import DecisionMultiverse from "./DecisionMultiverse";
import DecisionStacker from "./DecisionStacker";
import PerspectiveTracker from "./PerspectiveTracker";
import OptionExplorer from "./OptionExplorer";

// ---- Post stubs (make simple components if you don't have these yet)
import Unresulter from "./Unresulter"
import Debriefer from "./Debriefer"
import LuckVsSkiller from "./LuckVsSkiller";



export const PRE_TOOLS = [
  { slug: "smart-goal", label: "Smart Goal", Comp: SmartGoal },
  { slug: "decision-multiverse", label: "Decision Multiverse", Comp: DecisionMultiverse },
  { slug: "decision-stacker", label: "Decision Stacker", Comp: DecisionStacker },
  { slug: "decision-exploration", label: "Decision Exploration", Comp: DecisionExplorer },
  { slug: "perspective-tracking", label: "Perspective Tracking", Comp: PerspectiveTracker },
  { slug: "option-exploration", label: "Option Exploration", Comp: OptionExplorer },
];

export const POST_TOOLS = [
  { slug: "resulting",           label:"Unresulter",              Comp: Unresulter},
  { slug: "debrief",             label: "Decision Debrief",       Comp: Debriefer },
  { slug: "luck-vs-skill",       label: "Luck vs Skill",          Comp: LuckVsSkiller },
//  { slug: "lessons",             label: "Lessons Learned",        Comp: Lessons },
//  { slug: "next-actions",        label: "Next Actions",           Comp: NextActions },
];