# backend/flow_engine.py
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
    # very small, safe evaluator for patterns like "max(year,month,day) <= 2"
    if expr.startswith("max("):
        inside = expr[4:expr.index(")")]
        keys = [k.strip() for k in inside.split(",")]
        rest = expr[expr.index(")")+1:].strip()   # e.g. "<= 2"
        op, thresh = rest.split()[0], float(rest.split()[1])
        val = max(float(answers.get(k, 0)) for k in keys)
        return OPS[op](val, thresh)
    raise ValueError("unsupported expr")

def next_node(flow, node_id, answers):
    node = flow["nodes"][node_id]
    if node["kind"] == "composite":
        for q in node["asks"]:
            if q["id"] not in answers:
                return {"ask": q, "node_id": node_id, "awaiting": q["id"]}
        cond = node["compute"]["pass_if"]
        ok = eval_expr(cond, answers)
        for rule in node["on_answer"]:
            if ("when" in rule and ok) or ("else" in rule and not ok):
                return {"goto": rule["goto"]}
    elif node["kind"] == "yesno":
        ans = str(answers.get(node_id, "")).lower()
        key = "on_yes" if ans in ("y","yes","true","1") else "on_no"
        return {"goto": node[key]}
    elif node["kind"] == "collect":
        # one free-form field required under node_id key
        if node_id not in answers or not str(answers[node_id]).strip():
            return {"ask": {"id": node_id, "type": "text", "prompt": node["prompt"]},
                    "node_id": node_id, "awaiting": node_id}
        return {"goto": node["next"]}
    elif node["kind"] == "end":
        return {"end": True, "recommendation": node.get("recommendation", "Finished.")}
    return {"error": "unhandled"}

def first_prompt(flow) -> str:
    """Return a sensible first question/prompt for a flow's start node."""
    start = flow["start"]
    node = flow["nodes"][start]
    if node["kind"] == "composite":
        # first ask's prompt
        return node["asks"][0]["prompt"]
    elif node["kind"] in ("yesno", "collect"):
        return node["prompt"]
    elif node["kind"] == "end":
        return node.get("recommendation", "Finished.")
    return "Let's begin."
