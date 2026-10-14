// Uploads content/ to the private bucket with the owner key from .env, never printed [229 files with koohii.json, overwrites in place].
// Usage: npm run build-content && node tools/upload-content.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env"), "utf8");
const key = (env.match(/^SUPABASE_SECRET_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("SUPABASE_SECRET_KEY missing from .env");
const { supabaseUrl } = (() => { const window = {}; eval(fs.readFileSync(path.join(root, "config.js"), "utf8")); return window.HIRA_CONFIG; })();
const dir = path.join(root, "content");
const files = ["worksheets.json", ...(fs.existsSync(path.join(dir, "koohii.json")) ? ["koohii.json"] : []), ...["audio", "img"].flatMap((d) => fs.readdirSync(path.join(dir, d)).map((f) => `${d}/${f}`))];
// Drawings are stored without an extension, so their type comes from the first bytes [89 50 4e 47 = png].
const typeOf = (f, buf) => (f.endsWith(".json") ? "application/json" : f.endsWith(".mp3") ? "audio/mpeg"
  : buf[0] === 0x89 && buf[1] === 0x50 ? "image/png" : buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg" : null);

(async () => {
  let ok = 0;
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f));
    const type = typeOf(f, body);
    if (!type) { console.log(`SKIP ${f}: unknown file type`); continue; }
    const res = await fetch(`${supabaseUrl}/storage/v1/object/content/${f}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "x-upsert": "true", "content-type": type },
      body,
    });
    if (res.ok) ok++;
    else console.log(`FAIL ${f}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`uploaded ${ok} of ${files.length}`);
  if (ok !== files.length) process.exit(1);
})();
