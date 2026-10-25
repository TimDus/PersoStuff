// Safari before 16.4 can't parse a regex lookbehind, and a parse error takes the whole file down with it. conj.js shipped
// (?<=[てでにと])は, and drill.js and grammar.js read HiraConj as they load, so on such an iPhone Verbs, Particles, Grammar
// and Listening could never have run, while every Chrome test passed. Found by reading, never seen on a phone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("no script the site loads uses a regex lookbehind", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^":]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 20);
  const found = scripts.filter((s) => /\(\?<[=!]/.test(fs.readFileSync(path.join(root, s), "utf8")));
  assert.deepEqual(found, []);
});
