# backend/main.py
import os
from typing import Optional, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

from flow_engine import load_flows, next_node, first_prompt

# ------------ Setup & Flow Registry ------------
load_dotenv()

FLOWS_DIR = os.path.join(os.path.dirname(__file__), "flows")
FLOW_REGISTRY: Dict[str, dict] = load_flows(FLOWS_DIR)

# Map frontend tool slugs -> flow IDs (YAML 'id' fields)
TOOL_TO_FLOW = {
    # pre / during decision tools
    "smart-goal":            "goal_define",
    "decision-multiverse":   "decision_multiverse",
    "decision-stacker":      "decision_stacker",
    "decision-exploration":  "decision_exploration",
    "perspective-tracking":  "perspective_tracking",
    "option-exploration":    "option_exploration",

    # post/outcome tools
    "resulting":             "resulting",
    "debrief":               "debrief",
    "luck-vs-skill":         "luck_vs_skill",

    # speed checker (example already provided)
    "speed_checker":         "how_fast",

    # legacy/default (in case frontend ever sends this)
    "purpose_finder":        "goal_define",
}

# ------------ LLM Setup ------------
llm = ChatOpenAI(model="gpt-4o", temperature=0)

BASE_SYSTEM = "Ask one targeted question at a time. Be concise and keep momentum."

BASE_TOOL_PROMPTS = {
    "smart-goal":           "Clarify the user's goal and constraints. " + BASE_SYSTEM,
    "decision-multiverse":  "Help the user map plausible best/base/worst cases. " + BASE_SYSTEM,
    "decision-stacker":     "Order decisions to unlock information; start with low-impact prerequisites. " + BASE_SYSTEM,
    "decision-exploration": "Clarify options and key trade-offs. " + BASE_SYSTEM,
    "perspective-tracking": "Collect supportive & skeptical POVs and missing info. " + BASE_SYSTEM,
    "option-exploration":   "Enumerate outcomes (upsides/downsides) for an option. " + BASE_SYSTEM,
    "resulting":            "Separate decision quality from outcomes; capture lessons. " + BASE_SYSTEM,
    "debrief":              "Quick debrief: what worked, what didn’t, one change. " + BASE_SYSTEM,
    "luck-vs-skill":        "Assess contributions of luck vs. skill to outcome. " + BASE_SYSTEM,
    "speed_checker":        "Determine decision speed (reversible? quit cost? shots on goal?). " + BASE_SYSTEM,
}

def system_for(tool: str) -> str:
    return BASE_TOOL_PROMPTS.get(tool, "Be helpful, concise, and ask one question at a time.")

dialogue_prompt = ChatPromptTemplate.from_messages([
    ("system", "{system_text}"),
    ("placeholder", "{history}"),   # history is a list of {role, content}
    ("user", "{message}"),
])

# ------------ FastAPI App ------------
app = FastAPI()

# Allow your Next.js dev server to call this API locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------ Models ------------
class Turn(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []   # [{role, content}]
    tool: Optional[str] = None
    system_override: Optional[str] = None

class FlowReq(BaseModel):
    flow_id: str
    node_id: Optional[str] = None
    answers: dict = {}         # accumulated answers

# ------------ Endpoints ------------
@app.get("/health")
def health():
    return {"ok": True, "flows": sorted(FLOW_REGISTRY.keys())}

@app.post("/dialogue")
def dialogue(t: Turn):
    """
    Chat endpoint:
    - On __init__ with empty history: if tool maps to a flow, return that flow's first prompt.
    - Otherwise, run a simple LLM turn with tool-specific system guidance.
    """
    tool = t.tool or "smart-goal"
    sys_text = t.system_override or system_for(tool)

    # INIT: for new sessions, prefer the mapped flow's opening prompt
    if t.message == "__init__" and not t.history:
        flow_id = TOOL_TO_FLOW.get(tool)
        if flow_id and flow_id in FLOW_REGISTRY:
            opener = first_prompt(FLOW_REGISTRY[flow_id])
            return {"reply": opener}

        # last-resort opener if no flow exists
        fallback_openers = {
            "smart-goal":          "What are you trying to accomplish?",
            "option-exploration":  "What decision are we exploring, in one sentence?",
            "speed_checker":       "Quick check: what's the decision? I’ll run the speed test next.",
        }
        return {"reply": fallback_openers.get(tool, "What decision are we working on?")}

    # Normal dialogue turn
    msgs = dialogue_prompt.format_messages(
        system_text=sys_text,
        history=t.history,
        message=t.message,
    )
    resp = llm.invoke(msgs)
    return {"reply": resp.content}

@app.post("/flow/next")
def flow_next(req: FlowReq):
    """
    Advance a flow. Send {flow_id, node_id?, answers}.
    Returns either:
      - {node_id, ask: {...}, awaiting}
      - {goto: "<next_node_id>"}
      - {end: True, recommendation: "..."}
    """
    if req.flow_id not in FLOW_REGISTRY:
        return {"error": f"unknown flow_id: {req.flow_id}"}

    flow = FLOW_REGISTRY[req.flow_id]
    node_id = req.node_id or flow["start"]
    step = next_node(flow, node_id, req.answers)

    # Decorate scale questions with helper text if the node defines labels
    if "ask" in step:
        ask = step["ask"]
        if ask.get("type") == "scale_1_5":
            labels = flow["nodes"].get(node_id, {}).get("scale_labels", {})
            if labels:
                ask["helper_text"] = "1–5 scale: " + "; ".join(f"{k}={v}" for k, v in labels.items())
        return {"node_id": node_id, "ask": ask, "awaiting": step.get("awaiting")}

    if "goto" in step:
        return {"goto": step["goto"]}

    if "end" in step:
        return {"end": True, "recommendation": step.get("recommendation", "Finished.")}

    return step
