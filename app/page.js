import Link from "next/link";
import Linter from "@/components/Linter";
import WaitlistForm from "@/components/WaitlistForm";
import ThemeToggle from "@/components/ThemeToggle";
import { MODELS } from "@/lib/engine";

export default function Home() {
  return (
    <>
      <header className="bar">
        <div className="wrap bar-in">
          <Link href="/" className="mark"><span className="caret">&gt;</span>Promptwright</Link>
          <nav>
            <a href="#tool">Optimizer</a>
            <a href="#models">Model profiles</a>
            <a href="#pricing">Pricing</a>
            <a href="#join">Get the build</a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main>
        <div className="wrap hero">
          <div className="eyebrow">Prompt linter &amp; rewriter</div>
          <h1>Your prompt is fine. It&apos;s just missing nine things.</h1>
          <p className="lede">
            Paste the prompt you&apos;re about to send. Promptwright scores it on the nine things
            models actually need, flags what&apos;s contradictory or dangling, tells you what&apos;s
            missing and why it matters, then rewrites it{" "}
            <b>in the shape your target model was documented to prefer</b> — XML sections for
            Claude, developer-message structure for GPT, few-shot-first for Gemini, lean and
            conversational for Grok.
          </p>
          <div className="free">
            Free, no signup, and your prompt never leaves your browser
          </div>
        </div>

        <Linter />

        {/* ---------------- model profiles ---------------- */}
        <section className="band alt" id="models">
          <div className="wrap">
            <div className="band-head">
              <h2>The same instruction, five different shapes</h2>
              <p>
                Every vendor publishes its own prompting guidance, and the advice genuinely
                conflicts on structure. Promptwright keeps one profile per model family and
                reshapes your prompt to match it.
              </p>
            </div>
            <div className="grid-models">
              {MODELS.map((m) => (
                <article className="mcard" key={m.id}>
                  <h3>{m.name}</h3>
                  <div className="vendor">{m.vendor} · {m.confidence}</div>
                  <ul>
                    {m.bullets.map((b, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: b }} />
                    ))}
                  </ul>
                  <div className="shape">{m.shape}</div>
                </article>
              ))}
            </div>
            <p style={{ marginTop: 20, fontSize: 12.5, color: "var(--ink-3)", maxWidth: "72ch" }}>
              Claude, GPT and Gemini guidance is drawn from the vendors&apos; own
              prompt-engineering docs. The Grok and open-weights profiles come from community
              write-ups, because xAI publishes no equivalent guide — they&apos;re marked
              lower-confidence here for that reason.
            </p>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="band" id="pricing">
          <div className="wrap">
            <div className="band-head">
              <h2>Free where it&apos;s a tool. Paid where it&apos;s a workflow.</h2>
              <p>
                The linter above is free and stays free — it runs in your browser and costs nothing
                to serve, so there&apos;s no reason to put it behind a signup. What&apos;s coming is
                the part that needs a server: the rewrite written by a model, and proof that it
                actually beat your original.
              </p>
            </div>
            <div className="tiers">
              <div className="tier">
                <h3>Linter</h3>
                <div className="price">$0<span> / forever</span></div>
                <ul>
                  <li>Unlimited scoring and rewrites</li>
                  <li>All five model profiles</li>
                  <li>No account, no limits</li>
                  <li>Nothing leaves your browser</li>
                </ul>
              </div>
              <div className="tier feature">
                <div className="flag">In build</div>
                <h3>Pro</h3>
                <div className="price">$16<span> / month</span></div>
                <ul>
                  <li>Rewrites written by a model, not a template</li>
                  <li>Side-by-side A/B on the real target model</li>
                  <li>Browser extension for ChatGPT, Claude &amp; Gemini</li>
                  <li>Saved library with version history</li>
                </ul>
              </div>
              <div className="tier">
                <div className="flag">Later</div>
                <h3>Team</h3>
                <div className="price">$24<span> / seat / month</span></div>
                <ul>
                  <li>Shared prompt library with approvals</li>
                  <li>House style rules</li>
                  <li>SSO and audit log</li>
                  <li>Prompts never used for training</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- waitlist ---------------- */}
        <section className="band alt" id="join">
          <div className="wrap">
            <div className="band-head">
              <h2>Get the first build</h2>
              <p>
                The linter works today. Accounts, the browser extension, and A/B against GPT and
                Gemini are what&apos;s next. Leave an address and you&apos;ll get it before anyone
                else.
              </p>
            </div>
            <div className="join-grid">
              <WaitlistForm />
              <div className="join-side">
                <div className="card">
                  <h4>Where this goes</h4>
                  Your address goes to the mailing list and nowhere else. No sharing, no reselling,
                  and <b>every email has an unsubscribe link</b>. You&apos;ll hear from me when
                  there&apos;s a build worth opening, not weekly.
                </div>
                <div className="card">
                  <h4>The one question that matters</h4>
                  The optional box is the useful one. Knowing what would make you switch is worth
                  more to me than the address.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="flinks">
            <Link href="/privacy">Privacy</Link>
            <a href="#tool">Linter</a>
            <a href="#join">Waitlist</a>
          </div>
          <p className="fine">
            Model profiles reflect published guidance from{" "}
            <a href="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices">Anthropic</a>,{" "}
            <a href="https://developers.openai.com/api/docs/guides/prompt-engineering">OpenAI</a> and{" "}
            <a href="https://aistudio.google.com/docs/prompting-strategies">Google</a>, plus
            community sources for Grok and open-weight models. Promptwright is not affiliated with
            Anthropic, OpenAI, Google or xAI.
          </p>
        </div>
      </footer>
    </>
  );
}
