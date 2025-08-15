// components/LLMDialogue.jsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LLMDialog({
  tool = "purpose_finder",
  systemOverride,
  toolsMeta = [],
}) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

  // --- tool / axis (axis only matters for non-goal tools)
  const sp = useSearchParams();
  const isGoalTool = tool === "smart-goal";
  const currentAxis = isGoalTool ? "" : (sp.get("axis") || "");

  const rid = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id_" + Math.random().toString(36).slice(2);

  const GENERIC_OPENER = "How can I help you?";

  // --- simple axis color (stable hash -> HSL)
  const axisColor = (key) => {
    if (!key) return "#999";
    let h = 0; for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i)) % 360;
    return `hsl(${h}, 70%, 40%)`;
  };

  // --- state
  const [current, setCurrent] = useState([]);
  const [saved, setSaved] = useState([]); // each {id,title,messages,createdAt,tool,axis?}
  const [selected, setSelected] = useState({ type: "current", id: null });

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState("");

  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [selected, current, saved]);

  const hasAnyUser = (msgs) => msgs.some((m) => m.role === "user");
  const hasContent = (msgs) => msgs.some((m) => m.role === "user" || m.role === "assistant");

  const firstUserSnippet = (msgs) => {
    const firstUser = msgs.find((m) => m.role === "user")?.text?.trim();
    if (!firstUser) return "";
    const raw = firstUser.slice(0, 20);
    return raw + (firstUser.length > 20 ? "…" : "");
  };

  const computeSavedTitle = (msgs, toolSlug, savedList) => {
    const exists = savedList.some((s) => s.tool === toolSlug);
    if (!exists) return toolSlug;
    const snippet = firstUserSnippet(msgs);
    return snippet || toolSlug;
  };

  const openCurrent = () => {
    setSelected({ type: "current", id: null });
    const hasSavedForTool = saved.some((s) => s.tool === tool);
    if (hasSavedForTool) {
      setCurrent([{ role: "assistant", text: GENERIC_OPENER }]);
      initKeyRef.current = null;
    }
  };

  const openSaved = (id) => setSelected({ type: "saved", id });

  // Only filter by axis for non-goal tools; show everything for SmartGoal
  const visibleSaved = useMemo(() => {
    if (isGoalTool || !currentAxis) return saved;
    return saved.filter((s) =>
      s.tool === "smart-goal" ? true : (s.axis || "") === currentAxis
    );
  }, [saved, currentAxis, isGoalTool]);

  const selectedMessages = useMemo(() => {
    if (selected.type === "current") return current;
    const convo = saved.find((s) => s.id === selected.id);
    return convo?.messages ?? [];
  }, [selected, current, saved]);

  const setSelectedMessages = (updater) => {
    if (selected.type === "current") {
      setCurrent((prev) => (typeof updater === "function" ? updater(prev) : updater));
    } else {
      setSaved((prev) =>
        prev.map((s) =>
          s.id === selected.id
            ? { ...s, messages: typeof updater === "function" ? updater(s.messages) : updater }
            : s
        )
      );
    }
  };

  // --- tool switching / auto-save
  const prevToolRef = useRef(tool);
  const initKeyRef = useRef(null);

  useEffect(() => {
    if (prevToolRef.current === tool) return;

    const prevTool = prevToolRef.current;

    // Save current buffer under the previous tool (carry axis only for non-goal)
    if (selected.type === "current" && hasContent(current)) {
      setSaved((prevSaved) => {
        const id = rid();
        const title = computeSavedTitle(current, prevTool, prevSaved);
        const entry = {
          id,
          title,
          createdAt: new Date().toISOString(),
          tool: prevTool,
          axis: prevTool === "smart-goal" ? "" : (currentAxis || ""),
          messages: [...current],
        };
        return [entry, ...prevSaved];
      });
    }

    // Open saved chat for (tool, axis) or start fresh
    const found = saved.find(
      (s) => s.tool === tool && (tool === "smart-goal" ? true : (s.axis || "") === (currentAxis || ""))
    );
    if (found) {
      setSelected({ type: "saved", id: found.id });
      setCurrent([]);
      initKeyRef.current = null;
    } else {
      setSelected({ type: "current", id: null });
      setCurrent([]);
      initKeyRef.current = null;
    }

    setErr("");
    prevToolRef.current = tool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, currentAxis]);

  // --- auto-init opener (no saved chat for this tool/axis)
  useEffect(() => {
    const hasSavedForToolAxis = saved.some(
      (s) => s.tool === tool && (tool === "smart-goal" ? true : (s.axis || "") === (currentAxis || ""))
    );
    if (selected.type !== "current") return;
    if (hasSavedForToolAxis) return;
    if (current.length > 0) return;

    const axisKey = isGoalTool ? "-" : (currentAxis || "-");
    const key = `current::${tool}::${axisKey}`;
    if (initKeyRef.current === key) return;

    let alive = TrueFlag();
    setErr("");
    setThinking(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/dialogue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: "current",
            message: "__init__",
            history: [],
            tool,
            system_override: systemOverride || null,
          }),
        });
        const data = await res.json();
        const opener = typeof data?.reply === "string" ? data.reply : "What decision are we working on?";

        if (!alive.v) return;
        const hasSavedNow = saved.some(
          (s) => s.tool === tool && (tool === "smart-goal" ? true : (s.axis || "") === (currentAxis || ""))
        );
        if (selected.type !== "current") return;
        if (hasSavedNow) return;
        if (initKeyRef.current === key) return;

        // If backend sent axes, broadcast so the Axes picker fills
        if (Array.isArray(data?.axes)) {
          window.dispatchEvent(new CustomEvent("axes:update", { detail: data.axes }));
        }

        setSelectedMessages((prev) => [...prev, { role: "assistant", text: opener }]);
        initKeyRef.current = key;
      } catch {
        if (!alive.v) return;
        setSelectedMessages((prev) => [
          ...prev,
          { role: "assistant", text: "⚠️ Couldn’t start the session. Try sending a message." },
        ]);
      } finally {
        if (alive.v) setThinking(false);
      }
    })();

    return () => { alive.v = false; };
  }, [tool, currentAxis, isGoalTool, selected.type, current.length, saved, API_URL, systemOverride]);

  // tiny flag helper
  function TrueFlag(){ return { v: true }; }

  function toBackendHistory(msgs) {
    return msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(({ role, text }) => ({ role, content: text }));
  }

  // --- send
  const send = async (e) => {
    e?.preventDefault();
    setErr("");
    const payloadText = text.trim();
    if (!payloadText || loading) return;

    const baseMsgs =
      selected.type === "current"
        ? current
        : (saved.find((s) => s.id === selected.id)?.messages || []);

    // optimistic append
    setSelectedMessages((prev) => [...prev, { role: "user", text: payloadText }]);
    setText("");
    setLoading(true);
    setThinking(true);

    try {
      const msgsNow = baseMsgs.concat({ role: "user", text: payloadText });
      const body = {
        session_id: selected.type === "current" ? "current" : selected.id,
        message: payloadText,
        history: toBackendHistory(msgsNow),
        tool,
        system_override: systemOverride || null,
      };
      const res = await fetch(`${API_URL}/dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Broadcast axes if present
      if (Array.isArray(data?.axes)) {
        window.dispatchEvent(new CustomEvent("axes:update", { detail: data.axes }));
      }

      const reply = typeof data?.reply === "string" ? data.reply : JSON.stringify(data);
      setSelectedMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (e) {
      setErr(e?.message || "Failed to contact LLM backend.");
      setSelectedMessages((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Failed to get a reply. Try again." },
      ]);
    } finally {
      setLoading(false);
      setThinking(false);
    }
  };

  // --- manual save
  const saveCurrent = () => {
    if (!current.length) return;
    setSaved((prevSaved) => {
      const id = rid();
      const title = computeSavedTitle(current, tool, prevSaved);
      const entry = {
        id,
        title,
        createdAt: new Date().toISOString(),
        tool,
        axis: isGoalTool ? "" : (currentAxis || ""),
        messages: [...current],
      };
      return [entry, ...prevSaved];
    });
    setCurrent([{ role: "assistant", text: GENERIC_OPENER }]);
    setSelected({ type: "current", id: null });
    setText("");
    setErr("");
    setThinking(false);
    setLoading(false);
    initKeyRef.current = null;
  };

  // --- render
  return (
    <div className="h-full border rounded flex">
      <aside className="w-56 border-r flex flex-col min-h-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Saved Dialogues</div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          <button
            onClick={openCurrent}
            className={`w-full text-left border rounded px-2 py-1 text-sm ${selected.type === "current" ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            New Dialogue
          </button>

          {visibleSaved.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => openSaved(s.id)}
                className="flex-1 text-left border rounded px-2 py-1 text-sm hover:bg-gray-50"
                style={{ borderColor: s.axis ? axisColor(s.axis) : undefined }}
                title={s.axis ? `axis: ${s.axis}` : ""}
              >
                {s.title}
              </button>
              <span
                className="text-[10px] px-1.5 py-0.5 border rounded"
                style={{ color: axisColor(s.axis || ""), borderColor: axisColor(s.axis || "") }}
              >
                {s.axis || "—"}
              </span>
            </div>
          ))}
        </div>
        <div className="px-2 py-2 border-t">
          <button onClick={saveCurrent} className="w-full border rounded px-2 py-1 text-sm">
            Save
          </button>
        </div>
      </aside>

      <section className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <div className="font-medium">
            {selected.type === "current" ? "current" : (saved.find((s) => s.id === selected.id)?.title ?? "dialogue")}
          </div>
          {/* Show axis chip only for non-goal tools and when an axis is actually set */}
          {!isGoalTool && currentAxis && (
            <span
              className="text-xs ml-2 px-2 py-0.5 border rounded"
              style={{ color: axisColor(currentAxis), borderColor: axisColor(currentAxis) }}
            >
              axis: {currentAxis}
            </span>
          )}
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-sm">
          {(selectedMessages || [])
            .filter((m) => m.role !== "system")
            .map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span className="inline-block border rounded px-2 py-1 bg-white">
                  <strong className="mr-1">{m.role === "user" ? "You:" : "LLM:"}</strong>
                  {m.text}
                </span>
              </div>
            ))}
          {thinking && (
            <div className="text-left">
              <span className="inline-block border rounded px-2 py-1 bg-white text-gray-500">
                LLM is thinking…
              </span>
            </div>
          )}
          {!!err && <div className="text-xs text-red-600">Error: {err}</div>}
        </div>

        <form onSubmit={send} className="border-t p-2 flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder={loading ? "Waiting for reply…" : "Type a message…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
          <button className="border rounded px-3 py-1" disabled={loading}>
            {loading ? "Sending…" : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
