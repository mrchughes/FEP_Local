import React, { useState } from "react";
import "../styles/govuk-overrides.css";

const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi! I can answer any questions you have about this form or DWP policy." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { from: "user", text: input }]);
    setLoading(true);
    setInput("");
    try {
      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5200/api";
      const res = await fetch(`${API_URL}/ai-agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });
      const data = await res.json();
      setMessages((msgs) => [...msgs, { from: "bot", text: data.response }]);
    } catch {
      setMessages((msgs) => [...msgs, { from: "bot", text: "Sorry, I couldn't get a response." }]);
    }
    setLoading(false);
  };

  return (
    <div className="govuk-chatbot-widget" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000 }}>
      <button
        className="govuk-button govuk-button--secondary"
        style={{ borderRadius: 24, minWidth: 48, minHeight: 48, padding: 8, fontSize: 18 }}
        aria-label="Open help chatbot"
        onClick={() => setOpen((o) => !o)}
      >
        💬 Help
      </button>
      {open && (
        <div className="govuk-chatbot-panel govuk-body" style={{ width: 320, background: "#fff", border: "1px solid #b1b4b6", borderRadius: 8, boxShadow: "0 2px 8px #0002", padding: 16, marginTop: 8 }}>
          <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 8 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ textAlign: msg.from === "user" ? "right" : "left", margin: "4px 0" }}>
                <span style={{ background: msg.from === "user" ? "#1d70b8" : "#f3f2f1", color: msg.from === "user" ? "#fff" : "#0b0c0c", borderRadius: 12, padding: "6px 12px", display: "inline-block", maxWidth: 240, wordBreak: "break-word" }}>
                  {msg.text}
                </span>
              </div>
            ))}
            {loading && <div className="govuk-body-s" style={{ color: "#6c757d" }}>AI is typing…</div>}
          </div>
          <form onSubmit={handleSend} style={{ display: "flex", gap: 4 }}>
            <input
              className="govuk-input"
              style={{ flex: 1, minWidth: 0 }}
              type="text"
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              aria-label="Type your question"
            />
            <button className="govuk-button" style={{ padding: "0 12px", minWidth: 0 }} disabled={loading}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatbotWidget;
