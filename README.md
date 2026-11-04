# Promptwright

A prompt linter. Paste a prompt, get it scored on nine weighted channels, see what's
contradictory or missing, and get it rewritten in the shape your target model's own
documentation recommends.

**The linter runs entirely in the browser.** No prompt is ever sent to a server. That is
what makes the free tier cost nothing to serve, and it is the thing not to break.

---

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

> **Note:** hot-reload needs a websocket. If you open the dev server through a proxy or an
> embedded preview pane that blocks `ws://localhost:3000/_next/hmr`, React will server-render
> the page but never hydrate, and nothing will be clickable. That is the proxy, not the code —
> `npm run build && npm run start` behaves correctly, and so does a normal browser tab.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. Nothing here is required to run the
linter; they only affect the waitlist and canonical URLs.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, used for Open Graph, `robots.txt` and the sitemap. |
| `LOOPS_API_KEY` | Sends signups to [Loops](https://loops.so). Recommended. |
| `WAITLIST_WEBHOOK_URL` | Alternative: POSTs signup JSON to any endpoint. Ignored if `LOOPS_API_KEY` is set. |

With neither backend configured, `POST /api/waitlist` returns **503** and says so. It never
pretends to have saved an address it discarded.

> Verify the Loops endpoint and field names against their current API docs before launch —
> the integration in `app/api/waitlist/route.js` was written against their documented
> `contacts/create` shape but has not been run against a live key.

## Deploy to Vercel

1. Push this branch to GitHub.
2. In Vercel, **Add New → Project**, import the repo. The defaults are correct; it detects
   Next.js on its own.
3. Add the environment variables above under **Settings → Environment Variables**.
4. **Settings → Domains**, add `promptwright.io`, and point the domain's nameservers at
   Vercel (or add the records Vercel shows if you keep DNS at Cloudflare).
5. Redeploy so the new env vars are picked up.

## Layout

```
app/
  layout.js              metadata, fonts, no-flash theme script
  page.js                landing page
  globals.css            design tokens and all styles
  privacy/page.js
  api/waitlist/route.js  signup capture (Loops or a generic webhook)
  opengraph-image.js     generated social card
  robots.js, sitemap.js
components/
  Linter.jsx             the tool — client component
  WaitlistForm.jsx
  ThemeToggle.jsx
lib/
  engine.js              scoring + rewrite logic. Pure, no DOM, no network, no deps.
```

`lib/engine.js` is the product. It has no dependencies and no side effects, which is why the
same file can later run in a browser extension without changes.

## Testing the engine

It is plain ES modules, so it runs under Node directly:

```bash
node --input-type=module -e "
import('./lib/engine.js').then(({SAMPLES, analyze}) => {
  SAMPLES.forEach((s,i) => {
    const a = analyze(s.text, s.task);
    console.log(i, 'score', a.total, 'warnings', a.warnings.length);
  });
});"
```

Expected: `14, 23, 18, 87, 7` with 4 warnings on the last.

## What this is not, yet

Phase 1 is the free tool plus a mailing list. Not built:

- accounts and payments
- server-side rewrites written by a model, instead of the template
- A/B against GPT, Gemini and Grok (needs API keys server-side)
- the browser extension

Before any of those ship, add per-user **rate limiting** — the moment an endpoint calls a
model API with your key, an unthrottled route is an uncapped bill.

And do not log prompt contents. People paste confidential material into prompt tools; the
privacy page promises they are never sent anywhere, and that promise is also the product.
