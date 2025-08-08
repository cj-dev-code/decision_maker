// components/tools/LLMDialog.jsx
"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export default function LLMDialog() {
  // -------- conversation state
  const initialCurrent = useMemo(
    () => [{ role: "system", text: "LLM ready. Ask about your decision." }],
    []
  );
  const [current, setCurrent] = useState(initialCurrent);
  const [saved, setSaved] = useState([]); // [{id,title,messages,createdAt}]
  const [selected, setSelected] = useState({ type: "current", id: null }); // or {type:'saved', id}

  // -------- sidebar rename state
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // -------- message list ref + autoscroll
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

  // -------- helpers
  const rid = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id_" + Math.random().toString(36).slice(2);

  // first 20 chars of first user message (default title)
  const defaultTitleFrom = (msgs) => {
    const firstUser = msgs.find(m => m.role === "user")?.text?.trim() ?? "";
    if (!firstUser) return "Saved Dialogue";
    const raw = firstUser.slice(0, 20);
    return raw + (firstUser.length > 20 ? "…" : "");
  };

  const openCurrent = () => setSelected({ type: "current", id: null });
  const openSaved = (id) => setSelected({ type: "saved", id });

  const selectedMessages = useMemo(() => {
    if (selected.type === "current") return current;
    const convo = saved.find(s => s.id === selected.id);
    return convo?.messages ?? [];
  }, [selected, current, saved]);

  const setSelectedMessages = (updater) => {
    if (selected.type === "current") {
      setCurrent(prev => (typeof updater === "function" ? updater(prev) : updater));
    } else {
      setSaved(prev =>
        prev.map(s => (s.id === selected.id ? { ...s, messages: typeof updater === "function" ? updater(s.messages) : updater } : s))
      );
    }
  };

  // -------- actions
  const [text, setText] = useState("");
  const send = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setSelectedMessages(prev => [...prev, { role: "user", text }]);
    setText("");
    setTimeout(() => {
      setSelectedMessages(prev => [...prev, { role: "assistant", text: "…stub reply…" }]);
    }, 200);
  };

  const saveCurrent = () => {
    if (!current.length) return;
    const id = rid();
    const title = defaultTitleFrom(current);
    setSaved(prev => [{ id, title, createdAt: new Date().toISOString(), messages: current }, ...prev]);
    setCurrent(initialCurrent);               // reset Current Dialogue
    setSelected({ type: "current", id: null });
  };

  const deleteSaved = (id) => {
    setSaved(prev => prev.filter(s => s.id !== id));
    if (selected.type === "saved" && selected.id === id) setSelected({ type: "current", id: null });
    if (editingId === id) { setEditingId(null); setEditingTitle(""); }
  };

  // rename handlers
  const startRename = (item) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };
  const commitRename = () => {
    const title = editingTitle.trim() || "Saved Dialogue";
    setSaved(prev => prev.map(s => (s.id === editingId ? { ...s, title } : s)));
    setEditingId(null);
    setEditingTitle("");
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  // -------- UI
  const isCurrent = selected.type === "current";
  const headerTitle = isCurrent ? "Current Dialogue" : (saved.find(s => s.id === selected.id)?.title ?? "Dialogue");

  return (
    <div className="h-full border rounded flex">
      {/* ===== Left: saved list ===== */}
      <aside className="w-56 border-r flex flex-col min-h-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Saved Dialogues</div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          {/* Current pinned */}
          <button
            onClick={openCurrent}
            className={`w-full text-left border rounded px-2 py-1 text-sm ${isCurrent ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            Current Dialogue
          </button>

          {/* Saved list */}
          {saved.map(s => (
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
                  className={`flex-1 text-left border rounded px-2 py-1 text-sm ${selected.type==='saved' && selected.id===s.id ? "bg-gray-100" : "hover:bg-gray-50"}`}
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

      {/* ===== Right: chat ===== */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <div className="font-medium">{headerTitle}</div>
          <div className="ml-auto flex items-center gap-2">
            {isCurrent && (
              <button onClick={saveCurrent} className="border rounded px-3 py-1">Save</button>
            )}
          </div>
        </div>

        {/* messages */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-sm">
          {selectedMessages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <span className="inline-block border rounded px-2 py-1 bg-white">
                <strong className="mr-1">{m.role === "user" ? "You:" : "LLM:"}</strong>
                {m.text}
              </span>
            </div>
          ))}
          {!selectedMessages.length && (
            <div className="text-xs text-gray-500">No messages yet.</div>
          )}
        </div>

        {/* composer */}
        <form onSubmit={send} className="border-t p-2 flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="border rounded px-3 py-1">Send</button>
        </form>
      </section>
    </div>
  );
}
