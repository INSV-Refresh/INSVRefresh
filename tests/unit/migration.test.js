"use strict";

/**
 * service-worker.js — storage migration v4 (end of the paid plans).
 *
 * The ExtensionPay library kept its own keys (an API key, the cached user and
 * the install date) in storage.sync, falling back to storage.local. With the
 * paid plans gone nothing reads them, and the privacy policy says the
 * extension keeps no tokens, so the migration has to remove them from both
 * areas without touching the user's real settings.
 */

const { read, extractFunction, check, ok, section } = require("../lib/harness");

const SRC = read("service-worker.js");

function constant(name) {
  const m = SRC.match(new RegExp("const " + name + " = ([^;]+);"));
  if (!m) throw new Error("constant not found: " + name);
  return m[1];
}

function makeArea(initial) {
  const store = Object.assign({}, initial);
  return {
    store,
    get(keys, cb) {
      cb(keys === null ? Object.assign({}, store) : {});
    },
    set(obj, cb) {
      Object.assign(store, obj);
      if (cb) cb();
    },
    remove(keys, cb) {
      [].concat(keys).forEach((k) => delete store[k]);
      if (cb) cb();
      return Promise.resolve();
    },
  };
}

function run(localInit, syncInit) {
  const local = makeArea(localInit);
  const sync = makeArea(syncInit);
  const session = makeArea({});
  const chrome = { storage: { local, sync, session } };
  const body = [
    "const STORAGE_VERSION = " + constant("STORAGE_VERSION") + ";",
    "const EXTPAY_KEYS = " + constant("EXTPAY_KEYS") + ";",
    extractFunction(SRC, "legacyKeyToShortcutObj"),
    extractFunction(SRC, "mergeStatusNotificationsIntoQueues"),
    extractFunction(SRC, "migrateStorage"),
    "migrateStorage();",
  ].join("\n");
  new Function("chrome", body)(chrome);
  return { local: local.store, sync: sync.store };
}

module.exports = function () {
  section("migration v4: ExtensionPay keys are removed");

  const extpay = {
    extensionpay_api_key: "k",
    extensionpay_user: { paid: true },
    extensionpay_installed_at: "2026-01-01",
  };
  const queues = [{ name: "Fila A", active: true, interval: 15 }];

  const r = run(
    Object.assign({ storageVersion: 3, queues }, extpay),
    Object.assign({ legacyMode: true, legacyInterval: 30 }, extpay),
  );

  check("storageVersion is bumped to 4", r.local.storageVersion, 4);
  ok("no extensionpay_* left in storage.local",
    !Object.keys(r.local).some((k) => k.startsWith("extensionpay_")), Object.keys(r.local).join(","));
  ok("no extensionpay_* left in storage.sync",
    !Object.keys(r.sync).some((k) => k.startsWith("extensionpay_")), Object.keys(r.sync).join(","));
  check("queues are untouched", r.local.queues, queues);
  check("Legacy settings in sync are untouched", [r.sync.legacyMode, r.sync.legacyInterval], [true, 30]);

  section("migration v4: already-migrated storage is left alone");

  const again = run({ storageVersion: 4, queues }, { extensionpay_user: { paid: true } });
  check("storageVersion stays 4", again.local.storageVersion, 4);
  ok("a migrated profile is not rewritten", "extensionpay_user" in again.sync, "migration ran twice");
};
