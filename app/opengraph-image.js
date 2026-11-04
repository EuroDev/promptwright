import { ImageResponse } from "next/og";

export const alt = "Promptwright — your prompt is fine, it's just missing nine things";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d0f15",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "#8296ff", fontSize: 34, fontWeight: 700 }}>&gt;</span>
          <span style={{ color: "#e8ebf2", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            Promptwright
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2.5,
              maxWidth: 1000,
            }}
          >
            Your prompt is fine. It&apos;s just missing nine things.
          </div>
          <div style={{ color: "#99a2b5", fontSize: 30, marginTop: 28, maxWidth: 900 }}>
            Score it, fix it, and rewrite it for Claude, GPT, Gemini or Grok.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              color: "#4ccb9f",
              border: "2px solid #4ccb9f",
              borderRadius: 999,
              padding: "10px 24px",
              fontSize: 24,
            }}
          >
            Free · no signup · runs in your browser
          </div>
        </div>
      </div>
    ),
    size,
  );
}
