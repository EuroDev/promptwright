/**
 * Waitlist capture.
 *
 * Two supported backends, picked by whichever env var is set:
 *   LOOPS_API_KEY        → creates a contact in Loops (recommended)
 *   WAITLIST_WEBHOOK_URL → POSTs the JSON anywhere (Zapier, Make, your own endpoint)
 *
 * With neither configured the route returns 503 and says so, rather than
 * pretending to save an address it has thrown away.
 */

// No route segment config: Next 16's Cache Components forbids it, and a POST
// handler is uncached and dynamic by default regardless.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Best-effort throttle. Serverless instances don't share memory, so this stops
   casual repeat submissions, not a determined flood. Phase 2 moves it to Upstash. */
const seen = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function throttled(key) {
  const now = Date.now();
  const hits = (seen.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(key, hits);
  if (seen.size > 5000) seen.clear(); // crude ceiling; this map is not a database
  return hits.length > MAX_PER_WINDOW;
}

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Malformed request." }, 400);
  }

  const { email, role = "", model = "", note = "", company = "" } = payload || {};

  // Honeypot: real people never see this field, bots fill everything.
  if (company) return json({ ok: true }, 200);

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return json({ ok: false, error: "That doesn't look like an email address." }, 400);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (throttled(ip)) {
    return json({ ok: false, error: "Too many attempts. Try again in a minute." }, 429);
  }

  const entry = {
    email: email.trim().toLowerCase(),
    role: String(role).slice(0, 80),
    model: String(model).slice(0, 40),
    note: String(note).slice(0, 400),
    source: "promptwright.cloud",
    joinedAt: new Date().toISOString(),
  };

  try {
    if (process.env.LOOPS_API_KEY) {
      const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
        },
        body: JSON.stringify({
          email: entry.email,
          source: entry.source,
          userGroup: "waitlist",
          role: entry.role,
          favouriteModel: entry.model,
          note: entry.note,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // Already-subscribed is a success from the visitor's point of view.
        if (res.status === 409 || /already/i.test(detail)) return json({ ok: true, already: true }, 200);
        console.error("loops rejected signup", res.status, detail.slice(0, 300));
        return json({ ok: false, error: "Couldn't save that right now. Try again shortly." }, 502);
      }
      return json({ ok: true }, 200);
    }

    if (process.env.WAITLIST_WEBHOOK_URL) {
      const res = await fetch(process.env.WAITLIST_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        console.error("waitlist webhook rejected signup", res.status);
        return json({ ok: false, error: "Couldn't save that right now. Try again shortly." }, 502);
      }
      return json({ ok: true }, 200);
    }
  } catch (e) {
    console.error("waitlist backend error", e);
    return json({ ok: false, error: "Couldn't reach the list. Try again shortly." }, 502);
  }

  return json(
    { ok: false, error: "The list isn't connected yet. Set LOOPS_API_KEY and redeploy." },
    503,
  );
}
