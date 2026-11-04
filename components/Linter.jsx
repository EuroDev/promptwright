"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  MODELS, TASK_TYPES, SAMPLES, MODEL_NOTES,
  analyze, specialize, gradeFor, buildRewrite,
} from "@/lib/engine";

const CIRC = 2 * Math.PI * 50;
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Highlight blanks, XML tags and section headers inside the rewritten prompt. */
function highlight(text) {
  return esc(text)
    .replace(/⟦[^⟧]*⟧/g, (m) => `<span class="slot">${m}</span>`)
    .replace(/&lt;\/?[a-z_]+[^&]*?&gt;/g, (m) => `<span class="tag">${m}</span>`)
    .replace(/^(#{1,2} .+|[A-Z][A-Z _]{3,}|─+[^\n]*)$/gm, (m) => `<span class="hd">${m}</span>`);
}

export default function Linter() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [task, setTask] = useState(SAMPLES[0].task);
  const [model, setModel] = useState("claude");
  const [toast, setToast] = useState("");
  const taRef = useRef(null);
  const toastTimer = useRef(null);

  // Pure derivation — no effects, no network. Re-scores as you type.
  const a = useMemo(() => (text.trim() ? analyze(text, task) : null), [text, task]);
  const rewrite = useMemo(() => (a ? buildRewrite(a, model, task) : ""), [a, model, task]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function flash(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1700);
  }

  function copy(str, ok) {
    if (!str) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str).then(() => flash(ok)).catch(() => flash("copy blocked"));
    } else flash("copy unavailable");
  }

  function scoreCard() {
    if (!a) return "";
    const gaps = a.dims.filter((d) => d.score < 70).map((d) => d.label.toLowerCase());
    const lines = [
      `Prompt score: ${a.total}/100 — ${gradeFor(a.total, a.words)[0]}`,
      `Target model: ${MODELS.find((m) => m.id === model).name}`,
    ];
    if (a.warnings.length) lines.push("Problems: " + a.warnings.map((w) => w.t).join("; "));
    lines.push(gaps.length ? "Missing: " + gaps.join(", ") : "Nothing missing.");
    lines.push("", "Scored free at promptwright.cloud");
    return lines.join("\n");
  }

  function addSuggestion(key) {
    const add = specialize(key, a).add;
    if (!add) return;
    setText((t) => t.replace(/\s*$/, "") + "\n\n" + add);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const score = a ? a.total : 0;
  const [grade, gradeNote] = gradeFor(score, words);
  const gaps = a
    ? a.dims.filter((d) => d.score < 70)
        .sort((x, y) => y.w * (100 - y.score) - x.w * (100 - x.score))
    : [];
  const arcColor = !a ? "var(--line-hard)" : score >= 70 ? "var(--jade)" : score >= 40 ? "var(--amber)" : "var(--clay)";

  return (
    <div className="bench" id="tool">
      {/* ---------------- input ---------------- */}
      <div className="panel">
        <div className="panel-pad">
          <div className="block">
            <span className="field-label">
              Target model <span className="hint">— changes the rewrite, not the score</span>
            </span>
            <div className="chips" role="group" aria-label="Target model">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="chip"
                  aria-pressed={m.id === model}
                  onClick={() => setModel(m.id)}
                >
                  <span className="dot" />
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="block">
            <label className="field-label" htmlFor="taskType">
              Task type <span className="hint">— changes what counts as missing</span>
            </label>
            <select id="taskType" value={task} onChange={(e) => setTask(e.target.value)}>
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="block">
            <label className="field-label" htmlFor="promptIn">Your prompt</label>
            <textarea
              id="promptIn"
              className="prompt"
              ref={taRef}
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the prompt you're trying to use…"
            />
            <div className="meta-row">
              <span className="count">{words === 1 ? "1 word" : `${words} words`}</span>
              <span className="count">scores as you type</span>
            </div>
            <div className="samples">
              <span className="count">Try:</span>
              {["weak marketing ask", "vague code ask", "research ask", "already decent", "conflicting ask"].map((label, i) => (
                <button key={i} type="button" onClick={() => { setText(SAMPLES[i].text); setTask(SAMPLES[i].task); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="block">
            <span className="field-label">How the score works</span>
            <p style={{ fontSize: 13, color: "var(--ink-2)", maxWidth: "48ch" }}>
              Nine weighted channels, scored by looking for the linguistic markers of each in your
              text — a role statement, an imperative task verb, stated purpose, a named audience, a
              format, a length bound, exclusions, worked examples, and a definition of done. The
              weights shift with the task type. Hedge words like <em>good</em> and <em>engaging</em>{" "}
              count against specificity; concrete particulars like versions and measurements count
              for it.
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-2)", maxWidth: "48ch", marginTop: 10 }}>
              Separately it flags four things that are <em>present and wrong</em>: contradictory
              instructions, references to content you didn&apos;t paste, four or more unrelated asks
              in one prompt, and unbounded lists.
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- readout ---------------- */}
      <div className="panel right">
        <div className="panel-pad">
          <div className="readout-head">
            <div className="gauge">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-2)" strokeWidth="11" />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke={arcColor} strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={CIRC}
                  strokeDashoffset={CIRC - (CIRC * score) / 100}
                />
              </svg>
              <div className="val">
                <div className="num">{a ? score : "—"}</div>
                <div className="den">PROMPT SCORE</div>
              </div>
            </div>
            <div className="verdict">
              <div className="grade">{grade}</div>
              <p>{a && a.hedges.length ? `${gradeNote} Hedge words found: ${a.hedges.slice(0, 6).join(", ")}.` : gradeNote}</p>
            </div>
          </div>

          {a && (
            <div className="channels">
              {a.dims.map((d) => (
                <div className={`ch s-${d.state}`} key={d.key}>
                  <div className="ch-name">{d.label}<span className="w">w{d.w}</span></div>
                  <div className="ch-score">{d.score}</div>
                  <div className="ch-track"><div className="ch-fill" style={{ width: `${d.score}%` }} /></div>
                </div>
              ))}
            </div>
          )}

          {a && a.warnings.length > 0 && (
            <>
              <h3 className="sec">Problems in what&apos;s there</h3>
              <div className="warn">
                {a.warnings.map((w, i) => (
                  <div className="warn-item" key={i}>
                    <div className="t">{w.t}</div>
                    <div className="y">{w.y}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="sec">Missing <span className="tally">{gaps.length}</span></h3>
          <div className="sug">
            {!a ? null : gaps.length === 0 ? (
              <div className="empty-ok">
                Nothing missing. All nine channels score 70 or above for a{" "}
                {TASK_TYPES.find((t) => t.id === task).label.toLowerCase()} task.
              </div>
            ) : (
              gaps.map((d) => {
                const ad = specialize(d.key, a);
                const pri = d.score < 35 && d.w >= 12 ? "p-high" : d.score < 35 ? "p-med" : "p-low";
                const detail =
                  d.key === "task" && a.hedges.length
                    ? `${ad.y} You used: ${a.hedges.slice(0, 5).join(", ")}.`
                    : ad.y;
                return (
                  <div className={`sug-item ${pri}`} key={d.key}>
                    <div>
                      <div className="t">{ad.t}</div>
                      <div className="y">{detail}</div>
                    </div>
                    {ad.add ? (
                      <button className="btn ghost sm" type="button" onClick={() => addSuggestion(d.key)}>
                        Add
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="out-head" style={{ marginTop: 26 }}>
            <h3 className="sec" style={{ margin: 0 }}>
              Revised prompt — {MODELS.find((m) => m.id === model).name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {toast ? <span className="toast">{toast}</span> : null}
              <button className="btn ghost sm" type="button" onClick={() => copy(scoreCard(), "score copied")}>
                Copy score
              </button>
              <button className="btn ghost sm" type="button" onClick={() => copy(rewrite, "prompt copied")}>
                Copy
              </button>
            </div>
          </div>

          <pre className="out" dangerouslySetInnerHTML={{ __html: a ? highlight(rewrite) : "Paste a prompt to see the rewrite." }} />

          {a && (
            <div className="notes">
              {MODEL_NOTES[model].map((t, i) => (
                <div className="note" key={i}>
                  <span className="m">→</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
