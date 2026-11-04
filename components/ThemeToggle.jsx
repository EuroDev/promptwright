"use client";

export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const explicit = root.getAttribute("data-theme");
    const isDark =
      explicit === "dark" ||
      (!explicit && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("promptwright.theme", next);
    } catch {
      /* private window or blocked storage — the toggle still works for this visit */
    }
  }

  return (
    <button className="theme-btn" type="button" onClick={toggle} aria-label="Switch between light and dark">
      theme
    </button>
  );
}
