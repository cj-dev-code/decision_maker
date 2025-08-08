"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function LLMDialog() {
  const [msgs, setMsgs] = useState([
    { role: "system", text: "LLM ready. Ask about your decision." },
  ]);
  const [text, setText] = useState("");

  const listRef = useRef(null);

  // Stick to bottom on mount
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Stick to bottom when new messages render
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // only snap if user is already near the bottom (so we don't yank them while reading history)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, [msgs]);

  const send = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setMsgs((m) => [
      ...m,
      { role: "user", text },
      { role: "assistant", text: "…stub reply…" },
    ]);
    setText("");
  };

  return (
    <div className="h-full border rounded flex flex-col">
      <div className="px-3 py-2 font-medium border-b">LLM Dialogue</div>

      {/* messages */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-sm"
      >
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span className="inline-block border rounded px-2 py-1">
              <strong className="mr-1">{m.role === "user" ? "You:" : "LLM:"}</strong>
              {m.text}
            </span>
          </div>
        ))}
      </div>

      {/* input */}
      <form onSubmit={send} className="border-t p-2 flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="border rounded px-3 py-1">Send</button>
      </form>
    </div>
  );
}
