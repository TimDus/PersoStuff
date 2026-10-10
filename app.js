(function () {
  const { groups, KANA, LESSONS, KATA_LESSONS, SMALL_TSU, LONG_VOWELS, ids, main } = window.HIRAGANA;
  const { clipPath, imagePath, merge, same } = window.HiraSync;
  const backend = window.HIRA_BACKEND;
  // Worksheets and sentences arrive from the private bucket after sign-in [empty until then, or when offline].
  let SHEETS = [];
  let READING = [];
  let contentError = "";
  const byKana = new Map(KANA.map((k) => [k.kana, k]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const app = document.getElementById("app");

  // Google Doc ids of the original worksheets, for printing on paper [p0 to p2 are the sentence sheets, p2 in katakana].
  const DOCS = {
    vowels: "1muxTHS0NqIzKPUStedahoTRbvQRlUlQi0J3XMPi-DJE", k: "164N1iT19YGaMpmImySONvLntsi8gehmQZU0GJLHC_q8",
    s: "1Zii4XH0bGOXAoYUTRy-bAZCo1SuKbiWZIoodJbWKMDA", t: "12IIGe4lP212Twq3DSnhNzf6u8mVwYWoXLAEuG1DH1Js",
    nh: "1x4bretsJKt7R_zWh9a64aRK4qiY-JU6qYQe-68Qp-WM", my: "1235hPLUNyaiyPf--_1jkrv9wpcVXLwnPw3ACx4KBIRQ",
    rwn: "1fKOrg5X5UkyZ6EhOMRa0qlr2jtVwrLQSHYk1iL9-ovQ", dakuten: "1yAShOorugSANSMILnPfJjPnFOPCAKKN53usq5Jo-YuQ",
    youon: "1Sy6zrBkkr9JVCwix-dTMSPVAl4cW5Z5jHTg-peiwbv8", p0: "1_NzKK3N6l5owqEWkmOaKTRzxiRhO11MVjcharOluSW8",
    p1: "1oihMWqHCbUnMkSc3HevuxGHmktZ2QY2yTcUqnUWQ81w",
    "k-ak": "1vq600qg-FVbMofnbCNOLFtn5tNiouXx2kTMegnzPqSU", "k-st": "1pxuEjzsey_zkqBxSzgcT1qytGRcjJdx7EEIbMR5uN7w",
    "k-nh": "1-LJKrZ6b_vy9TA24QF1FS3P6taZMR2TdwbS6V7ixEwQ", "k-my": "1a9dtvUlN-Jyt5UAiD8tAaZWqOhmnQY8mOfBvMjqLhqQ",
    "k-rwn": "1UGzyVHcREJAvFWmwEWfupn0GPY-tOmXXTo0fj69fEy4", p2: "1RkUw8nKTmjUhBV6ETBoVNtTH2MZrvdSYtgSy0ttonjU",
  };
  const docUrl = (id) => `https://docs.google.com/document/d/${DOCS[id]}/edit`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, "");
  const kanaOf = (groupIds) => groupIds.flatMap((id) => groupById.get(id)?.kana || []);
  const fmtTime = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Keys that follow the account to other devices; the rest stay on this one [the font and last-picked columns].
  const SYNCED = ["progress", "quiz.best", "sheets.done", "reading.done"];
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem("hira." + key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      localStorage.setItem("hira." + key, JSON.stringify(value));
      if (SYNCED.includes(key)) {
        localStorage.setItem("hira.sync.savedAt", Date.now());
        scheduleSync();
      }
    },
  };

  // Mastery per kana, 0 unseen to 5 mastered [a miss drops any box back to 1].
  let progress = store.get("progress", {});
  function record(kana, ok) {
    const p = progress[kana] || (progress[kana] = { box: 0, right: 0, wrong: 0 });
    if (ok) { p.right++; p.box = Math.min(5, Math.max(2, p.box + 1)); } else { p.wrong++; p.box = 1; }
    store.set("progress", progress);
  }
  const boxOf = (kana) => progress[kana]?.box || 0;
  const mastery = (list) => (list.length ? list.filter((k) => boxOf(k.kana) >= 3).length / list.length : 0);

  let user = null;
  let syncTimer = null;
  let syncChain = Promise.resolve();
  const snapshot = () => ({
    progress: store.get("progress", {}), "quiz.best": store.get("quiz.best", {}),
    "sheets.done": store.get("sheets.done", {}), "reading.done": store.get("reading.done", []),
    savedAt: store.get("sync.savedAt", 0), resetAt: store.get("sync.resetAt", 0),
  });
  const blank = () => ({ progress: {}, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: 0, resetAt: 0 });
  function applySnapshot(s) {
    SYNCED.forEach((k) => localStorage.setItem("hira." + k, JSON.stringify(s[k])));
    localStorage.setItem("hira.sync.savedAt", s.savedAt);
    localStorage.setItem("hira.sync.resetAt", s.resetAt);
    progress = s.progress;
  }
  function setSyncNote(text) {
    const el = document.getElementById("sync-note");
    if (el) el.textContent = text;
  }
  // Answers this device holds that the server doesn't [savedAt 1200, last pushed 1000 = one quiz since the last sync].
  const unsynced = () => store.get("sync.savedAt", 0) > store.get("sync.pushedAt", 0);
  // Pull, merge, push; the local snapshot is read after the pull so an answer given meanwhile is kept [no await between merge and apply].
  function sync(pulled) {
    clearTimeout(syncTimer);
    syncTimer = null;
    syncChain = syncChain.then(async () => {
      if (!user || !backend) return;
      try {
        const remote = await (pulled || backend.loadProgress());
        const merged = merge(snapshot(), remote);
        applySnapshot(merged);
        if (!same(merged, remote)) await backend.saveProgress(user.id, merged);
        localStorage.setItem("hira.sync.pushedAt", merged.savedAt);
        setSyncNote(`Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setSyncNote("Offline, will sync later");
      }
    });
    return syncChain;
  }
  function scheduleSync() {
    if (!user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 1500);
  }
  addEventListener("online", () => sync());
  document.addEventListener("visibilitychange", () => { if (document.hidden && syncTimer) sync(); });

  // Timers and key handlers live until the next route change [a break countdown stops when you leave the worksheet].
  let teardown = [];
  const onKey = (fn) => {
    document.addEventListener("keydown", fn);
    teardown.push(() => document.removeEventListener("keydown", fn));
  };
  const every = (ms, fn) => {
    const t = setInterval(fn, ms);
    teardown.push(() => clearInterval(t));
  };
  const after = (ms, fn) => {
    const t = setTimeout(fn, ms);
    teardown.push(() => clearTimeout(t));
  };
  const typing = (e) => e.target.matches("input, textarea, select");

  let jaVoice = null;
  if ("speechSynthesis" in window) {
    const load = () => {
      jaVoice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ja")) || null;
      document.body.classList.toggle("has-voice", !!jaVoice);
    };
    load();
    speechSynthesis.addEventListener?.("voiceschanged", load);
  }
  // Tofugu's recordings: every hiragana, the small-tsu words, and the katakana sounds hiragana lacks [ファ, ティ, ヴ].
  const CLIPS = new Set([
    ...KANA.filter((k) => k.script === "hiragana" || k.kind === "extended").map((k) => k.kana), ...SMALL_TSU.flat(),
  ]);
  const hiraByRomaji = new Map();
  KANA.filter((k) => k.script === "hiragana").forEach((k) => { if (!hiraByRomaji.has(k.romaji)) hiraByRomaji.set(k.romaji, k.kana); });
  // The recording a kana plays; other katakana borrow the hiragana with their sound [ア = あ, ヂャ = じゃ].
  const clipFor = (text) => (CLIPS.has(text) ? text : byKana.get(text)?.script === "katakana" ? hiraByRomaji.get(byKana.get(text).romaji) : undefined);
  // Tofugu drew a mnemonic for each main kana and nothing else [none for が or キャ].
  const ART = new Set(KANA.filter((k) => k.kind === "main").map((k) => k.kana));
  const player = new Audio();
  let mediaUrls = new Map();
  let mediaUrlsAt = 0;
  async function loadMediaUrls() {
    mediaUrls = await backend.signedUrls([...[...CLIPS].map(clipPath), ...[...ART].map(imagePath)]);
    mediaUrlsAt = Date.now();
    document.body.classList.toggle("has-media", mediaUrls.size > 0);
  }
  // Signed links last 12 hours, so a tab left open overnight asks for fresh ones [checked at 11].
  async function mediaUrl(key) {
    if (Date.now() - mediaUrlsAt > 11 * 3600e3) await loadMediaUrls().catch(() => {});
    return mediaUrls.get(key);
  }
  async function say(text) {
    window.speechSynthesis?.cancel();
    player.pause();
    const clip = clipFor(text);
    if (clip) {
      const url = await mediaUrl(clipPath(clip));
      if (url) { player.src = url; player.play().catch(() => {}); }
      return;
    }
    if (!jaVoice) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = jaVoice; u.lang = "ja-JP"; u.rate = 0.8;
    speechSynthesis.speak(u);
  }
  const speakBtn = (text) => `<button class="speak${clipFor(text) ? " clip" : ""}" data-say="${esc(text)}" title="Listen">🔊</button>`;
  // A drawing loads only when its button is pressed [each is 1600x800, about 165 KB].
  const artBtn = (kana) => (ART.has(kana)
    ? `<div class="art-slot" data-art="${esc(kana)}"><button class="ghost art-toggle" type="button">Show illustration</button></div>`
    : "");
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".art-toggle");
    if (!b) return;
    b.blur();
    const slot = b.closest(".art-slot");
    const shown = slot.querySelector("img");
    if (shown) { shown.remove(); b.textContent = "Show illustration"; return; }
    const url = await mediaUrl(imagePath(slot.dataset.art));
    if (!url) return;
    slot.insertAdjacentHTML("beforeend", `<img class="art" src="${esc(url)}" alt="Mnemonic drawing for ${esc(slot.dataset.art)}">`);
    b.textContent = "Hide illustration";
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-say]");
    if (b) say(b.dataset.say);
  });

  // Letter-by-letter romaji for hiragana or katakana [いっしょ = issho, まっちゃ = matcha, ベーコン = beekon].
  const SMALLS = "ゃゅょャュョァィゥェォ";
  // A small vowel no table covers swaps the vowel before it [ズ + ィ = zi, as in ズィス].
  const SMALL_VOWEL = { ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o" };
  const PUNCT = { "、": ", ", "。": ". ", "！": "! ", "？": "? ", "「": '"', "」": '"', "　": " ", "・": " " };
  const isKana = (c) => {
    const n = c.codePointAt(0);
    return (n >= 0x3041 && n <= 0x309f) || (n >= 0x30a1 && n <= 0x30ff);
  };
  function toRomaji(s) {
    let out = "";
    let double = false;
    for (let i = 0; i < s.length; i++) {
      let ch = s[i];
      if (SMALLS.includes(s[i + 1]) && byKana.has(ch + s[i + 1])) ch += s[++i];
      if (ch === "っ" || ch === "ッ") { double = true; continue; }
      if (ch === "ー") { out += (out.match(/[aeiou]$/) || [""])[0]; continue; }
      if (SMALL_VOWEL[ch]) { out = out.replace(/[aeiou]?$/, SMALL_VOWEL[ch]); continue; }
      const k = byKana.get(ch);
      let r = k ? k.romaji : PUNCT[ch] ?? ch;
      if ((ch === "ん" || ch === "ン") && /^[aeiouy]/.test(byKana.get(s[i + 1])?.romaji || "")) r = "n'";
      if (double && k) r = (r.startsWith("ch") ? "t" : r[0]) + r;
      double = false;
      out += r;
    }
    return out.replace(/\s+/g, " ").trim();
  }
  // Reading units, small kana and ー kept with their kana [っしゅ, ベー, ズィ].
  function tokens(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let t = s[i];
      if ((t === "っ" || t === "ッ") && byKana.has(s[i + 1])) t += s[++i];
      if (SMALLS.includes(s[i + 1])) t += s[++i];
      while (s[i + 1] === "ー") t += s[++i];
      out.push(t);
    }
    return out;
  }

  function openModal(html) {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal panel">${html}<div class="row" style="justify-content:center;margin-top:1rem"><button class="ghost" data-close>Close</button></div></div>`;
    const close = () => { back.remove(); document.removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", esc_);
    document.body.appendChild(back);
  }
  function kanaModal(k) {
    const p = progress[k.kana];
    openModal(`
      <div class="kana">${esc(k.kana)}</div>
      <div class="big-number">${esc(k.romaji)} ${speakBtn(k.kana)}</div>
      ${k.accept.length > 1 ? `<div class="muted small">also accepted: ${esc(k.accept.slice(1).join(", "))}</div>` : ""}
      <p>${esc(k.mnemonic)}</p>
      ${k.lookalike ? `<p class="muted small">Look-alike: ${esc(k.lookalike)}</p>` : ""}
      ${artBtn(k.kana)}
      <p class="muted small">${p ? `${p.right} right · ${p.wrong} wrong` : "Not practised yet"}</p>`);
  }

  // Column chooser shared by flashcards and quiz, hiragana above katakana [all of Main = 46 kana].
  const SCRIPTS = [["hiragana", "Hiragana", ["main", "dakuten", "youon"]], ["katakana", "Katakana", ["main", "dakuten", "youon", "extended"]]];
  const KIND_NAMES = { main: "Main kana", dakuten: "Dakuten", youon: "Combinations", extended: "Extended sounds" };
  // Group ids per chip: one Learn step for main kana, one column otherwise [hiragana step 7 = m,y; katakana step 1 = k-a,k-k].
  const chipsOf = (script, kind) => (kind === "main"
    ? { hiragana: LESSONS, katakana: KATA_LESSONS }[script].map((l) => l.groups).filter((g) => g.length && groupById.get(g[0]).kind === "main")
    : groups.filter((g) => g.kind === kind && g.script === script).map((g) => [g.id]));
  function picker(selected, onChange) {
    const el = document.createElement("div");
    const chip = (gids) => {
      const gs = gids.map((id) => groupById.get(id));
      return `<span class="chip ${gids.every((id) => selected.has(id)) ? "on" : ""}" data-g="${gids.join(",")}" role="button"
        title="${esc(gs.map((g) => g.name).join(" & "))}">${gs.flatMap((g) => g.kana).map((k) => esc(k.kana)).join("")}</span>`;
    };
    const draw = () => {
      el.innerHTML = SCRIPTS.map(([script, title, kinds]) => `<h3 class="picker-script">${title}</h3>` + kinds.map((kind) => `
        <div class="picker-head"><strong>${KIND_NAMES[kind]}</strong>
          <button class="linkish" data-all="${script}:${kind}">all</button><button class="linkish" data-none="${script}:${kind}">none</button></div>
        <div class="picker">${chipsOf(script, kind).map(chip).join("")}
        </div>`).join("")).join("");
    };
    el.addEventListener("click", (e) => {
      const hit = e.target.closest("[data-g]");
      const all = e.target.closest("[data-all]");
      const none = e.target.closest("[data-none]");
      if (hit) {
        const gids = hit.dataset.g.split(",");
        const on = gids.every((id) => selected.has(id));
        gids.forEach((id) => (on ? selected.delete(id) : selected.add(id)));
      } else if (all) ids(...all.dataset.all.split(":").reverse()).forEach((id) => selected.add(id));
      else if (none) ids(...none.dataset.none.split(":").reverse()).forEach((id) => selected.delete(id));
      else return;
      draw();
      onChange(selected);
    });
    draw();
    return el;
  }
  const orderedSel = (set) => groups.map((g) => g.id).filter((id) => set.has(id));

  // ---------- Learn ----------
  // Each script's steps, in learning order [katakana steps link as #learn/k1].
  const TRACKS = {
    hiragana: { lessons: LESSONS, prefix: "", reading: "#reading/0/0" },
    katakana: { lessons: KATA_LESSONS, prefix: "k", reading: "#reading/2/0" },
  };
  function viewLearn([step]) {
    const kata = /^k\d+$/.test(step || "");
    const n = +(kata ? step.slice(1) : step);
    const track = TRACKS[kata ? "katakana" : "hiragana"];
    if (step && track.lessons[n - 1]) return viewLesson(n - 1, kata ? "katakana" : "hiragana");
    const cards = ({ lessons, prefix }) => lessons.map((l, i) => {
      const list = kanaOf(l.groups);
      return `<a class="panel lesson-card" href="#learn/${prefix}${i + 1}">
        <div class="step">Step ${i + 1}</div>
        <div class="title">${esc(l.title)}</div>
        <div class="muted">${esc(l.sub)}${list.length ? ` · ${list.length} kana` : ""}</div>
        ${list.length ? `<div class="bar"><span style="width:${Math.round(mastery(list) * 100)}%"></span></div>` : ""}
      </a>`;
    }).join("");
    app.innerHTML = `
      <h1>Learn hiragana in 12 steps</h1>
      <p class="lead">Follow Tofugu's order: learn a column with its mnemonics, quiz everything so far, then do the worksheet.
        Don't practise writing yet — reading comes first.</p>
      <div class="grid">
        ${cards(TRACKS.hiragana)}
        <a class="panel lesson-card" href="#reading">
          <div class="step">Step 13</div><div class="title">よみましょう</div>
          <div class="muted">Reading practice · 24 sentences</div>
        </a>
      </div>
      <h1 style="margin-top:2.5rem">Then katakana in 9 steps</h1>
      <p class="lead">Katakana spells foreign words and names with the same sounds you already know, so it goes faster.
        Ten kana a step, then the sounds hiragana doesn't have.</p>
      <div class="grid">
        ${cards(TRACKS.katakana)}
        <a class="panel lesson-card" href="${TRACKS.katakana.reading}">
          <div class="step">Step 10</div><div class="title">リーディング</div>
          <div class="muted">Reading practice · English in katakana</div>
        </a>
      </div>`;
  }

  function viewLesson(i, script) {
    const { lessons, prefix, reading } = TRACKS[script];
    const l = lessons[i];
    const lessonGroups = l.groups.map((id) => groupById.get(id));
    const card = (k) => `
          <div class="panel kana-card">
            <div class="big">${esc(k.kana)}</div>
            <div><div class="rom">${esc(k.romaji)} ${speakBtn(k.kana)}</div>
              <div>${esc(k.mnemonic)}</div>
              ${k.lookalike ? `<div class="look">Look-alike: ${esc(k.lookalike)}</div>` : ""}</div>
            ${artBtn(k.kana)}
          </div>`;
    const kind = lessonGroups[0]?.kind;
    // Dakuten get full cards per column, the column's story on its first card [が carries the car crash, ぎ reads き + ゛].
    const kanaCards = kind === "main"
      ? `<div class="kana-list">${lessonGroups.flatMap((g) => g.kana).map(card).join("")}</div>`
      : kind === "dakuten"
      ? lessonGroups.map((g) => `
          <h2 class="jp">${g.kana.map((k) => esc(k.kana)).join(" ")}</h2>
          <div class="kana-list">${g.kana.map(card).join("")}</div>`).join("")
      : lessonGroups.map((g) => `
          <h2 class="jp">${g.kana.map((k) => esc(k.kana)).join(" ")}</h2>
          <p class="muted">${esc(g.note)}</p>
          <div class="sheet-grid wide">${g.kana.map((k) => `
            <div class="cell" data-kana="${esc(k.kana)}" style="cursor:pointer"><div class="kana">${esc(k.kana)}</div><b>${esc(k.romaji)}</b></div>`).join("")}
          </div>`).join("");
    const tsu = l.smallTsu ? `
      <p>In romaji you write the next consonant twice: かっこ is <b>kakko</b>. Before ch it becomes t: まっちゃ is <b>matcha</b>.
        Say each pair aloud and feel the pause.</p>
      <div class="pairs">${SMALL_TSU.map(([a, b]) => `
        <div class="panel pair"><span>${esc(a)}<small>${toRomaji(a)}</small></span> ${speakBtn(a)}
          <span>→</span><span>${esc(b)}<small>${toRomaji(b)}</small></span> ${speakBtn(b)}</div>`).join("")}</div>` : "";
    const longVowel = l.longVowel ? `
      <p>In romaji the vowel is written twice: チーズ is <b>chiizu</b>, cheese. It sounds like one long smooth vowel, not two.</p>
      <div class="pairs">${LONG_VOWELS.map(([a, b]) => `
        <div class="panel pair"><span>${esc(a)}<small>${toRomaji(a)}</small></span>
          <span>→</span><span>${esc(b)}<small>${toRomaji(b)}</small></span> ${speakBtn(b)}</div>`).join("")}</div>
      <p style="margin-top:1rem">Now read this menu item: <span class="jp" style="font-size:1.5rem">ベーコンチーズバーガー</span>
        <button class="ghost small" id="reveal-burger">Show</button> <b id="burger" hidden>${toRomaji("ベーコンチーズバーガー")}, a bacon cheeseburger</b></p>` : "";
    const tasks = [
      l.groups.length ? { text: `Flip through these ${kanaOf(l.groups).length} cards until they feel familiar.`, href: `#cards/${l.groups.join(",")}`, label: "Flashcards" } : null,
      ...l.tasks.map((t) => ({ text: t.text, href: `#quiz/${t.quiz.join(",")}/${t.rounds}`, label: "Start quiz" })),
      l.sheet ? { text: `Worksheet${SHEETS.find((s) => s.id === l.sheet) ? `: ${SHEETS.find((s) => s.id === l.sheet).title}` : ""}. Take the breaks between rounds — recalling after a pause is the point.`, href: `#sheets/${l.sheet}`, label: "Worksheet" } : null,
      l.smallTsu || l.longVowel ? { text: "No exercise for this one. Move on to reading real sentences.", href: reading, label: "Reading practice" } : null,
    ].filter(Boolean);
    const name = script === "katakana" ? "Katakana step" : "Step";
    app.innerHTML = `
      <p><a href="#learn">← All steps</a></p>
      <div class="muted">${name} ${i + 1} · ${esc(l.sub)}</div>
      <h1 class="jp">${esc(l.title)}</h1>
      <p class="lead">${esc(l.intro)}</p>
      ${kanaCards}${tsu}${longVowel}
      <h2>Practice</h2>
      <div class="panel">${tasks.map((t) => `
        <div class="task"><div class="text">${esc(t.text)}</div><a class="btn" href="${t.href}">${t.label}</a></div>`).join("")}</div>
      <div class="row" style="margin-top:1.2rem">
        ${i > 0 ? `<a class="btn ghost" href="#learn/${prefix}${i}">← ${name} ${i}</a>` : ""}
        <span class="spacer"></span>
        ${i < lessons.length - 1 ? `<a class="btn ghost" href="#learn/${prefix}${i + 2}">${name} ${i + 2} →</a>` : `<a class="btn ghost" href="${reading}">Reading practice →</a>`}
      </div>`;
    app.querySelectorAll("[data-kana]").forEach((el) => el.addEventListener("click", () => kanaModal(byKana.get(el.dataset.kana))));
    app.querySelector("#reveal-burger")?.addEventListener("click", (e) => { e.target.hidden = true; app.querySelector("#burger").hidden = false; });
  }

  // ---------- Flashcards ----------
  function viewCards([sel]) {
    const reverse = store.get("cards.reverse", false);
    if (sel) return runCards(kanaOf(sel.split(",")), reverse, sel);
    const selected = new Set(store.get("cards.sel", ["a"]));
    app.innerHTML = `
      <h1>Flashcards</h1>
      <p class="lead">Look at the card, say the answer out loud, then flip it and be honest. Cards you miss come back a few cards later.</p>
      <div class="panel"><div id="pick"></div>
        <div class="row" style="margin-top:1.2rem">
          <label class="row"><input type="checkbox" id="rev" ${reverse ? "checked" : ""}> Show romaji, recall the kana</label>
          <span class="spacer"></span><span class="muted" id="count"></span>
          <button id="go">Start</button>
        </div></div>`;
    const update = () => {
      const n = kanaOf([...selected]).length;
      app.querySelector("#count").textContent = `${n} cards`;
      app.querySelector("#go").disabled = !n;
      store.set("cards.sel", [...selected]);
    };
    app.querySelector("#pick").appendChild(picker(selected, update));
    app.querySelector("#rev").addEventListener("change", (e) => store.set("cards.reverse", e.target.checked));
    app.querySelector("#go").addEventListener("click", () => { location.hash = `#cards/${orderedSel(selected).join(",")}`; });
    update();
  }

  function runCards(deck, reverse, sel) {
    cleanup();
    // Weakest first, shuffled within a box [every box-1 card before any box-3 card].
    let queue = shuffle([...deck]).sort((a, b) => boxOf(a.kana) - boxOf(b.kana));
    const missed = new Set();
    let done = 0;
    let flipped = false;

    function draw() {
      if (!queue.length) return finish();
      const k = queue[0];
      flipped = false;
      const front = reverse ? `<div class="rom">${esc(k.romaji)}</div>` : `<div class="kana">${esc(k.kana)}</div>`;
      const back = reverse
        ? `<div class="kana">${esc(k.kana)}</div>`
        : `<div class="rom">${esc(k.romaji)}</div>`;
      app.innerHTML = `
        <div class="row"><a href="#cards">← Choose cards</a><span class="spacer"></span>
          <span class="progress-line">${queue.length} left · ${done} done</span></div>
        <div class="stage">
          <div class="flash" id="card"><div class="flash-inner">
            <div class="face front">${front}<div class="hint"><span class="key-only">click or <span class="kbd">space</span></span><span class="touch-only">tap</span> to flip</div></div>
            <div class="face back">${back}${speakBtn(k.kana)}<div class="mn">${esc(k.mnemonic)}</div>
              ${k.lookalike ? `<div class="mn small">Look-alike: ${esc(k.lookalike)}</div>` : ""}</div>
          </div></div>
          <div class="row">
            <button class="bad" id="again" disabled>Again <span class="kbd">1</span></button>
            <button class="good" id="got" disabled>Got it <span class="kbd">2</span></button>
          </div>
          <div class="card-art">${artBtn(k.kana)}</div>
        </div>`;
      app.querySelector("#card").addEventListener("click", (e) => { if (!e.target.closest("[data-say]")) flip(); });
      app.querySelector("#again").addEventListener("click", () => answer(false));
      app.querySelector("#got").addEventListener("click", () => answer(true));
    }
    function flip() {
      flipped = !flipped;
      app.querySelector("#card").classList.toggle("flipped", flipped);
      app.querySelector(".stage").classList.toggle("flipped", flipped);
      app.querySelectorAll("#again, #got").forEach((b) => { b.disabled = false; });
    }
    function answer(ok) {
      const k = queue.shift();
      record(k.kana, ok);
      if (ok) done++;
      else { missed.add(k); queue.splice(Math.min(3, queue.length), 0, k); }
      draw();
    }
    function finish() {
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
          <h1>Deck done!</h1>
          <p class="muted">${deck.length} cards · ${missed.size ? `${missed.size} needed another look` : "no misses"}</p>
          ${missed.size ? `<div class="miss-list" style="justify-content:center">${[...missed].map((k) => `<span class="miss">${esc(k.kana)}<small>${esc(k.romaji)}</small></span>`).join("")}</div>` : ""}
          <div class="row" style="justify-content:center;margin-top:1.2rem">
            <button id="re">Same deck again</button>
            ${missed.size ? `<button class="ghost" id="miss">Only the missed ones</button>` : ""}
            <a class="btn ghost" href="#quiz/${sel}/1">Quiz these</a>
            <a class="btn ghost" href="#cards">Other cards</a>
          </div></div>`;
      app.querySelector("#re").addEventListener("click", () => runCards(deck, reverse, sel));
      app.querySelector("#miss")?.addEventListener("click", () => runCards([...missed], reverse, sel));
    }
    onKey((e) => {
      if (typing(e) || !queue.length) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      else if (flipped && (e.key === "1" || e.key === "ArrowLeft")) answer(false);
      else if (flipped && (e.key === "2" || e.key === "ArrowRight")) answer(true);
    });
    draw();
  }

  // ---------- Quiz ----------
  function viewQuiz([sel, rounds]) {
    // A hand-typed hash can name no known group [#quiz/zz/1 = the picker, not a 0-kana run at NaN%].
    if (sel && kanaOf(sel.split(",")).length) return runQuiz(kanaOf(sel.split(",")), Math.max(1, +rounds || 1), `${sel}/${+rounds || 1}`);
    const selected = new Set(store.get("quiz.sel", main));
    let r = store.get("quiz.rounds", 1);
    app.innerHTML = `
      <h1>Quiz</h1>
      <p class="lead">Type the romaji for each kana. Right answers move on by themselves; press <span class="kbd">Enter</span> to give up on one.
        Misses come back later in the round. Go for speed once you're accurate.</p>
      <div class="panel"><div id="pick"></div>
        <div class="row" style="margin-top:1.2rem">
          <label>Rounds <select id="rounds">${[1, 2, 3, 5].map((n) => `<option ${n === r ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <span class="muted" id="best"></span><span class="spacer"></span><span class="muted" id="count"></span>
          <button id="go">Start</button>
        </div></div>`;
    const key = () => `${orderedSel(selected).join(",")}/${r}`;
    const update = () => {
      const n = kanaOf([...selected]).length;
      app.querySelector("#count").textContent = `${n} kana × ${r}`;
      app.querySelector("#go").disabled = !n;
      const best = store.get("quiz.best", {})[key()];
      app.querySelector("#best").textContent = best ? `Best: ${fmtTime(best.ms)} at ${best.acc}%` : "";
      store.set("quiz.sel", [...selected]);
    };
    app.querySelector("#pick").appendChild(picker(selected, update));
    app.querySelector("#rounds").addEventListener("change", (e) => { r = +e.target.value; store.set("quiz.rounds", r); update(); });
    app.querySelector("#go").addEventListener("click", () => { location.hash = `#quiz/${key()}`; });
    update();
  }

  function runQuiz(list, rounds, bestKey) {
    cleanup();
    const queue = [];
    for (let i = 0; i < rounds; i++) queue.push(...shuffle([...list]));
    const total = queue.length;
    const misses = new Map();
    let idx = 0, right = 0, wrong = 0, waiting = false;
    const start = Date.now();

    app.innerHTML = `
      <div class="row"><a href="#quiz">← Choose kana</a><span class="spacer"></span>
        <span class="progress-line" id="prog"></span></div>
      <div class="stage">
        <div class="quiz-kana" id="kana"></div>
        <input class="quiz-input" id="in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="romaji">
        <div class="feedback" id="fb"></div>
        <div class="stats"><span>✓ <b id="ok">0</b></span><span>✗ <b id="bad">0</b></span><span>⏱ <b id="time">0:00</b></span></div>
      </div>`;
    const input = app.querySelector("#in");
    const fb = app.querySelector("#fb");
    every(500, () => { const t = app.querySelector("#time"); if (t) t.textContent = fmtTime(Date.now() - start); });

    function show() {
      if (idx >= queue.length) return finish();
      const k = queue[idx];
      app.querySelector("#kana").textContent = k.kana;
      app.querySelector("#prog").textContent = `${Math.min(right + 1, total)} / ${total}`;
      input.value = ""; input.className = "quiz-input"; input.readOnly = false; input.focus();
      fb.innerHTML = "";
      waiting = false;
    }
    function correct(k) {
      record(k.kana, true);
      right++;
      app.querySelector("#ok").textContent = right;
      input.classList.add("right"); input.readOnly = true;
      idx++;
      after(160, show);
    }
    function miss(k) {
      record(k.kana, false);
      wrong++;
      misses.set(k, (misses.get(k) || 0) + 1);
      app.querySelector("#bad").textContent = wrong;
      input.classList.add("wrong"); input.readOnly = true;
      fb.innerHTML = `<div class="ans">${esc(k.romaji)} ${speakBtn(k.kana)}</div><div class="muted">${esc(k.mnemonic)}</div>
        ${artBtn(k.kana)}
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
      queue.splice(idx + 3 + Math.floor(Math.random() * 4), 0, k);
      idx++;
      waiting = true;
    }
    input.addEventListener("input", () => {
      if (waiting || input.readOnly) return;
      const k = queue[idx], v = norm(input.value);
      // A spelling that starts a longer accepted one waits for Enter [n could still become nn].
      if (k.accept.includes(v) && !k.accept.some((a) => a !== v && a.startsWith(v))) correct(k);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (waiting) return show();
      if (input.readOnly) return;
      const k = queue[idx];
      k.accept.includes(norm(input.value)) ? correct(k) : miss(k);
    });
    // Enter still continues once focus has left the answer box [after pressing Show illustration].
    onKey((e) => { if (waiting && e.key === "Enter" && e.target !== input && !e.target.closest("button")) show(); });
    function finish() {
      const ms = Date.now() - start;
      const acc = Math.round((right / (right + wrong)) * 100);
      let note = "";
      if (bestKey) {
        const bests = store.get("quiz.best", {});
        const prev = bests[bestKey];
        if (!prev || acc > prev.acc || (acc === prev.acc && ms < prev.ms)) {
          bests[bestKey] = { ms, acc };
          store.set("quiz.best", bests);
          note = prev ? `<span class="badge">New best!</span> previous ${fmtTime(prev.ms)} at ${prev.acc}%` : "First run — now beat it.";
        } else note = `Best: ${fmtTime(prev.ms)} at ${prev.acc}%`;
      }
      const sorted = [...misses].sort((a, b) => b[1] - a[1]);
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
          <h1>Done!</h1>
          <div class="stats" style="margin:1rem 0">
            <div><div class="big-number">${fmtTime(ms)}</div>time</div>
            <div><div class="big-number">${acc}%</div>accuracy</div>
            <div><div class="big-number">${total}</div>kana</div>
          </div>
          <p class="muted">${note}</p>
          ${sorted.length ? `<h2>Missed</h2><div class="miss-list" style="justify-content:center">${sorted.map(([k, n]) =>
            `<span class="miss">${esc(k.kana)}<small>${esc(k.romaji)}${n > 1 ? ` ×${n}` : ""}</small></span>`).join("")}</div>` : ""}
          <div class="row" style="justify-content:center;margin-top:1.2rem">
            <button id="re">Again</button>
            ${sorted.length ? `<button class="ghost" id="miss">Drill the missed ones</button>` : ""}
            <a class="btn ghost" href="#quiz">Other kana</a>
          </div></div>`;
      app.querySelector("#re").addEventListener("click", () => runQuiz(list, rounds, bestKey));
      app.querySelector("#miss")?.addEventListener("click", () => runQuiz(sorted.map(([k]) => k), 3, null));
    }
    show();
  }

  // ---------- Worksheets ----------
  // Shown on worksheet and reading pages when the bucket couldn't be read [offline on the train].
  function needContent() {
    app.innerHTML = `
      <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
        <h1>Can't load the worksheets</h1>
        <p class="muted">They're stored with your account and need a connection. Lessons, flashcards, quiz and chart still work.</p>
        ${contentError ? `<p class="muted small">${esc(contentError)}</p>` : ""}
        <button id="retry">Try again</button>
      </div>`;
    app.querySelector("#retry").addEventListener("click", async () => {
      await loadContent();
      route();
    });
  }

  function viewSheets([id]) {
    if (!SHEETS.length) return needContent();
    const sheet = SHEETS.find((s) => s.id === id);
    if (sheet) return runSheet(sheet);
    const done = store.get("sheets.done", {});
    app.innerHTML = `
      <h1>Worksheets</h1>
      <p class="lead">Tofugu's worksheets, typed instead of handwritten. Each one has three rounds of 48 kana with a 5-minute and a
        10-minute break in between — the breaks make you recall from memory instead of from a few seconds ago, so take them.</p>
      ${[["hiragana", "Hiragana"], ["katakana", "Katakana"]].map(([script, title]) => `
      <h2>${title}</h2>
      <div class="grid">${SHEETS.filter((s) => s.script === script).map((s) => `
        <div class="panel">
          <div class="step muted small">${s.rounds.length} round${s.rounds.length > 1 ? "s" : ""} · ${s.rounds.reduce((n, r) => n + r.length, 0)} kana</div>
          <h2 style="margin:.2rem 0">${esc(s.title)}</h2>
          <p class="muted small">${esc(s.instructions.replace(/ into the boxes[.:]?/, ""))}</p>
          ${done[s.id] ? `<p class="small"><span class="badge">Best ${done[s.id]}%</span></p>` : ""}
          <div class="row"><a class="btn" href="#sheets/${s.id}">Start</a>
            <a class="small" href="${docUrl(s.id)}" target="_blank" rel="noopener">Printable original ↗</a></div>
        </div>`).join("")}
      </div>`).join("")}
      <p class="muted small" style="margin-top:1.2rem">The sentence worksheets (Hiragana Practice #1 and #2, and the katakana one) are under <a href="#reading">Reading</a>.</p>`;
  }

  function runSheet(sheet) {
    let round = 0;
    let rightTotal = 0, countTotal = 0;

    function drawRound() {
      const cells = sheet.rounds[round];
      app.innerHTML = `
        <div class="row"><a href="#sheets">← Worksheets</a><span class="spacer"></span>
          <span class="progress-line">Round ${round + 1} of ${sheet.rounds.length}</span></div>
        <h1>${esc(sheet.title)}</h1>
        <p class="lead">${esc(sheet.instructions.replace(/:$/, "."))} <span class="small key-only">Press <span class="kbd">Enter</span> or <span class="kbd">space</span> to jump to the next box.</span></p>
        <div class="sheet-grid ${sheet.id === "youon" ? "wide" : ""}">${cells.map((c, i) => `
          <label class="cell"><div class="kana">${esc(c)}</div>
            <input data-i="${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${i < cells.length - 1 ? "next" : "done"}">
            <div class="fix"></div></label>`).join("")}
        </div>
        <div class="sticky-actions row"><span id="score" class="muted"></span><span class="spacer"></span>
          <button id="check">Check answers</button></div>`;
      const inputs = [...app.querySelectorAll(".cell input")];
      inputs.forEach((inp, i) => inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (inputs[i + 1]) inputs[i + 1].focus(); else app.querySelector("#check").focus();
        }
      }));
      inputs[0].focus();
      app.querySelector("#check").addEventListener("click", () => check(cells, inputs));
    }

    function check(cells, inputs) {
      let right = 0;
      inputs.forEach((inp, i) => {
        const k = byKana.get(cells[i]);
        const ok = k.accept.includes(norm(inp.value));
        record(k.kana, ok);
        if (ok) right++;
        const cell = inp.closest(".cell");
        cell.classList.add(ok ? "right" : "wrong");
        cell.querySelector(".fix").textContent = ok ? "" : k.romaji;
        inp.readOnly = true;
      });
      rightTotal += right; countTotal += cells.length;
      const last = round === sheet.rounds.length - 1;
      const minutes = round === 0 ? 5 : 10;
      app.querySelector("#score").innerHTML = `✓ <b>${right} / ${cells.length}</b>`;
      const actions = app.querySelector(".sticky-actions");
      actions.querySelector("#check").remove();
      actions.insertAdjacentHTML("beforeend", last
        ? `<button id="fin">Finish</button>`
        : `<button class="ghost" id="skip">Skip</button><button id="brk">${minutes}-minute break</button>`);
      app.querySelector("#fin")?.addEventListener("click", finish);
      app.querySelector("#skip")?.addEventListener("click", () => { round++; drawRound(); scrollTo(0, 0); });
      app.querySelector("#brk")?.addEventListener("click", () => takeBreak(minutes));
      (app.querySelector("#brk") || app.querySelector("#fin")).focus();
    }

    function takeBreak(minutes) {
      const end = Date.now() + minutes * 60000;
      const title = document.title;
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
          <h1>Break time</h1>
          <p class="muted">Step away and think about something else. Round ${round + 2} will be a real test of memory.</p>
          <div class="break-timer" id="left">${minutes}:00</div>
          <div class="row" style="justify-content:center;margin-top:1rem"><button class="ghost" id="go">Skip, start round ${round + 2}</button></div>
        </div>`;
      const go = () => { document.title = title; round++; drawRound(); };
      teardown.push(() => { document.title = title; });
      app.querySelector("#go").addEventListener("click", go);
      every(250, () => {
        const ms = end - Date.now();
        const el = app.querySelector("#left");
        if (!el) return;
        if (ms > 0) { el.textContent = fmtTime(ms); return; }
        el.textContent = "Break's over!";
        document.title = "⏰ Break's over — ひらがな";
        const b = app.querySelector("#go");
        if (b.textContent.startsWith("Skip")) { b.textContent = `Start round ${round + 2}`; b.className = ""; b.focus(); }
      });
    }

    function finish() {
      const pct = Math.round((rightTotal / countTotal) * 100);
      const done = store.get("sheets.done", {});
      done[sheet.id] = Math.max(done[sheet.id] || 0, pct);
      store.set("sheets.done", done);
      const idx = SHEETS.indexOf(sheet);
      // The next worksheet in the same script, then that script's reading [k-rwn leads to #reading/2/0].
      const next = SHEETS[idx + 1]?.script === sheet.script ? SHEETS[idx + 1] : null;
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
          <h1>${sheet.id === "youon" ? "You did it! Party time! 🎉" : "Worksheet done!"}</h1>
          <div class="big-number">${pct}%</div><p class="muted">${rightTotal} of ${countTotal} right over ${sheet.rounds.length} round${sheet.rounds.length > 1 ? "s" : ""}</p>
          <div class="row" style="justify-content:center">
            <a class="btn ghost" href="#sheets">All worksheets</a>
            ${next ? `<a class="btn" href="#sheets/${next.id}">Next: ${esc(next.title)}</a>` : `<a class="btn" href="${TRACKS[sheet.script].reading}">Reading practice</a>`}
          </div></div>`;
    }
    drawRound();
  }

  // ---------- Reading ----------
  function viewReading([s, n]) {
    if (!READING.length) return needContent();
    const sheet = Math.min(READING.length - 1, Math.max(0, +s || 0));
    const list = READING[sheet];
    let i = Math.min(list.length - 1, Math.max(0, +n || 0));
    let showAll = false;
    const done = new Set(store.get("reading.done", []));

    function draw() {
      const text = list[i];
      const kata = sheet === 2;
      app.innerHTML = `
        <h1>Reading practice</h1>
        <p class="lead">${kata
          ? "English, spelled out in katakana. Sound each sentence out and you'll hear what it says."
          : "Real sentences in hiragana from Tofugu's practice sheets. Don't worry about the meaning — make sure you can read every kana and sound it out loud."}
          Tap a kana to peek at its romaji and hear it.</p>
        <div class="row" style="margin-bottom:1rem">
          ${READING.map((_, j) => `<a class="btn ${j === sheet ? "" : "ghost"}" href="#reading/${j}/0">${j === 2 ? "Katakana" : `Practice #${j + 1}`}</a>`).join("")}
          <span class="spacer"></span><a class="small" href="${docUrl("p" + sheet)}" target="_blank" rel="noopener">Printable original ↗</a>
        </div>
        <div class="dots">${list.map((_, j) => `<button class="dot ${done.has(`${sheet}-${j}`) ? "done" : ""} ${j === i ? "here" : ""}" data-j="${j}">${j + 1}</button>`).join("")}</div>
        <div class="panel" style="margin-top:1rem">
          <div class="sentence ${showAll ? "show-all" : ""}" id="sent">${tokens(text).map((t) =>
            [...t].some(isKana) ? `<span class="tok" data-r="${esc(toRomaji(t))}">${esc(t)}</span>` : esc(t)).join("")}</div>
          ${showAll ? `<div class="romaji-line">${esc(toRomaji(text))}</div>` : ""}
          ${kata ? "" : `<p class="muted small">Romaji here is letter by letter: as particles, は is said <b>wa</b>, へ is said <b>e</b> and を is said <b>o</b>.</p>`}
        </div>
        <div class="row" style="margin-top:1rem">
          <button class="ghost" id="prev" ${i === 0 ? "disabled" : ""}>← Prev</button>
          <button class="ghost" id="all">${showAll ? "Hide" : "Show"} romaji <span class="kbd">R</span></button>
          ${speakBtn(text)}
          <span class="spacer"></span>
          <button class="good" id="read">I read it ✓ <span class="kbd">Enter</span></button>
          <button class="ghost" id="next" ${i === list.length - 1 ? "disabled" : ""}>Next →</button>
        </div>
        <p class="muted small" style="margin-top:1.5rem">Want more? Tofugu suggests <a href="https://www3.nhk.or.jp/news/easy/" target="_blank" rel="noopener">NHK News Web Easy</a>
          and graded readers once these feel easy.</p>`;
      app.querySelector("#sent").addEventListener("click", (e) => {
        const t = e.target.closest(".tok");
        if (!t) return;
        t.classList.toggle("peek");
        if (clipFor(t.textContent)) say(t.textContent);
      });
      app.querySelectorAll(".dot").forEach((d) => d.addEventListener("click", () => go(+d.dataset.j)));
      app.querySelector("#prev").addEventListener("click", () => go(i - 1));
      app.querySelector("#next").addEventListener("click", () => go(i + 1));
      app.querySelector("#all").addEventListener("click", toggle);
      app.querySelector("#read").addEventListener("click", markRead);
    }
    function go(j) {
      if (j < 0 || j >= list.length) return;
      i = j; showAll = false;
      history.replaceState(null, "", `#reading/${sheet}/${i}`);
      draw();
    }
    function toggle() { showAll = !showAll; draw(); }
    function markRead() {
      done.add(`${sheet}-${i}`);
      store.set("reading.done", [...done]);
      if (i < list.length - 1) go(i + 1); else draw();
    }
    onKey((e) => {
      if (typing(e)) return;
      if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key.toLowerCase() === "r") toggle();
      else if (e.key === "Enter" && !e.target.closest("button, a")) markRead();
    });
    draw();
  }

  // ---------- Chart ----------
  function viewChart() {
    const VOWEL = { a: 0, i: 1, u: 2, e: 3, o: 4 };
    const cell = (k) => k
      ? `<td class="box-${boxOf(k.kana)}" data-kana="${esc(k.kana)}"><span class="kana">${esc(k.kana)}</span><small>${esc(k.romaji)}</small></td>`
      : `<td class="empty"></td>`;
    // One row per group; a kana whose spot is taken opens another row [シェ, ジェ and チェ all sit under e].
    const table = (script, kind, width, slot) => `<div class="chart-wrap"><table class="chart">${groups.filter((g) => g.kind === kind && g.script === script).map((g) => {
      const rows = [Array(width).fill(null)];
      g.kana.forEach((k) => {
        const at = slot(k) ?? 0;
        const row = rows.find((r) => !r[at]) || rows[rows.push(Array(width).fill(null)) - 1];
        row[at] = k;
      });
      return rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
    }).join("")}</table></div>`;
    const bySound = (k) => VOWEL[k.romaji.slice(-1)];
    const byYouon = (k) => ({ a: 0, u: 1, o: 2 })[k.romaji.slice(-1)];
    const mastered = (script) => `${KANA.filter((k) => k.script === script && boxOf(k.kana) >= 3).length} of ${KANA.filter((k) => k.script === script).length} known`;
    app.innerHTML = `
      <h1>Kana chart</h1>
      <p class="lead">Every kana, coloured by how well you know it. Click one for its mnemonic.</p>
      <div class="legend"><span class="box-0"></span> new <span class="box-1"></span> missed lately
        <span class="box-2"></span><span class="box-3"></span><span class="box-4"></span><span class="box-5"></span> known → solid</div>
      <h2>Hiragana <span class="muted small">· ${mastered("hiragana")}</span></h2>
      <h3>Main kana</h3>${table("hiragana", "main", 5, bySound)}
      <h3>Dakuten & han-dakuten</h3>${table("hiragana", "dakuten", 5, bySound)}
      <h3>Combinations</h3>${table("hiragana", "youon", 3, byYouon)}
      <h2 style="margin-top:2.5rem">Katakana <span class="muted small">· ${mastered("katakana")}</span></h2>
      <h3>Main kana</h3>${table("katakana", "main", 5, bySound)}
      <h3>Dakuten & han-dakuten</h3>${table("katakana", "dakuten", 5, bySound)}
      <h3>Combinations</h3>${table("katakana", "youon", 3, byYouon)}
      <h3>Extended sounds</h3>${table("katakana", "extended", 5, bySound)}
      <div class="row" style="margin-top:2rem;justify-content:center">
        <a class="btn ghost" href="https://www.tofugu.com/japanese/hiragana-mnemonics-chart/" target="_blank" rel="noopener">Tofugu's illustrated mnemonic chart ↗</a>
        <button class="ghost" id="reset">Reset my progress</button>
      </div>`;
    app.querySelectorAll("[data-kana]").forEach((el) => el.addEventListener("click", () => kanaModal(byKana.get(el.dataset.kana))));
    app.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("Forget all progress, quiz bests and worksheet scores on every device?")) return;
      const now = Date.now();
      // Newer than any reset this device has seen, whatever its clock says [last reset 1000, clock reads 900 = 1001].
      applySnapshot({ ...blank(), savedAt: now, resetAt: Math.max(now, store.get("sync.resetAt", 0) + 1) });
      sync();
      viewChart();
    });
  }

  // ---------- Shell ----------
  const fontBtn = document.getElementById("font-toggle");
  const setFont = (mincho) => {
    document.body.classList.toggle("mincho", mincho);
    fontBtn.textContent = `Font: ${mincho ? "Mincho" : "Gothic"}`;
    store.set("font", mincho);
  };
  fontBtn.addEventListener("click", () => setFont(!document.body.classList.contains("mincho")));
  setFont(store.get("font", false));

  const routes = { learn: viewLearn, cards: viewCards, quiz: viewQuiz, sheets: viewSheets, reading: viewReading, chart: viewChart };
  // Stops the timers and key handlers of whatever was on screen [a finished quiz's clock].
  function cleanup() {
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
    teardown.forEach((fn) => fn());
    teardown = [];
  }
  function route() {
    cleanup();
    const [tab, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
    const view = routes[tab] ? tab : "learn";
    document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.tab === view));
    routes[view](rest);
    scrollTo(0, 0);
  }
  async function loadContent() {
    try {
      const c = await backend.content();
      // Katakana sits under its own key so an older deploy still reads this file [c.katakana.sheets].
      SHEETS = [...c.sheets.map((s) => ({ ...s, script: "hiragana" })), ...(c.katakana?.sheets || []).map((s) => ({ ...s, script: "katakana" }))];
      READING = [...c.reading, ...(c.katakana ? [c.katakana.reading] : [])];
      contentError = "";
    } catch (e) {
      contentError = e?.message || String(e);
    }
  }

  // Full-page screen with no nav, for signed-out and not-allowed states.
  function gate(html) {
    document.body.classList.add("gated");
    app.innerHTML = `<div class="panel gate">
      <div class="gate-logo">ひ</div><h1>Hiragana</h1>${html}</div>`;
  }
  function signInScreen(error) {
    gate(`<p class="muted">Sign in to study. Your progress follows you to every device.</p>
      ${error ? `<p class="gate-error">${esc(error)}</p>` : ""}
      <button id="google">Sign in with Google</button>`);
    app.querySelector("#google").addEventListener("click", () => backend.signIn());
  }
  async function signOut() {
    await sync();
    if (unsynced() && !confirm("Your latest answers haven't reached the server yet. Sign out and lose them?")) return;
    await backend.signOut();
    ["sync.allowed", "sync.savedAt", "sync.resetAt", "sync.pushedAt", "sync.user", ...SYNCED].forEach((k) => localStorage.removeItem("hira." + k));
    location.replace(location.pathname);
  }
  function blockedScreen(message) {
    gate(`<p>${message}</p><button class="ghost" id="out">Sign out</button>`);
    app.querySelector("#out").addEventListener("click", signOut);
  }

  async function boot() {
    if (!backend) {
      return gate(`<p class="muted">Not connected to Supabase yet: fill in <code>config.js</code>.</p>`);
    }
    // Supabase reports a refused sign-in in the query string [?error_description=Signups+not+allowed].
    const authError = new URLSearchParams(location.search).get("error_description");
    if (location.search) history.replaceState(null, "", location.pathname + location.hash);
    user = await backend.session().catch(() => null);
    if (!user) return signInScreen(authError);

    // One round trip for everything; content and clips fail by themselves when the account isn't listed.
    const pulled = backend.loadProgress();
    pulled.catch(() => {});
    const [allowed] = await Promise.all([
      backend.isAllowed().then((ok) => { store.set("sync.allowed", ok); return ok; },
        () => store.get("sync.allowed", null)),
      loadContent(),
      loadMediaUrls().catch(() => {}),
    ]);
    if (allowed === null) return blockedScreen("Can't reach the server to check your account. Try again once you're online.");
    if (!allowed) return blockedScreen(`<b>${esc(user.email)}</b> isn't on the list for this site.`);

    document.body.classList.remove("gated");
    document.getElementById("account").innerHTML =
      `${esc(user.email)} · <span id="sync-note">Syncing…</span> · <button class="linkish" id="signout">Sign out</button>`;
    document.getElementById("signout").addEventListener("click", signOut);
    addEventListener("hashchange", route);
    // This device's copy belongs to the account that made it [A's session expires, B signs in = A's answers stay out of B's row].
    if (store.get("sync.user", user.id) !== user.id) applySnapshot(blank());
    store.set("sync.user", user.id);
    await sync(pulled);
    route();
  }
  boot();
})();
