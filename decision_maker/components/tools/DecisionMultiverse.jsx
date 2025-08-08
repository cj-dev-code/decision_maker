"use client";
import { useState } from "react";

export default function DecisionMultiverse() {
  // ----- Options state
  const [options, setOptions] = useState([
    { id: rid(), name: "Option 1", kill: "" },
    { id: rid(), name: "Option 2", kill: "" },
  ]);

  const addOption = () =>
    setOptions((p) => [...p, { id: rid(), name: `Option ${p.length + 1}`, kill: "" }]);

  const removeOption = (id) => {
    setOptions((p) => p.filter((o) => o.id !== id));
    setOutcomes((p) => p.filter((o) => o.optionId !== id));
  };

  const updateOption = (id, patch) =>
    setOptions((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  // ----- Outcomes state
  const [outcomes, setOutcomes] = useState([
    { id: rid(), optionId: null, name: "Outcome 1", val: "", prob: "" },
  ]);

  const addOutcome = () =>
    setOutcomes((p) => [
      ...p,
      {
        id: rid(),
        optionId: options[0]?.id ?? null,
        name: `Outcome ${p.length + 1}`,
        val: "",
        prob: "",
      },
    ]);

  const removeOutcome = (id) => setOutcomes((p) => p.filter((o) => o.id !== id));
  const updateOutcome = (id, patch) =>
    setOutcomes((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    // Parent doesn't scroll; inner panels own the scrollbars
    <div className="h-full overflow-hidden grid grid-cols-[320px_1fr] gap-3">
      {/* ---------- OPTIONS ---------- */}
        <section className="min-h-0 overflow-hidden border rounded flex flex-col">
        <header className="px-3 py-2 border-b font-medium flex items-center justify-between">
          <span>Options</span>
          <button onClick={addOption} className="border rounded px-3 py-1">
            + Add option
          </button>
        </header>

        {/* independent scroll */}
        <div className="flex-1 min-h-0 overflow-y-scroll [scrollbar-gutter:stable] p-3 space-y-3">

          {options.map((opt, i) => {
            const killId = `kill-${i}`; // stable across SSR/CSR
            return (
              <div key={opt.id} className="bg-pink-200/70 border rounded p-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={opt.name}
                    onChange={(e) => updateOption(opt.id, { name: e.target.value })}
                  />
                  <button
                    onClick={() => removeOption(opt.id)}
                    className="border rounded px-2"
                    title="Remove option"
                  >
                    −
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor={killId} className="whitespace-nowrap font-medium">
                    Kill criteria:
                  </label>
                  <input
                    id={killId}
                    className="flex-1 border rounded px-2 py-1"
                    placeholder="None"
                    value={opt.kill}
                    onChange={(e) => updateOption(opt.id, { kill: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- OUTCOMES ---------- */}
        <section className="min-h-0 overflow-hidden border rounded flex flex-col">
        <header className="px-3 py-2 border-b font-medium flex items-center justify-between">
          <span>Outcomes</span>
          <button onClick={addOutcome} className="border rounded px-3 py-1">
            + Add outcome
          </button>
        </header>

        {/* independent scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {outcomes.map((o, idx) => (
            <div
              key={o.id}
              className="bg-pink-200/70 border rounded px-2 py-2 grid items-center
                         grid-cols-[minmax(160px,1fr)_92px_92px_minmax(180px,0.8fr)_auto] gap-2"
            >
              {/* Labeled: Outcome name */}
              <div>
                <label className="block text-[11px] leading-tight mb-1" htmlFor={`name-${idx}`}>
                  Outcome name
                </label>
                <input
                  id={`name-${idx}`}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder={`Outcome ${idx + 1}`}
                  value={o.name}
                  onChange={(e) => updateOutcome(o.id, { name: e.target.value })}
                />
              </div>

              {/* Labeled: Val (0–100) */}
              <div>
                <label className="block text-[11px] leading-tight mb-1" htmlFor={`val-${idx}`}>
                  Val
                </label>
                <input
                  id={`val-${idx}`}
                  className="w-full border rounded px-2 py-1 text-sm text-right"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  max={100}
                  value={o.val}
                  onChange={(e) => updateOutcome(o.id, { val: clampNumber(e.target.value, 0, 100) })}
                />
              </div>

              {/* Labeled: % (0–100) */}
              <div>
                <label className="block text-[11px] leading-tight mb-1" htmlFor={`prob-${idx}`}>
                  % (likelihood)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id={`prob-${idx}`}
                    className="w-full border rounded px-2 py-1 text-sm text-right"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    max={100}
                    value={o.prob}
                    onChange={(e) => updateOutcome(o.id, { prob: clampNumber(e.target.value, 0, 100) })}
                  />
                  <span className="text-xs">%</span>
                </div>
              </div>

              {/* Labeled: Which option this belongs to */}
              <div>
                <label className="block text-[11px] leading-tight mb-1" htmlFor={`opt-${idx}`}>
                  Option
                </label>
                <select
                  id={`opt-${idx}`}
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={o.optionId ?? ""}
                  onChange={(e) => updateOutcome(o.id, { optionId: e.target.value || null })}
                >
                  <option value="">— Select option —</option>
                  {options.map((opt, i) => (
                    <option key={opt.id} value={opt.id}>{`${i + 1}: ${opt.name}`}</option>
                  ))}
                </select>
              </div>

              {/* Remove outcome */}
              <button
                onClick={() => removeOutcome(o.id)}
                className="justify-self-end border rounded px-2"
                title="Remove outcome"
              >
                −
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function rid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id_" + Math.random().toString(36).slice(2);
}

// sanitize & clamp 0..max, allow "" (empty)
function clampNumber(raw, min = 0, max = 100) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const cleaned = String(raw).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  if (cleaned === "") return "";
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(min, Math.min(max, n)));
}
