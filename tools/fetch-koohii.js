// Saves Kanji Koohii's study page of every deck kanji in data/kanji.json to _data/koohii/<hex>.html, signed in with the login in .env, never printed [学 = 5b66.html].
// One request every 3 s, pages already saved are skipped, so a stopped run resumes [902 pages, about 45 minutes from empty].
// Usage: node tools/fetch-koohii.js data/kanji.json _data/koohii [one kanji to fetch only that page]
const fs = require("fs");
const path = require("path");

const [kanjiFile, outDir, only] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/fetch-koohii.js <kanji json> <out dir> [kanji]");
  process.exit(1);
}
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
// The last line with a value wins, so a filled-in line beats an empty one above or below it.
const read = (name) => [...env.matchAll(new RegExp(`^${name}=(.*)$`, "gm"))].map((m) => m[1].trim().replace(/^(["'])(.*)\1$/, "$2")).filter(Boolean).pop();
const user = read("KOOHII_USERNAME"), pass = read("KOOHII_PASSWORD");
if (!user || !pass) {
  console.error("KOOHII_USERNAME or KOOHII_PASSWORD is empty in .env");
  process.exit(1);
}
const SITE = "https://kanji.koohii.com";
const listed = only ? [only] : Object.keys(JSON.parse(fs.readFileSync(kanjiFile, "utf8")));
const hex = (c) => c.codePointAt(0).toString(16);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const jar = new Map();
const keep = (res) => res.headers.getSetCookie().forEach((c) => { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); });
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
async function get(url) {
  const res = await fetch(url, { headers: { cookie: cookie(), "user-agent": "FlashCards personal study fetch" }, redirect: "manual" });
  keep(res);
  return res;
}
// A page that still asks for the password means the session didn't take [Koohii sends a logged-out visitor to /login].
const signedOut = (res, html) => (res.status >= 300 && res.status < 400 && /login/.test(res.headers.get("location") || "")) || /name="password"/.test(html);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await get(`${SITE}/login`);
  const login = await fetch(`${SITE}/login`, {
    method: "POST", redirect: "manual",
    headers: { cookie: cookie(), "content-type": "application/x-www-form-urlencoded", "user-agent": "FlashCards personal study fetch" },
    body: new URLSearchParams({ username: user, password: pass, rememberme: "1", referer: "@homepage" }),
  });
  keep(login);
  let saved = 0, skipped = 0;
  const unsaved = [];
  for (const c of listed) {
    const file = path.join(outDir, `${hex(c)}.html`);
    if (fs.existsSync(file) && !only) { skipped++; continue; }
    const res = await get(`${SITE}/study/kanji/${encodeURIComponent(c)}`);
    const html = await res.text();
    if (signedOut(res, html)) throw new Error(`not signed in at ${c} (HTTP ${res.status}); check the login in .env`);
    if (res.status !== 200) throw new Error(`${c}: HTTP ${res.status}`);
    // A 200 without the keyword is some other page, left unsaved so the next run asks again [a maintenance notice, or a kanji Koohii lacks].
    if (!html.includes("ko-MyStory-keyword")) { console.log(`${c}: no keyword on the page, not saved`); unsaved.push(c); await wait(3000); continue; }
    fs.writeFileSync(file, html);
    saved++;
    if (saved % 25 === 0) console.log(`${saved} saved, ${skipped} already there, at ${c}`);
    await wait(3000);
  }
  console.log(`${saved} saved, ${skipped} already there, ${listed.length} kanji -> ${outDir}${unsaved.length ? `; no keyword for ${unsaved.join("")}` : ""}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
