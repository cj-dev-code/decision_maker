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

import json
from collections import defaultdict
import yaml

# ---------------- Session Store ----------------
SESSIONS = defaultdict(lambda: {
    "flow_id": None,
    "node_id": None,
    "awaiting": None,        # ask.id currently being filled
    "answers": {},
    "field_chat": [],        # transcript for this ask.id (user + assistant lines)
})

# ---------------- Setup & Flow Registry ----------------
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

    # speed checker
    "speed_checker":         "how_fast",

    # legacy/default
    "purpose_finder":        "goal_define",
}

# ---------------- LLM Setup ----------------
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
    ("placeholder", "{history}"),
    ("user", "{message}"),
])

# ---------------- Professional Goal Setter (validator) ----------------

# Global bounds for the starter tool: specification only
STARTER_BOUNDS = (
    "BOUNDS:\n"
    "- Only specify the goal (verifiable outcome + timeframe [or 'unsure'] + evidence-of-done).\n"
    "- Do NOT propose plans, steps, tactics, or recommend companies/options.\n"
    "- Keep follow-ups short and concrete; include tiny examples."
)

PRO_GOAL_SETTER_JUDGE_SYSTEM = """
You are the Professional Goal Setter. You judge a SINGLE question: “What do you want to achieve?”
Your job is to decide if the user’s CURRENT answer is sufficient for this question’s rubric.

Sufficiency = the goal statement includes:
(a) a verifiable outcome (action + object),
(b) a timeframe (date/range) OR explicitly says “unsure”,
(c) evidence of done (an observable proof).

Rules:
- Consider the entire transcript FOR THIS QUESTION (multi-turn). If pieces are present across turns, mark SUFFICIENT and normalize to one sentence.
- Stay within BOUNDS (specify only; no plans, steps, tactics, or company picks).
- If INSUFFICIENT, produce ONE compact FOLLOWUP that contains:
  1) what you understood (≤1 sentence),
  2) 1–3 bullets naming exactly what’s missing vs. the rubric,
  3) up to 2 tiny, domain-appropriate example answers,
  4) one specific question that asks ONLY for the missing bits.
- Avoid repeating a previous assistant follow-up verbatim; rephrase if necessary.
- When SUFFICIENT, set “extract” to a single, normalized goal sentence in the template:
  “Do X by Y (or ‘unsure’), proven by Z.”
""".strip()

validator_llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    model_kwargs={"response_format": {"type": "json_object"}}
)

# Keep keys the same (status, followup, extract)
validator_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a validator for a single interview question inside a YAML flow.

Domain guidance:
{judge_system}

{bounds}

Goal: decide if the user's CURRENT answer is SUFFICIENT for THIS question's rubric. 

If insufficient, your FOLLOWUP MUST be a single compact message that:
  1) Completely state the goal with as much detail as possible provided by the user. 
  2. Asks a question for one detail that's missing in order to state the goal without any vagueness, providing 3 examples of that detail in the format "for example: detail 1, detail 2, detail 3"
Avoid repeating an earlier assistant follow-up in the transcript; if needed, rephrase.

Return strict JSON: {{\"status\":\"sufficient\"|\"insufficient\",\"followup\":\"\",\"extract\":\"\"}}
- \"followup\": when insufficient, include the restated goal based on the user input, the question for one missing detail, and the relevant "for examples" of that detail.
- \"extract\": when sufficient, normalize the user's answer into one sentence using ONLY user-provided info.
"""),
    ("user", """
QUESTION_ID: {qid}
QUESTION_PROMPT: {qprompt}

CRITERION_RUBRIC:
{rubric}

EXAMPLES (adequate answers):
{examples}

TRANSCRIPT FOR THIS QUESTION ONLY:
{transcript}

Evaluate the transcript against the rubric and respond with the JSON.
""")
])

def check_sufficient_llm(qdict, field_chat, judge_system: str, bounds: str):
    rubric = qdict.get("criterion", {}).get("rubric", "").strip()
    examples = "\n".join(qdict.get("examples", [])) or "None"
    transcript = "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in field_chat]) or "EMPTY"

    msgs = validator_prompt.format_messages(
        judge_system=judge_system,
        bounds=bounds,
        qid=qdict["id"],
        qprompt=qdict["prompt"],
        rubric=rubric or "Sufficient iff a non-empty answer is provided.",
        examples=examples,
        transcript=transcript,
    )
    resp = validator_llm.invoke(msgs)
    raw = resp.content
    try:
        data = json.loads(raw)
    except Exception:
        print("VALIDATOR_RAW_PARSE_FAIL:", raw)
        data = {"status": "insufficient", "followup": "I need a bit more detail to meet the rubric. Could you add that?", "extract": ""}

    status   = data.get("status", "insufficient")
    followup = (data.get("followup") or "").strip()
    extract  = (data.get("extract") or "").strip()
    return status, followup, extract

# ---------------- Contrast-aware Helper (minimal change) ----------------
helper_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

helper_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a kind, concise explainer. The user is asking a clarifying question, or seems confused about a detail
about the CURRENT question. Answer plainly—NO rubric talk.

Grounding:
- Use KNOWN DETAILS about the goal from the transcript and known answers (outcome words, timeframe hints, proof-of-done, must-nots).
- Hold all KNOWN DETAILS constant and vary ONLY the currently ambiguous/missing detail.
- Do NOT repeat scenarios you (or the user) have already suggested earlier in this transcript.
- Eliminate any scenario that conflicts with stated must-nots.

Helpful pattern:
"Imagine the scenario in which <goal completed with one plausible value of the missing detail>. <Details about failures they'll encounter. Details about how they'll overcome them to inevitably succeed>. You may experience <visualize 3 reasons why people pick that goal>. Would you be okay with that?"

Present the helpful pattern
"""),
    ("user", """
QUESTION_PROMPT: {qprompt}

BOUNDS:
{bounds}

If helpful, acceptable-answer examples:
{examples}

TRANSCRIPT FOR THIS QUESTION ONLY:
{transcript}

KNOWN ANSWERS (key: value list):
{known_answers}

USER QUESTION:
{user_question}
""")
])

def is_user_question(text: str) -> bool:
    if not text: return False
    t = text.strip().lower()
    return (
        t.endswith("?")
        or t.startswith(("what ", "how ", "why ", "which ", "could ", "can ", "should ", "help", "examples"))
        or "i'm not sure" in t or "im not sure" in t or "i don't know" in t or "i dont know" in t
    )

def answer_user_question(qdict, field_chat, user_text: str, known_answers: Optional[dict] = None, bounds: str = "") -> str:
    """
    Produce a grounded, non-repeating set of contrastive scenarios using the current field transcript
    and any known answers. Scenarios keep known details fixed and only vary the missing detail.
    """
    examples = "\n".join(qdict.get("examples", [])) or "None"
    transcript = "\n".join([f'{m["role"].upper()}: {m["content"]}' for m in field_chat]) or "EMPTY"
    known_dump = ""
    if known_answers:
        pairs = []
        for k, v in known_answers.items():
            if not v:
                continue
            sv = str(v)
            if len(sv) > 160:
                sv = sv[:157] + "..."
            pairs.append(f"{k}: {sv}")
        known_dump = "\n".join(pairs) if pairs else "None"
    else:
        known_dump = "None"

    msgs = helper_prompt.format_messages(
        qprompt=qdict["prompt"],
        bounds=bounds or "",
        examples=examples,
        transcript=transcript,
        known_answers=known_dump,
        user_question=user_text
    )
    return helper_llm.invoke(msgs).content

# ---------------- FastAPI App ----------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Models ----------------
class Turn(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []
    tool: Optional[str] = None
    system_override: Optional[str] = None

class FlowReq(BaseModel):
    flow_id: str
    node_id: Optional[str] = None
    answers: dict = {}

# ---------------- Endpoints ----------------
@app.get("/health")
def health():
    return {"ok": True, "flows": sorted(FLOW_REGISTRY.keys())}

@app.post("/dialogue")
def dialogue(t: Turn):
    tool = t.tool or "smart-goal"
    flow_id = TOOL_TO_FLOW.get(tool)
    sess = SESSIONS[t.session_id]

    base_flow = FLOW_REGISTRY.get(flow_id) if flow_id else None
    active_flow = base_flow  # no persona swap in this minimal design

    if active_flow:
        # INIT
        if t.message == "__init__" or not sess["flow_id"]:
            start = active_flow["start"]
            node = active_flow["nodes"][start]
            first_q = node["asks"][0]
            sess.update({
                "flow_id": flow_id,
                "node_id": start,
                "awaiting": first_q["id"],
                "answers": {},
                "field_chat": [],
            })
            return {"reply": first_q["prompt"]}

        # NORMAL TURN
        if sess["awaiting"]:
            # record user line
            sess["field_chat"].append({"role": "user", "content": t.message})

            node = active_flow["nodes"][sess["node_id"]]
            qdict = next(q for q in node["asks"] if q["id"] == sess["awaiting"])

            # If the user asked a question, answer kindly (grounded, non-repeating), then re-ask
            bounds = (qdict.get("bounds") or "") + ("\n" + STARTER_BOUNDS)
            if is_user_question(t.message):
                expl = answer_user_question(
                    qdict,
                    sess["field_chat"],
                    t.message,
                    known_answers=sess.get("answers", {}),
                    bounds=bounds
                )
                sess["field_chat"].append({"role": "assistant", "content": expl})
                return {"reply": expl}

            # Otherwise validate sufficiency
            status, followup, extract = check_sufficient_llm(
                qdict,
                sess["field_chat"],
                judge_system=PRO_GOAL_SETTER_JUDGE_SYSTEM,
                bounds=bounds
            )

            if status == "insufficient":
                # Keep us on this ask; provide rich follow-up (with examples) in one message
                sess["field_chat"].append({"role": "assistant", "content": followup})
                return {"reply": followup or "Could you add a bit more detail?"}

            # Sufficient → store normalized statement and advance/end
            final_value = extract or t.message
            sess["answers"][sess["awaiting"]] = final_value
            sess["field_chat"] = []

            # This composite only has one ask; route to end
            step = next_node(active_flow, sess["node_id"], sess["answers"])
            while "goto" in step:
                sess["node_id"] = step["goto"]
                step = next_node(active_flow, sess["node_id"], sess["answers"])

            if "ask" in step:
                sess["awaiting"] = step["awaiting"]
                return {"reply": step["ask"]["prompt"]}

            if "end" in step:
                # Finish and hint the next tool (Options)
                normalized = sess["answers"].get("goal", "").strip()
                SESSIONS.pop(t.session_id, None)
                rec = step.get("recommendation", "Finished.")
                if normalized:
                    rec = f"{rec}\n\nGoal locked: {normalized}"
                return {"reply": rec}

            return {"reply": "Flow advanced but reached an unexpected state."}

    # Fallback: no YAML for this tool → normal chat
    sys_text = t.system_override or system_for(tool)
    msgs = dialogue_prompt.format_messages(system_text=sys_text, history=t.history, message=t.message)
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
