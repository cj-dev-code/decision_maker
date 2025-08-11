# backend/flow_engine.py
import operator, yaml
OPS = {"<=": operator.le, "<": operator.lt, ">=": operator.ge, ">": operator.gt, "==": operator.eq}

def load_flow(path): 
    with open(path, "r") as f: return yaml.safe_load(f)

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
        # check if we have all answers; if not, return the next sub-question
        for q in node["asks"]:
            if q["id"] not in answers:
                return {"ask": q, "node_id": node_id, "awaiting": q["id"]}
        # compute and route
        cond = node["compute"]["pass_if"]
        ok = eval_expr(cond, answers)
        for rule in node["on_answer"]:
            if ("when" in rule and ok) or ("else" in rule and not ok):
                return {"goto": rule["goto"]}
    elif node["kind"] == "yesno":
        # expects last answer under this node_id as 'yes'/'no'
        ans = str(answers.get(node_id, "")).lower()
        key = "on_yes" if ans in ("y","yes", "true", "1") else "on_no"
        return {"goto": node[key]}
    elif node["kind"] == "end":
        return {"end": True, "recommendation": node["recommendation"]}
    return {"error": "unhandled"}

