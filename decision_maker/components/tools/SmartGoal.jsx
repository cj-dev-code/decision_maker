"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
const ACTION_VERBS = [
  "build","design","implement","launch","ship","write","train","deploy",
  "refactor","optimize","publish","apply","schedule","start","finish"
];

const hasActionVerb = (s) =>
  ACTION_VERBS.some(v => new RegExp(`\\b${v}\\b`, "i").test(s));

export default function SmartGoal() {
  const router = useRouter();
  const pathname = usePathname();
  const goalId = pathname?.match(/\/decision\/([^/]+)/)?.[1] ?? "demo";

  // form state
  const [title, setTitle] = useState("");
  const [specific, setSpecific] = useState("");
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [actionable, setActionable] = useState("");
  const [realistic, setRealistic] = useState("");
  const [deadline, setDeadline] = useState("");
  const [timeframe, setTimeframe] = useState("");

  const [autoLaunched, setAutoLaunched] = useState(false);

  // basic heuristics
  const checks = useMemo(() => {
    const tNum = Number(target);
    const deadlineOk = deadline ? new Date(deadline) > new Date() : false;
    return {
      s: specific.trim().length >= 20,
      m: metric.trim().length > 0 && unit.trim().length > 0 && !Number.isNaN(tNum),
      a: hasActionVerb(actionable) && actionable.trim().length >= 12,
      r: realistic.trim().length >= 20,
      t: deadlineOk || timeframe.trim().length > 0,
    };
  }, [specific, metric, target, unit, actionable, realistic, deadline, timeframe]);

  const ready = Object.values(checks).every(Boolean);

  // gentle hints
  const tips = useMemo(() => {
    const out = [];
    if (!checks.s) out.push("Make the “Specific” longer: who/what/where.");
    if (!checks.m) out.push("Measurable needs metric + numeric target + unit.");
    if (!checks.a) out.push(`Actionable should start with a verb (e.g., ${ACTION_VERBS.slice(0,6).join(", ")}).`);
    if (!checks.r) out.push("Realistic: mention constraints/resources and why this scope fits.");
    if (!checks.t) out.push("Time-bound: choose a future deadline or add a timeframe.");
    return out;
  }, [checks]);

  // load draft
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("smartGoal_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      setTitle(d.title ?? "");
      setSpecific(d.specific ?? "");
      setMetric(d.measurable?.metric ?? "");
      setTarget(d.measurable?.target ?? "");
      setUnit(d.measurable?.unit ?? "");
      setActionable(d.actionable ?? "");
      setRealistic(d.realistic ?? "");
      setDeadline(d.timebound?.deadlineISO ? d.timebound.deadlineISO.slice(0,10) : "");
      setTimeframe(d.timebound?.timeframe ?? "");
    } catch {}
  }, []);

  // autosave draft
  useEffect(() => {
    const draft = {
      title,
      specific,
      measurable: { metric, target: target ? Number(target) : null, unit },
      actionable,
      realistic,
      timebound: { deadlineISO: deadline || undefined, timeframe: timeframe || undefined }
    };
    try { sessionStorage.setItem("smartGoal_draft", JSON.stringify(draft)); } catch {}
  }, [title, specific, metric, target, unit, actionable, realistic, deadline, timeframe]);

  // auto-launch when SMART is satisfied (no big button)
  useEffect(() => {
    if (!ready || autoLaunched) return;
    const smart = {
      title: title.trim() || "Untitled goal",
      specific: specific.trim(),
      measurable: {
        metric: metric.trim(),
        target: target ? Number(target) : null,
        unit: unit.trim(),
      },
      actionable: actionable.trim(),
      realistic: realistic.trim(),
      timebound: {
        deadlineISO: deadline ? new Date(deadline).toISOString() : undefined,
        timeframe: timeframe.trim() || undefined,
      },
    };
    try { sessionStorage.setItem("smartGoal", JSON.stringify(smart)); } catch {}
    setAutoLaunched(true);
    // small delay so user sees all chips turn green, then jump
    const t = setTimeout(() => {
      router.push(`/decision/${goalId}/pre?tool=decision-speed`);
    }, 450);
    return () => clearTimeout(t);
  }, [ready, autoLaunched, title, specific, metric, target, unit, actionable, realistic, deadline, timeframe, router, goalId]);

  // quick helper for the letter chips
  const Chip = ({ ok, children }) => (
    <span className={`text-xs px-2 py-0.5 rounded border ${
      ok ? "bg-green-100 border-green-300 text-green-800"
         : "bg-amber-50 border-amber-300 text-amber-800"
    }`}>{children}</span>
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <header className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">SMART Goal</h2>
        <div className="flex items-center gap-2">
          <Chip ok={checks.s}>S</Chip>
          <Chip ok={checks.m}>M</Chip>
          <Chip ok={checks.a}>A</Chip>
          <Chip ok={checks.r}>R</Chip>
          <Chip ok={checks.t}>T</Chip>

          {/* tiny fallback link if you want to jump before auto-start */}
          <a
            className={`ml-2 text-xs underline ${ready ? "text-blue-700 hover:text-blue-800" : "text-gray-400 pointer-events-none"}`}
            onClick={()=>{
              if (!ready) return;
              setAutoLaunched(true);
              router.push(`/decision/${goalId}/pre?tool=decision-speed`);
            }}
          >
            start now
          </a>
        </div>
      </header>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto pr-1">
        <div className="space-y-1">
          <label className="text-sm font-medium">Goal Title</label>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="e.g., Launch MVP of decision supporter"
            value={title}
            onChange={e=>setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">S — Specific (who/what/where)</label>
          <textarea
            className={`w-full border rounded px-2 py-1 h-24 ${checks.s? "":"ring-1 ring-amber-300"}`}
            placeholder="Describe the exact outcome and scope…"
            value={specific}
            onChange={e=>setSpecific(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">M — Measurable</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              className={`border rounded px-2 py-1 ${metric? "":"ring-1 ring-amber-300"}`}
              placeholder="metric (e.g., MAU)"
              value={metric}
              onChange={e=>setMetric(e.target.value)}
            />
            <input
              className={`border rounded px-2 py-1 ${target!=="" ? "" : "ring-1 ring-amber-300"}`}
              placeholder="target"
              inputMode="numeric"
              value={target}
              onChange={e=>setTarget(e.target.value.replace(/[^\d.]/g,""))}
            />
            <input
              className={`border rounded px-2 py-1 ${unit? "":"ring-1 ring-amber-300"}`}
              placeholder="unit"
              value={unit}
              onChange={e=>setUnit(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">A — Actionable (starts with a verb)</label>
          <textarea
            className={`w-full border rounded px-2 py-1 h-24 ${checks.a? "":"ring-1 ring-amber-300"}`}
            placeholder={`What actions? (starts with: ${ACTION_VERBS.slice(0,6).join(", ")}…)`}
            value={actionable}
            onChange={e=>setActionable(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">R — Realistic (constraints/resources/risks)</label>
          <textarea
            className={`w-full border rounded px-2 py-1 h-24 ${checks.r? "":"ring-1 ring-amber-300"}`}
            placeholder="Why this is feasible; resources, constraints, risk mitigations…"
            value={realistic}
            onChange={e=>setRealistic(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">T — Time-bound</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Deadline</div>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={deadline}
                onChange={e=>setDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">or Timeframe</div>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="e.g., next 6 weeks"
                value={timeframe}
                onChange={e=>setTimeframe(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* tips */}
      {tips.length > 0 && (
        <div className="border rounded p-2 bg-amber-50 text-amber-900 text-sm">
          <div className="font-medium mb-1">Make it SMART-er:</div>
          <ul className="list-disc ml-5 space-y-0.5">
            {tips.map((t,i)=>(<li key={i}>{t}</li>))}
          </ul>
        </div>
      )}

      {/* small footer: just Clear */}
      <div className="mt-1 flex items-center justify-end gap-2">
        <button
          className="px-3 py-1 border rounded"
          onClick={()=>{
            setTitle(""); setSpecific(""); setMetric(""); setTarget(""); setUnit("");
            setActionable(""); setRealistic(""); setDeadline(""); setTimeframe("");
            setAutoLaunched(false);
            try { sessionStorage.removeItem("smartGoal_draft"); } catch {}
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
