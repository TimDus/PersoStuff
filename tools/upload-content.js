// Uploads content/ to the private bucket with the owner key from .env, never printed [113 files, overwrites in place].
// Usage: npm run build-content && node tools/upload-content.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env"), "utf8");
const key = (env.match(/^SUPABASE_SECRET_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("SUPABASE_SECRET_KEY missing from .env");
const { supabaseUrl } = (() => { const window = {}; eval(fs.readFileSync(path.join(root, "config.js"), "utf8")); return window.HIRA_CONFIG; })();
const dir = path.join(root, "content");
const files = ["worksheets.json", ...fs.readdirSync(path.join(dir, "audio")).map((f) => "audio/" + f)];

(async () => {
  let ok = 0;
  for (const f of files) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/content/${f}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "x-upsert": "true",
        "content-type": f.endsWith(".json") ? "application/json" : "audio/mpeg" },
      body: fs.readFileSync(path.join(dir, f)),
    });
    if (res.ok) ok++;
    else console.log(`FAIL ${f}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`uploaded ${ok} of ${files.length}`);
  if (ok !== files.length) process.exit(1);
})();
