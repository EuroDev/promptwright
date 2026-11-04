"use client";

import { useState } from "react";
import { MODELS } from "@/lib/engine";

export default function WaitlistForm() {
  const [state, setState] = useState("idle"); // idle | sending | done
  const [msg, setMsg] = useState({ text: "", kind: "" });

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      email: String(form.get("email") || "").trim(),
      role: String(form.get("role") || ""),
      model: String(form.get("model") || ""),
      note: String(form.get("note") || "").trim(),
      company: String(form.get("company") || ""), // honeypot
    };

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
      setMsg({ text: "That doesn't look like an email address.", kind: "bad" });
      return;
    }

    setState("sending");
    setMsg({ text: "Sending…", kind: "" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setState("done");
        setMsg({ text: data.already ? "You're already on the list." : "You're on the list.", kind: "ok" });
      } else {
        setState("idle");
        setMsg({ text: data.error || "Couldn't save that. Try again shortly.", kind: "bad" });
      }
    } catch {
      setState("idle");
      setMsg({ text: "Network error. Try again shortly.", kind: "bad" });
    }
  }

  if (state === "done") {
    return (
      <div className="join-form" role="status">
        <h3 style={{ fontSize: 17 }}>You&apos;re on the list.</h3>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
          You&apos;ll get the first build before it goes anywhere else. In the meantime the linter
          above is free and always will be — no account needed.
        </p>
      </div>
    );
  }

  return (
    <form className="join-form" onSubmit={onSubmit} noValidate>
      <div className="jf-row">
        <label htmlFor="jfEmail">Email</label>
        <input type="email" id="jfEmail" name="email" placeholder="you@example.com" autoComplete="email" required />
      </div>

      <div className="jf-two">
        <div className="jf-row">
          <label htmlFor="jfRole">What you do</label>
          <select id="jfRole" name="role" defaultValue="">
            <option value="">Prefer not to say</option>
            <option>Engineering</option>
            <option>Marketing / content</option>
            <option>Founder / product</option>
            <option>Research / analysis</option>
            <option>Design</option>
            <option>Something else</option>
          </select>
        </div>
        <div className="jf-row">
          <label htmlFor="jfModel">Model you use most</label>
          <select id="jfModel" name="model" defaultValue="">
            <option value="">No strong preference</option>
            {MODELS.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="jf-row">
        <label htmlFor="jfNote">
          What would make this worth paying for? <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea id="jfNote" name="note" maxLength={400} placeholder="The one thing that would make you switch from whatever you do now." />
      </div>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input type="text" id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Join the list"}
        </button>
        <span className={`jf-msg ${msg.kind}`}>{msg.text}</span>
      </div>
    </form>
  );
}
