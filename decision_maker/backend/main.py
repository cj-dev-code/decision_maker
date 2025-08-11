import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from fastapi import Body
from flow_engine import load_flow, next_node
from pydantic import BaseModel
from typing import Optional

class FlowReq(BaseModel):
    flow_id: str = "how_fast"
    node_id: str | None = None
    answers: dict = {}   # accumulated; e.g. {"year": 3, "happiness_test":{}, "freeroll": "no"}



load_dotenv()

FLOW = load_flow("flows/how_fast.yaml")

TOOL_PROMPTS = {
    "purpose_finder": """You are PurposeFinder. Goal: clarify the user's WHY.
Ask brief, targeted questions to uncover objectives, constraints, and success criteria.
One question at a time. Summarize briefly after every 3 exchanges.""",

    "speed_checker": """You are SpeedChecker. Determine decision speed:
Is it reversible? What's the cost of delay vs. action? One question at a time.""",

    "options_outcomes": """You are OptionSmith. Generate options, outcomes, and uncertainties.
Elicit user's preferences. Keep lists crisp; avoid repetition.""",

    "base_rates_agent": """You are BaseRates. Find base rates and real examples from the web.
Cite sources inline with titles. Be conservative about certainty.""",
}

# which tools require an agentic step
AGENTIC = {"base_rates_agent"}



app = FastAPI()
# Allow your Next.js dev server to call this API locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatOpenAI(model="gpt-4o", temperature=0)

SYSTEM = """You are DecisionMaker, guiding users through Annie Duke's process:
1) clarify purpose, 2) decide speed (reversible/irreversible), 3) generate options/outcomes,
4) base rates, 5) stress tests & other POVs, 6) decide, 7) schedule debrief.
Ask one, targeted question at a time. Be concise and keep momentum."""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM),
    ("placeholder", "{history}"),
    ("user", "{message}")
])

class Turn(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []  # e.g. [{"role":"user","content":"..."}]
class Turn(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []   # [{role, content}]
    tool: Optional[str] = None
    system_override: Optional[str] = None

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/dialogue")
def dialogue(t: Turn):
    tool = t.tool or "purpose_finder"
    system_text = t.system_override or TOOL_PROMPTS.get(tool, TOOL_PROMPTS["purpose_finder"])

    # --- INIT: only once, when history is empty ---
    if t.message == "__init__" and not t.history:
        openings = {
            "purpose_finder": "What decision are we working on? One sentence.",
            "speed_checker":  "Quick check: what's the decision? I'll run the speed test next.",
            "options_outcomes": "State your decision and constraints. I’ll help generate options & outcomes.",
            "base_rates_agent": "Give me the domain/topic (e.g., 'leaving FAANG for a startup').",
        }
        return {"reply": openings.get(tool, "What decision are we working on?")}

    msgs = prompt.format_messages(history=t.history, message=t.message)
    resp = llm.invoke(msgs)
    return {"reply": resp.content}

@app.post("/flow/next")
def flow_next(req: FlowReq):
    node_id = req.node_id or FLOW["start"]
    step = next_node(FLOW, node_id, req.answers)

    # decorate with LLM copy (optional): scale labels & clarification
    if "ask" in step:
        ask = step["ask"]
        if ask.get("type") == "scale_1_5":
            labels = FLOW["nodes"]["happiness_test"]["scale_labels"]
            ask["helper_text"] = "1–5 scale: " + "; ".join(f"{k}={v}" for k,v in labels.items())
        # you could call LLM here to rephrase ask["prompt"] per user context
        return {"node_id": node_id, "ask": ask, "awaiting": step["awaiting"]}

    if "goto" in step:
        return {"goto": step["goto"]}

    if "end" in step:
        return {"end": True, "recommendation": step["recommendation"]}

    return step

