// Privacy Policy — dark mode, TOC scroll-spy, dynamic <html lang>.
// i18n is handled by the shared i18n.js (loaded before this script).

// ── Dark mode (shared from util.js) ─────────────────────────
watchDarkMode();

// ── Keep <html lang> in sync with the active locale ─────────
if (typeof i18nReady !== "undefined") {
  i18nReady.then((lang) => {
    document.documentElement.lang = lang.replace("_", "-");
  });
  document.addEventListener("insv-lang-changed", (e) => {
    document.documentElement.lang = e.detail.lang.replace("_", "-");
  });
}

// ── TOC active-section highlight ────────────────────────────
const tocLinks = document.querySelectorAll(".toc-list a");

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.closest("[id]")?.id || entry.target.id;
      tocLinks.forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === "#" + id);
      });
    }
  });
}, { rootMargin: "-80px 0px -60% 0px", threshold: 0 });

document.querySelectorAll(".doc-section[id]").forEach((s) => observer.observe(s));
