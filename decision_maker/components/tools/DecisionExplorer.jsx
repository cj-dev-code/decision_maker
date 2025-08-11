"use client";
import { useState } from "react";

export default function DecisionExplorer() {
  const [cols, setCols] = useState([
    { key: "succ_in",  title: "Win, for reasons in your control?",  items: [] },
    { key: "succ_out", title: "Win, for reasons out of your control?", items: [] },
    { key: "fail_in",  title: "Fail, for reasons in your control?",     items: [] },
    { key: "fail_out", title: "Fail, for reasons out of your control?", items: [] },
  ]);

  const addItem = (ci) =>
    setCols((p) => p.map((c, i) =>
      i === ci ? { ...c, items: [...c.items, { id: rid(), text: "", pct: "" }] } : c));

  const updateItem = (ci, id, patch) =>
    setCols((p) => p.map((c, i) =>
      i === ci ? { ...c, items: c.items.map(it => it.id === id ? { ...it, ...patch } : it) } : c));

  const removeItem = (ci, id) =>
    setCols((p) => p.map((c, i) =>
      i === ci ? { ...c, items: c.items.filter(it => it.id !== id) } : c));

  return (
    <div className="h-full grid grid-rows-[auto_1fr] gap-3">
      <header className="text-sm font-medium border-b pb-1 text-center">
        Imagine you woke up the day after your smart goal deadline elapsed. Why did you:
      </header>

      {/* 4 equal columns with independent scroll */}
      <div className="grid grid-cols-4 gap-3 min-h-0">
        {cols.map((col, ci) => (
          <section key={col.key} className="min-h-0 border rounded flex flex-col">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm">{col.title}</span>
              <button
                onClick={() => addItem(ci)}
                className="border rounded px-2 py-1 text-sm"
                title="Add reason"
              >
                + Reason
              </button>
            </div>

            {/* list owns the scrollbar */}
            <div className="flex-1 min-h-0 h-0 overflow-y-auto p-2 space-y-2">
              {col.items.map((it, ri) => (
                <div
                  key={it.id}
                  className="bg-pink-200/70 border rounded px-2 py-2 grid items-center
                             grid-cols-[1fr_84px_auto] gap-2 text-sm"
                >
                  {/* Reason text (compact) */}
                  <div>
                    <label htmlFor={`r-${ci}-${ri}`} className="block text-[11px] leading-tight mb-1">
                      Reason
                    </label>
                    <input
                      id={`r-${ci}-${ri}`}
                      className="w-full border rounded px-2 py-1"
                      placeholder="e.g., Prepared well"
                      value={it.text}
                      onChange={(e) => updateItem(ci, it.id, { text: e.target.value })}
                    />
                  </div>

                  {/* % likelihood (0–100) */}
                  <div>
                    <label htmlFor={`p-${ci}-${ri}`} className="block text-[11px] leading-tight mb-1">
                      % Likely
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`p-${ci}-${ri}`}
                        className="w-full border rounded px-2 py-1 text-right"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="any"
                        value={it.pct}
                        onChange={(e) =>
                          updateItem(ci, it.id, { pct: clampNumber(e.target.value, 0, 100) })
                        }
                      />
                      <span className="text-xs">%</span>
                    </div>
                  </div>

                  {/* remove */}
                  <button
                    onClick={() => removeItem(ci, it.id)}
                    className="justify-self-end border rounded px-2"
                    title="Remove reason"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* helpers */
function rid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id_" + Math.random().toString(36).slice(2);
}

// sanitize & clamp 0..max, allow ""
function clampNumber(raw, min = 0, max = 100) {
  if (raw === "" || raw == null) return "";
  const cleaned = String(raw).replace(/[^0-9.]/g, "").replace(/(\..*)\./, "$1");
  if (cleaned === "") return "";
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(min, Math.min(max, n)));
}
