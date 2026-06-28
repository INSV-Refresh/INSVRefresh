// Shared helpers — loaded before popup.js / options.js.

// Escape user-controlled text before it goes into an innerHTML template
// (queue names, custom-audio names). Covers element content and double-quoted
// attribute values.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Built-in alert sounds — single source (popup + options render the same list).
// labelKey resolves via t() at render time; text is a fixed brand name.
const BUILTIN_SOUNDS = [
  { value: "notification.mp3", labelKey: "sound_default" },
  { value: "tech.mp3", text: "Tech" },
  { value: "limba.mp3", text: "Limba" },
  { value: "lis.mp3", text: "LIS" },
  { value: "interface.mp3", text: "Interface" },
  { value: "bubble.mp3", text: "Bubbles" },
];

// Play a sound by value — a built-in filename or a "custom_*" storage key.
// Shared by the popup and options preview controls. volume is 0..1.
function playSound(value, volume) {
  if (!value) return;
  const vol = Math.min(1, Math.max(0, Number(volume) || 0));
  if (value.startsWith("custom_")) {
    chrome.storage.local.get("audiosPersonalizados", (data) => {
      const audio = (data.audiosPersonalizados || {})[value];
      if (audio && audio.data) {
        const a = new Audio(audio.data);
        a.volume = vol;
        a.play().catch(() => {});
      }
    });
  } else {
    const a = new Audio(chrome.runtime.getURL("assets/sounds/" + value));
    a.volume = vol;
    a.play().catch(() => {});
  }
}

// Canonical queue shape — one source for the default fields.
const DEFAULT_INTERVAL = 15;
const DEFAULT_SOUND = "notification.mp3";
function defaultQueue(overrides) {
  return Object.assign(
    {
      name: "",
      active: true,
      interval: DEFAULT_INTERVAL,
      soundEnabled: false,
      customSound: DEFAULT_SOUND,
    },
    overrides || {}
  );
}
