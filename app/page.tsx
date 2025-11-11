"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm a lightweight agent. Try: 'weather in Tokyo', 'wiki Ada Lovelace', or a math expression like 2*(3+4)."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed, history: next.slice(-8) })
      });
      const data = await res.json();
      const text: string = data?.reply ?? "(no response)";
      setMessages(m => [...m, { role: "assistant", content: text }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e?.message ?? e}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div>
            <div className="title">Agentic 7a98c897</div>
            <div className="subtitle">Wiki ? Weather ? Calculator ? Optional LLM</div>
          </div>
        </div>
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.content}</div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="inputRow">
          <input
            className="input"
            placeholder="Ask something..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button className="button" onClick={send} disabled={loading}>{loading ? "..." : "Send"}</button>
        </div>
        <div className="hint">Examples: weather in Paris ? wiki Grace Hopper ? 3*(5+7)</div>
      </div>
      <div className="footer">Deployed on Vercel. No API key required for core tools.</div>
    </div>
  );
}
