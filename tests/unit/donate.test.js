"use strict";

/**
 * scripts/support.js — the donation checkout.
 *
 * Three things have to hold, and all three are testable without a browser:
 *
 *   parseAmount       reads what people actually type in Brazil ("10,50",
 *                     "1.000") as well as the dot-decimal form
 *   isInfinitePayUrl  only a https link on infinitepay.io is ever opened
 *   criarCheckout     the request carries the amount, the fixed
 *                     description and the no-delivery option, nothing
 *                     else. The privacy policy (section 6) promises that,
 *                     so any new field has to fail this test until the
 *                     policy changes.
 */

const { read, extractFunction, check, ok, section } = require("../lib/harness");

const SRC = read("scripts/support.js");

function constant(name) {
  const m = SRC.match(new RegExp("const " + name + " = ([^;]+);"));
  if (!m) throw new Error("constant not found: " + name);
  return m[1];
}

const parseAmount = new Function(extractFunction(SRC, "parseAmount") + "\nreturn parseAmount;")();
const isInfinitePayUrl = new Function(extractFunction(SRC, "isInfinitePayUrl") + "\nreturn isInfinitePayUrl;")();

module.exports = async function () {
  section("donate: amount parsing");

  check("integer", parseAmount("10"), 10);
  check("comma decimal", parseAmount("10,50"), 10.5);
  check("dot decimal", parseAmount("10.5"), 10.5);
  check("dot thousands", parseAmount("1.000"), 1000);
  check("pt-BR full", parseAmount("1.000,00"), 1000);
  check("en full", parseAmount("1,000.00"), 1000);
  check("currency prefix is ignored", parseAmount("R$ 25"), 25);
  ok("letters are rejected", Number.isNaN(parseAmount("abc")), "expected NaN");
  ok("empty is rejected", Number.isNaN(parseAmount("")), "expected NaN");
  ok("three decimals after a mixed separator are rejected", Number.isNaN(parseAmount("1.000,555")), "expected NaN");

  section("donate: only InfinitePay links are opened");

  ok("checkout.infinitepay.io", isInfinitePayUrl("https://checkout.infinitepay.io/insivam?lenc=x"));
  ok("http is refused", !isInfinitePayUrl("http://checkout.infinitepay.io/insivam"));
  ok("look-alike host is refused", !isInfinitePayUrl("https://infinitepay.io.evil.com/x"));
  ok("other host is refused", !isInfinitePayUrl("https://example.com/infinitepay.io"));
  ok("garbage is refused", !isInfinitePayUrl("not a url"));

  section("donate: the request carries only amount and description");

  let sent = null;
  const fakeFetch = async (url, init) => {
    sent = { url, init };
    return { ok: true, json: async () => ({ url: "https://checkout.infinitepay.io/insivam?lenc=abc" }) };
  };
  const body = [
    "const INFINITEPAY_HANDLE = " + constant("INFINITEPAY_HANDLE") + ";",
    "const INFINITEPAY_LINKS_API = " + constant("INFINITEPAY_LINKS_API") + ";",
    "const DONATE_ITEM_DESCRIPTION = " + constant("DONATE_ITEM_DESCRIPTION") + ";",
    "const DONATE_TIMEOUT_MS = " + constant("DONATE_TIMEOUT_MS") + ";",
    extractFunction(SRC, "isInfinitePayUrl"),
    "async " + extractFunction(SRC, "criarCheckout"),
    "return criarCheckout;",
  ].join("\n");
  const criarCheckout = new Function("fetch", body)(fakeFetch);
  const url = await criarCheckout(1050);

  check("returns the checkout link", url, "https://checkout.infinitepay.io/insivam?lenc=abc");
  check("posts to the links API", sent.url, "https://api.checkout.infinitepay.io/links");
  check("sends no cookies", sent.init.credentials, "omit");
  const payload = JSON.parse(sent.init.body);
  check("top-level fields", Object.keys(payload).sort(), ["handle", "items", "options"]);
  check("no delivery address is asked for", payload.options, { require_delivery_address: false });
  check("one item: quantity, price in cents, fixed description", payload.items, [
    { quantity: 1, price: 1050, description: "Doação voluntária INSV Refresh" },
  ]);

  const badFetch = async () => ({ ok: true, json: async () => ({ url: "https://evil.example/pay" }) });
  const criarRuim = new Function("fetch", body)(badFetch);
  let threw = false;
  try { await criarRuim(500); } catch (e) { threw = true; }
  ok("a non-InfinitePay link in the response is rejected", threw, "expected a throw");
};
