// components/tools/LLMDialog.jsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export default function LLMDialog({
  tool = "purpose_finder",
  systemOverride,
  toolsMeta = [],
}) {
  // --- config / utils
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

  const rid = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id_" + Math.random().toString(36).slice(2);

  const getToolLabel = (slug) =>
    toolsMeta.find((t) => t.slug === slug)?.label || slug;

  const GENERIC_OPENER = "How can I help you?";

  // --- state
  const [current, setCurrent] = useState([]); // new-dialogue working buffer
  const [saved, setSaved] = useState([]);     // [{id,title,messages,createdAt,tool}]
  const [selected, setSelected] = useState({ type: "current", id: null });

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

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

  // --- helpers
  const hasAnyUser = (msgs) => msgs.some((m) => m.role === "user");
  const hasContent = (msgs) => msgs.some((m) => m.role === "user" || m.role === "assistant");
  const messagesEqual = (a, b) =>
    a.length === b.length && a.every((m, i) => m.role === b[i]?.role && m.text === b[i]?.text);

  const firstUserSnippet = (msgs) => {
    const firstUser = msgs.find((m) => m.role === "user")?.text?.trim();
    if (!firstUser) return "";
    const raw = firstUser.slice(0, 20);
    return raw + (firstUser.length > 20 ? "…" : "");
  };

  // Title rule used for both header (preview) and actual save:
  // - If no existing saved chat for this tool -> use tool label
  // - Else -> use first 20 chars of first user message, or tool label if none
  const computeSavedTitle = (msgs, toolSlug, savedList) => {
    const label = getToolLabel(toolSlug);
    const exists = savedList.some((s) => s.tool === toolSlug);
    if (!exists) return label;
    const snippet = firstUserSnippet(msgs);
    return snippet || label;
  };

  const openCurrent = () => {
    setSelected({ type: "current", id: null });
    // If the tool already has a saved chat, reset to a generic (non-tool) opener.
    const hasSavedForTool = saved.some((s) => s.tool === tool);
    if (hasSavedForTool) {
      setCurrent([{ role: "assistant", text: GENERIC_OPENER }]);
      // prevent any auto-init opener from firing
      initKeyRef.current = null;
    }
  };

  const openSaved = (id) => setSelected({ type: "saved", id });

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

  function toBackendHistory(msgs) {
    return msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(({ role, text }) => ({ role, content: text }));
  }

  // --- tool switching / auto-save
  const prevToolRef = useRef(tool);
  const initKeyRef = useRef(null);

  useEffect(() => {
    if (prevToolRef.current === tool) return;

    const prevTool = prevToolRef.current;

    // 1) If on current and it has content, save it under the PREVIOUS tool
    if (selected.type === "current" && hasContent(current)) {
      setSaved((prevSaved) => {
        const already = prevSaved.find(
          (s) => s.tool === prevTool && messagesEqual(s.messages, current)
        );
        if (already) return prevSaved;

        const id = rid();
        const title = computeSavedTitle(current, prevTool, prevSaved);
        const entry = {
          id,
          title,
          createdAt: new Date().toISOString(),
          tool: prevTool,
          messages: [...current], // clone to prevent spillover
        };
        return [entry, ...prevSaved];
      });
    }

    // 2) Open existing saved chat for the NEW tool, else start fresh.
    const found = saved.find((s) => s.tool === tool);
    if (found) {
      setSelected({ type: "saved", id: found.id });
      // Ensure the new-dialogue buffer is clean (prevents later spillover)
      setCurrent([]);
      initKeyRef.current = null;
    } else {
      setSelected({ type: "current", id: null });
      setCurrent([]); // ensure empty so init will run
      initKeyRef.current = null;
    }

    setErr("");
    prevToolRef.current = tool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // --- auto-init: only when no saved chat exists for this tool and current is empty
  useEffect(() => {
    const hasSavedForTool = saved.some((s) => s.tool === tool);
    if (selected.type !== "current") return;
    if (hasSavedForTool) return;    // if there is a saved chat, never auto-init
    if (current.length > 0) return;

    const key = `current::${tool}`;
    if (initKeyRef.current === key) return;

    let alive = true;
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
        const opener =
          typeof data?.reply === "string"
            ? data.reply
            : "What decision are we working on?";

        if (!alive) return;
        const stillSavedForTool = saved.some((s) => s.tool === tool);
        if (selected.type !== "current") return;
        if (stillSavedForTool) return; // a saved chat appeared, don't add opener
        if (initKeyRef.current === key) return;

        setSelectedMessages((prev) => [...prev, { role: "assistant", text: opener }]);
        initKeyRef.current = key;
      } catch {
        if (!alive) return;
        setSelectedMessages((prev) => [
          ...prev,
          { role: "assistant", text: "⚠️ Couldn’t start the session. Try sending a message." },
        ]);
      } finally {
        if (alive) setThinking(false);
      }
    })();

    return () => { alive = false; };
  }, [tool, selected.type, current.length, saved, API_URL, systemOverride]);

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

  // --- manual save button
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
        messages: [...current], // clone to prevent spillover
      };
      return [entry, ...prevSaved];
    });

    // Hard reset the "New Dialogue" buffer to a generic, non-tool opener
    setCurrent([{ role: "assistant", text: GENERIC_OPENER }]);
    setSelected({ type: "current", id: null });
    setText("");
    setErr("");
    setThinking(false);
    setLoading(false);
    initKeyRef.current = null; // do not auto-init; this is generic mode
  };

  // --- delete / rename
  const deleteSaved = (id) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    if (selected.type === "saved" && selected.id === id)
      setSelected({ type: "current", id: null });
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle("");
    }
  };

  const startRename = (item) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };
  const commitRename = () => {
    const title = editingTitle.trim() || "Dialogue";
    setSaved((prev) => prev.map((s) => (s.id === editingId ? { ...s, title } : s)));
    setEditingId(null);
    setEditingTitle("");
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  // --- header title logic (preview shows what the save-name will be)
  const isCurrent = selected.type === "current";
  const hasSavedForTool = saved.some((s) => s.tool === tool);
  const headerTitle = (() => {
    if (isCurrent) {
      if (!hasAnyUser(current)) {
        // If there is already a saved chat for this tool, call it "New Dialogue".
        if (hasSavedForTool) return "New Dialogue";
        // Otherwise, preview the eventual save-name for a first chat: tool label.
        return computeSavedTitle(current, tool, saved);
      }
      // With user input, preview the eventual save-name now.
      return computeSavedTitle(current, tool, saved);
    }
    // Saved chat
    return saved.find((s) => s.id === selected.id)?.title ?? "Dialogue";
  })();

  // --- render
  return (
    <div className="h-full border rounded flex">
      <aside className="w-56 border-r flex flex-col min-h-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Saved Dialogues</div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          <button
            onClick={openCurrent}
            className={`w-full text-left border rounded px-2 py-1 text-sm ${
              isCurrent ? "bg-gray-100" : "hover:bg-gray-50"
            }`}
          >
            New Dialogue
          </button>

          {saved.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
              ) : (
                <button
                  onClick={() => openSaved(s.id)}
                  onDoubleClick={() => startRename(s)}
                  className={`flex-1 text-left border rounded px-2 py-1 text-sm ${
                    selected.type === "saved" && selected.id === s.id
                      ? "bg-gray-100"
                      : "hover:bg-gray-50"
                  }`}
                  title={`${s.title}\n(Double-click to rename)`}
                >
                  {s.title}
                </button>
              )}
              <button
                onClick={() => deleteSaved(s.id)}
                className="border rounded px-2 text-xs"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <div className="font-medium">{headerTitle}</div>
          <div className="ml-auto flex items-center gap-2">
            {isCurrent && (
              <button onClick={saveCurrent} className="border rounded px-3 py-1">
                Save
              </button>
            )}
          </div>
        </div>

        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-sm"
        >
          {selectedMessages
            .filter((m) => m.role !== "system")
            .map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span className="inline-block border rounded px-2 py-1 bg-white">
                  <strong className="mr-1">
                    {m.role === "user" ? "You:" : "LLM:"}
                  </strong>
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
          {!selectedMessages.length && !thinking && (
            <div className="text-xs text-gray-500">No messages yet.</div>
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
