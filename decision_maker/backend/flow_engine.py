import operator
import yaml
import os
from typing import Dict, Any

OPS = {
    "<=": operator.le, "<": operator.lt,
    ">=": operator.ge, ">": operator.gt,
    "==": operator.eq,
}

def load_flow(path: str) -> Dict[str, Any]:
    with open(path, "r") as f:
        return yaml.safe_load(f)

def load_flows(dirpath: str) -> Dict[str, Dict[str, Any]]:
    """Load all *.yaml flows in a directory -> {flow_id: flow_dict}"""
    registry = {}
    for fname in os.listdir(dirpath):
        if not fname.endswith(".yaml"):
            continue
        flow = load_flow(os.path.join(dirpath, fname))
        fid = flow.get("id") or os.path.splitext(fname)[0]
        registry[fid] = flow
    return registry

def eval_expr(expr, answers):
    """
    Very small, safe evaluator for patterns like "max(year,month,day) <= 2".
    Missing keys are treated as 0 so expressions don't crash early in a flow.
    """
    if not expr:
        return True
    expr = str(expr).strip()
    if expr.startswith("max("):
        inside = expr[4:expr.index(")")]
        keys = [k.strip() for k in inside.split(",")]
        rest = expr[expr.index(")")+1:].strip()   # e.g. "<= 2"
        op, thresh = rest.split()[0], float(rest.split()[1])
        val = max(float(answers.get(k, 0)) for k in keys)
        return OPS[op](val, thresh)
    raise ValueError("unsupported expr")

# ---------- persona helpers ----------
def _persona_prefix(flow: Dict[str, Any]) -> str:
    try:
        p = (flow or {}).get("persona", {}) or {}
        return (p.get("prefix") or "").strip()
    except Exception:
        return ""

def _apply_persona(flow: Dict[str, Any], ask: Dict[str, Any]) -> Dict[str, Any]:
    if not ask:
        return ask
    prefix = _persona_prefix(flow)
    if not prefix:
        return ask
    out = dict(ask)
    if not out.get("prompt", "").strip().startswith(prefix):
        out["prompt"] = (prefix + " " + out.get("prompt", "")).strip()
    return out

def next_node(flow, node_id, answers):
    node = flow["nodes"][node_id]

    if node["kind"] == "composite":
        # Ask outstanding questions (validator enforces sufficiency; here we gate on presence)
        for q in node["asks"]:
            if q["id"] not in answers or not str(answers[q["id"]]).strip():
                ask = _apply_persona(flow, q)
                return {"ask": ask, "node_id": node_id, "awaiting": q["id"]}

        # All questions present -> compute routing
        cond_expr = (node.get("compute") or {}).get("pass_if")
        ok = eval_expr(cond_expr, answers) if cond_expr is not None else True

        rules = node.get("on_answer", []) or []
        fallback_else = None
        unconditional = None

        for rule in rules:
            # Accept both styles:
            #   - {"when":"pass_if","goto":"X"}
            #   - {"else":"Y"}
            #   - {"goto":"Z"}   (unconditional default)
            if "when" in rule:
                when = rule.get("when")
                matched = False
                if when == "pass_if":
                    matched = bool(ok)
                else:
                    # allow inline expressions in 'when'
                    try:
                        matched = bool(eval_expr(when, answers))
                    except Exception:
                        matched = False
                if matched:
                    dest = rule.get("goto") or rule.get("then") or rule.get("pass") or rule.get("else")
                    if dest:
                        return {"goto": dest}
            elif "else" in rule:
                fallback_else = rule.get("else")
            elif "goto" in rule and unconditional is None:
                unconditional = rule.get("goto")

        # If no 'when' matched, prefer explicit else, otherwise unconditional goto
        if fallback_else:
            return {"goto": fallback_else}
        if unconditional:
            return {"goto": unconditional}

        # If nothing to route to, but composite is done, treat as terminal if defined
        if node_id in flow.get("nodes", {}) and "next" in node:
            return {"goto": node["next"]}

    elif node["kind"] == "yesno":
        ans = str(answers.get(node_id, "")).lower()
        key = "on_yes" if ans in ("y","yes","true","1") else "on_no"
        return {"goto": node[key]}

    elif node["kind"] == "collect":
        if node_id not in answers or not str(answers[node_id]).strip():
            ask = {"id": node_id, "type": "text", "prompt": node["prompt"]}
            ask = _apply_persona(flow, ask)
            return {"ask": ask, "node_id": node_id, "awaiting": node_id}
        return {"goto": node["next"]}

    elif node["kind"] == "end":
        return {"end": True, "recommendation": node.get("recommendation", "Finished.")}

    return {"error": "unhandled"}

def first_prompt(flow) -> str:
    """Return a sensible first question/prompt for a flow's start node, with persona voice if present."""
    start = flow["start"]
    node = flow["nodes"][start]
    prefix = _persona_prefix(flow)

    if node["kind"] == "composite":
        p = node["asks"][0]["prompt"]
        return ((prefix + " " + p).strip() if prefix else p)
    elif node["kind"] in ("yesno", "collect"):
        p = node["prompt"]
        return ((prefix + " " + p).strip() if prefix else p)
    elif node["kind"] == "end":
        return node.get("recommendation", "Finished.")
    return "Let's begin."
