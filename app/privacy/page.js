import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description:
    "What Promptwright does and doesn't collect. The linter runs entirely in your browser — prompts are never sent to a server.",
};

export default function Privacy() {
  return (
    <>
      <header className="bar">
        <div className="wrap bar-in">
          <Link href="/" className="mark"><span className="caret">&gt;</span>Promptwright</Link>
        </div>
      </header>

      <main className="wrap prose">
        <h1>Privacy</h1>
        <p>
          Short version: <strong>your prompts never leave your browser</strong>, and the only
          personal data collected is an email address you deliberately type into the waitlist form.
        </p>

        <h2>Prompts</h2>
        <p>
          The linter — scoring, the warnings, the suggestions and the rewrite — is JavaScript that
          runs on your own machine. Your prompt is not uploaded, not logged, not stored, and not
          seen by anyone. You can confirm this: open your browser&apos;s network tab and type into
          the box. Nothing is sent.
        </p>
        <p>
          This is a deliberate design decision, not a temporary state. People paste confidential
          material into prompt tools — unreleased copy, client names, source code. The free linter
          will keep working this way.
        </p>
        <p>
          When paid features arrive that genuinely need a server — a rewrite written by a model,
          or running your prompt against GPT or Gemini — those will send that specific prompt to
          that specific provider, only when you press the button, and this page will say so before
          it ships.
        </p>

        <h2>The waitlist</h2>
        <p>If you submit the form, the following is stored by the mailing-list provider:</p>
        <ul>
          <li>your email address;</li>
          <li>the optional role and model you selected;</li>
          <li>the optional note you wrote.</li>
        </ul>
        <p>
          It is used to email you about Promptwright and nothing else. It is not sold, shared or
          passed to advertisers. Every email includes an unsubscribe link, and unsubscribing
          removes you. To be deleted sooner, reply to any email and ask.
        </p>

        <h2>Analytics</h2>
        <p>
          Aggregate page analytics record which pages are visited and roughly where visitors come
          from. No cookie is set for advertising, no profile is built, and analytics never see the
          content of your prompts.
        </p>

        <h2>Local storage</h2>
        <p>
          Your light or dark theme preference is stored in your own browser. It never reaches a
          server and clearing your browser data removes it.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about any of this, or a deletion request: reply to any email from the list.
        </p>

        <p style={{ marginTop: 32, fontSize: 13, color: "var(--ink-3)" }}>
          Last updated 4 November 2026.
        </p>
      </main>

      <footer>
        <div className="wrap">
          <div className="flinks"><Link href="/">Back to the linter</Link></div>
        </div>
      </footer>
    </>
  );
}
