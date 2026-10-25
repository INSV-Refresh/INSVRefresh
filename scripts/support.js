// Tela "Apoiar": doação voluntária via InfinitePay Checkout + contato comercial.
// showToast + applyDarkMode/watchDarkMode são compartilhados de util.js.
watchDarkMode();

// O checkout é gerado pela API pública da InfinitePay: só a InfiniteTag
// (handle) identifica a conta que recebe, sem chave secreta. A API responde
// CORS "*", então a chamada sai direto desta página, sem backend e sem
// host_permission. O corpo leva só o valor e a descrição fixa abaixo: nenhum
// dado do usuário. A política de privacidade (seção 6) descreve exatamente
// esse envio; mudar o que vai aqui exige atualizar a política.
const INFINITEPAY_HANDLE = "insivam";
const INFINITEPAY_LINKS_API = "https://api.checkout.infinitepay.io/links";
const DONATE_ITEM_DESCRIPTION = "Doação voluntária INSV Refresh";
const DONATE_MIN = 1;    // reais
const DONATE_MAX = 1000; // reais
const DONATE_TIMEOUT_MS = 15000;

const form = document.getElementById("donate-form");
const customInput = document.getElementById("custom-amount");
const donateBtn = document.getElementById("donate-btn");
const statusEl = document.getElementById("donate-status");
const radios = Array.from(document.querySelectorAll('input[name="amount"]'));

function localeTag() {
  return (typeof I18N !== "undefined" && I18N.lang ? I18N.lang : "pt_BR").replace("_", "-");
}

function formatBRL(reais) {
  const inteiro = Number.isInteger(reais);
  return new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

// Aceita "10", "10,50", "10.50", "1.000", "1.000,00" e "1,000.00".
function parseAmount(raw) {
  let s = String(raw || "").trim().replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return NaN;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal; o outro é milhar.
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    s = s.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (temVirgula || temPonto) {
    const sep = temVirgula ? "," : ".";
    const partes = s.split(sep);
    // Repetido, ou um só seguido de exatamente 3 dígitos: é milhar.
    if (partes.length > 2 || partes[1].length === 3) s = partes.join("");
    else s = partes.join(".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

function selectedAmount() {
  if (customInput.value.trim()) return parseAmount(customInput.value);
  const checked = radios.find((r) => r.checked);
  return checked ? Number(checked.value) : NaN;
}

function isValidAmount(v) {
  return Number.isFinite(v) && v >= DONATE_MIN && v <= DONATE_MAX;
}

function setStatus(msg, tone) {
  statusEl.textContent = msg || "";
  if (tone) statusEl.setAttribute("data-tone", tone);
  else statusEl.removeAttribute("data-tone");
}

function renderButton() {
  const v = selectedAmount();
  donateBtn.textContent = isValidAmount(v)
    ? t("donate_btn_amount", { v: formatBRL(v) })
    : t("donate_btn");
}

function renderChipLabels() {
  radios.forEach((r) => {
    const span = r.parentElement.querySelector("span");
    if (span) span.textContent = formatBRL(Number(r.value));
  });
}

function isInfinitePayUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" &&
      (url.hostname === "infinitepay.io" || url.hostname.endsWith(".infinitepay.io"));
  } catch (e) {
    return false;
  }
}

async function criarCheckout(cents) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DONATE_TIMEOUT_MS);
  try {
    const res = await fetch(INFINITEPAY_LINKS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      signal: ctrl.signal,
      body: JSON.stringify({
        handle: INFINITEPAY_HANDLE,
        items: [{ quantity: 1, price: cents, description: DONATE_ITEM_DESCRIPTION }],
        // Doação não tem entrega. A API pública (só handle) hoje ignora
        // options e segue a configuração geral do Checkout no app InfinitePay;
        // o campo fica para valer assim que ela passar a honrá-lo.
        options: { require_delivery_address: false },
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const url = data && data.url;
    if (!isInfinitePayUrl(url)) throw new Error("resposta sem link de checkout");
    return url;
  } finally {
    clearTimeout(timer);
  }
}

function abrirAba(url) {
  // chrome.tabs.create não depende de gesto do usuário (o window.open depois
  // de um await pode ser barrado pelo bloqueador de pop-up).
  try {
    chrome.tabs.create({ url }, () => {
      if (chrome.runtime.lastError) window.open(url, "_blank", "noopener");
    });
  } catch (e) {
    window.open(url, "_blank", "noopener");
  }
}

radios.forEach((r) => r.addEventListener("change", () => {
  customInput.value = "";
  setStatus("");
  renderButton();
}));

customInput.addEventListener("input", () => {
  const has = customInput.value.trim() !== "";
  if (has) radios.forEach((r) => { r.checked = false; });
  else if (!radios.some((r) => r.checked)) radios[1].checked = true;
  setStatus("");
  renderButton();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (donateBtn.disabled) return;
  const v = selectedAmount();
  if (!isValidAmount(v)) {
    setStatus(t("donate_invalid", { min: formatBRL(DONATE_MIN), max: formatBRL(DONATE_MAX) }), "error");
    customInput.focus();
    return;
  }
  donateBtn.disabled = true;
  donateBtn.setAttribute("aria-busy", "true");
  setStatus(t("donate_loading"));
  try {
    const url = await criarCheckout(Math.round(v * 100));
    setStatus(t("donate_opened"), "ok");
    abrirAba(url);
  } catch (err) {
    console.warn("[INSV] checkout InfinitePay:", err);
    setStatus(t("donate_error"), "error");
  } finally {
    donateBtn.disabled = false;
    donateBtn.removeAttribute("aria-busy");
  }
});

i18nReady.then(() => {
  renderChipLabels();
  renderButton();
});

document.addEventListener("insv-lang-changed", () => {
  renderChipLabels();
  renderButton();
  setStatus("");
});
