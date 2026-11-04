import { Bricolage_Grotesque, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promptwright.cloud";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Promptwright — score your prompt before you send it",
    template: "%s — Promptwright",
  },
  description:
    "Paste a prompt and get it scored on the nine things models actually need, with the contradictions and dangling references flagged, then rewritten in the shape your target model's own docs recommend. Free, no signup, runs in your browser.",
  keywords: [
    "prompt engineering", "prompt optimizer", "prompt linter",
    "ChatGPT prompts", "Claude prompts", "Gemini prompts", "write better prompts",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Promptwright",
    title: "Your prompt is fine. It's just missing nine things.",
    description:
      "A free prompt linter: score, fix and rewrite your prompt for Claude, GPT, Gemini, Grok or open-weight models. No signup — it runs in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your prompt is fine. It's just missing nine things.",
    description:
      "A free prompt linter: score, fix and rewrite your prompt for Claude, GPT, Gemini, Grok or open-weight models. No signup.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before first paint so an explicit theme choice doesn't flash the other one.
const themeScript = `
try {
  var t = localStorage.getItem("promptwright.theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
