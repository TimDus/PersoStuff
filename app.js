(function () {
  const { groups, KANA, LESSONS, KATA_LESSONS, SMALL_TSU, LONG_VOWELS, ids, main } = window.HIRAGANA;
  const { clipPath, imagePath, bump, merge, same, wholeCategories } = window.HiraSync;
  const { gapFor, spaced, requeue, slowest, shareKana } = window.HiraOrder;
  const backend = window.HIRA_BACKEND;
  // Worksheets and sentences arrive from the private bucket after sign-in [empty until then, or when offline].
  let SHEETS = [];
  let READING = [];
  let contentError = "";
  const byKana = new Map(KANA.map((k) => [k.kana, k]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const keepBest = wholeCategories(groups);
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
  // Each group once, however often a typed hash names it [#quiz/a,a/1 = あいうえお, not ten kana that left the order holes].
  const kanaOf = (groupIds) => [...new Set(groupIds)].flatMap((id) => groupById.get(id)?.kana || []);
  // A typed round count within the picker's 1 to 5 [#quiz/a/1e9 = 5, where it hung the tab].
  const roundsOf = (r) => Math.min(5, Math.max(1, Math.floor(+r) || 1));
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
        // Past the last push even on a slow clock, as the deck's save() does [pushed at a fast device's 13:00, answered at 12:10].
        localStorage.setItem("hira.sync.savedAt", Math.max(Date.now(), store.get("sync.savedAt", 0) + 1, store.get("sync.pushedAt", 0) + 1));
        scheduleSync();
      }
    },
  };

  // Reading mastery per kana, 0 unseen to 5 mastered [writing keeps its own in the deck, study.write].
  let progress = store.get("progress", {});
  function record(kana, ok) {
    bump(progress[kana] || (progress[kana] = { box: 0, right: 0, wrong: 0 }), ok);
    store.set("progress", progress);
  }
  const boxOf = (kana) => progress[kana]?.box || 0;
  const mastery = (list) => (list.length ? list.filter((k) => boxOf(k.kana) >= 3).length / list.length : 0);

  let user = null;
  // Set once this device's copy is known to be the account's, so an early online event can't push another account's answers [boot stopped at "Can't reach the server"].
  let owned = false;
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
  // One note for both syncs, Offline while either last failed [kana synced, deck pull failed = Offline].
  const syncOk = { kana: true, study: true };
  function syncState(part, ok) {
    syncOk[part] = ok;
    const el = document.getElementById("sync-note");
    if (el) el.textContent = syncOk.kana && syncOk.study
      ? `Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Offline, will sync later";
  }
  // Answers this device holds that the server doesn't [savedAt 1200, last pushed 1000 = one quiz since the last sync].
  const unsynced = () => store.get("sync.savedAt", 0) > store.get("sync.pushedAt", 0);
  // Pull, merge, push; the local snapshot is read after the pull so an answer given meanwhile is kept [no await between merge and apply].
  function sync(pulled) {
    clearTimeout(syncTimer);
    syncTimer = null;
    syncChain = syncChain.then(async () => {
      if (!user || !backend || !owned) return;
      try {
        const remote = await (pulled || backend.loadProgress());
        const merged = merge(snapshot(), remote, keepBest);
        applySnapshot(merged);
        if (!same(merged, remote)) await backend.saveProgress(user.id, merged);
        localStorage.setItem("hira.sync.pushedAt", merged.savedAt);
        syncState("kana", true);
      } catch {
        syncState("kana", false);
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

  // Timers, key handlers and leave hooks last until the next route change [a break countdown stops, a half-done review uploads].
  let teardown = [];
  // A popup takes the keys from the page under it [3 with a kanji's popup open graded the card behind].
  const onKey = (fn) => {
    const h = (e) => { if (!document.querySelector(".modal-back")) fn(e); };
    document.addEventListener("keydown", h);
    teardown.push(() => document.removeEventListener("keydown", h));
  };
  const every = (ms, fn) => {
    const t = setInterval(fn, ms);
    teardown.push(() => clearInterval(t));
    return () => clearInterval(t);
  };
  // A click that isn't the second of a double-click, which lands on the button drawn where the first one was [Check, then Break].
  const single = (fn) => (e) => { if (e.detail <= 1) fn(e); };
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
  // A word's own recording needs no signed link, and speech stands in when it won't load, not when a newer tap cut it off [offline = NotSupportedError, a second tap = AbortError].
  async function say(text, rec) {
    window.speechSynthesis?.cancel();
    player.pause();
    if (rec) { player.src = rec; player.play().catch((e) => { if (e.name !== "AbortError") speak(text); }); return; }
    const clip = clipFor(text);
    if (clip) {
      const url = await mediaUrl(clipPath(clip));
      if (url) { player.src = url; player.play().catch(() => {}); }
      return;
    }
    speak(text);
  }
  function speak(text) {
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
  const strokeBtn = window.HiraStrokes.button;
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
  // A speaker clicked with the mouse gives the focus back, so Space still moves a card on [Enter on it is a click with detail 0 and keeps it].
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-say]");
    if (b) { say(b.dataset.say, b.dataset.rec); if (e.detail) b.blur(); }
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
    back.innerHTML = `<div class="modal panel"><div class="modal-top"><button class="modal-x" data-close aria-label="Close">×</button></div>${html}<div class="row" style="justify-content:center;margin-top:1rem"><button class="ghost" data-close>Close</button></div></div>`;
    // The page under a popup is out of reach of Tab and clicks until it closes [two Tabs reached Again behind a kanji's popup].
    const close = () => { back.remove(); app.inert = false; document.removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", esc_);
    document.body.appendChild(back);
    app.inert = true;
  }
  function kanaModal(k) {
    const p = progress[k.kana], w = study.write.of(k.kana);
    openModal(`
      <div class="kana">${esc(k.kana)}</div>
      <div class="big-number">${esc(k.romaji)} ${speakBtn(k.kana)}</div>
      <p>${esc(k.mnemonic)}</p>
      ${k.lookalike ? `<p class="muted small">Look-alike: ${esc(k.lookalike)}</p>` : ""}
      ${artBtn(k.kana)}${strokeBtn(k.kana)}
      <p class="muted small">Reading: ${p ? `${p.right} right · ${p.wrong} wrong` : "not practised yet"}<br>
        Writing: ${w ? `${w.right} right · ${w.wrong} wrong` : "not practised yet"}</p>`);
  }

  // Column chooser shared by flashcards and quiz, hiragana above katakana [all of Main = 46 kana].
  const SCRIPTS = [["hiragana", "Hiragana", ["main", "dakuten", "youon"]], ["katakana", "Katakana", ["main", "dakuten", "youon", "extended"]]];
  const KIND_NAMES = { main: "Main kana", dakuten: "Dakuten", youon: "Combinations", extended: "Extended sounds" };
  // Group ids per chip: one Learn step for main kana, one column otherwise [hiragana step 7 = m,y; katakana step 1 = k-a,k-k].
  // Group ids behind an all or none button [hiragana = its main, dakuten and combinations; hiragana:main = 10 columns].
  const idsOf = (target) => {
    const [script, kind] = target.split(":");
    return groups.filter((g) => g.script === script && (!kind || g.kind === kind)).map((g) => g.id);
  };
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
      el.innerHTML = SCRIPTS.map(([script, title, kinds]) => `<div class="picker-script"><h3>${title}</h3>
        <button class="linkish" data-all="${script}">all</button><button class="linkish" data-none="${script}">none</button></div>` + kinds.map((kind) => `
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
      } else if (all) idsOf(all.dataset.all).forEach((id) => selected.add(id));
      else if (none) idsOf(none.dataset.none).forEach((id) => selected.delete(id));
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
  const lessonCard = (href, step, title, sub, list) => `<a class="panel lesson-card" href="${href}">
        <div class="step">${step}</div>
        <div class="title">${esc(title)}</div>
        <div class="muted">${esc(sub)}${list.length ? ` · ${list.length} kana` : ""}</div>
        ${list.length ? `<div class="bar"><span style="width:${Math.round(mastery(list) * 100)}%"></span></div>` : ""}
      </a>`;
  // A set's steps with their place in the track [hiragana dakuten = steps 10 to 14].
  const setSteps = (lessons, set) => lessons.map((l, i) => [l, i]).filter(([l]) => l.set === set);
  function viewLearn([step]) {
    const kata = /^k/.test(step || "");
    const script = kata ? "katakana" : "hiragana";
    const key = kata ? step.slice(1) : step;
    const track = TRACKS[script];
    if (step && track.lessons[+key - 1]) return viewLesson(+key - 1, script);
    const set = step && track.lessons.find((l) => l.set?.id === key)?.set;
    if (set) return viewSet(set, script);
    // One card per step, and one per set in place of its steps [Dakuten reads "Steps 10–14"].
    const cards = ({ lessons, prefix }) => lessons.map((l, i) => {
      if (!l.set) return lessonCard(`#learn/${prefix}${i + 1}`, `Step ${i + 1}`, l.title, l.sub, kanaOf(l.groups));
      if (lessons[i - 1]?.set === l.set) return "";
      const steps = setSteps(lessons, l.set);
      return lessonCard(`#learn/${prefix}${l.set.id}`, `Steps ${i + 1}–${steps.at(-1)[1] + 1}`, l.set.title,
        `${l.set.name} · ${steps.length} steps`, kanaOf(steps.flatMap(([s]) => s.groups)));
    }).join("");
    app.innerHTML = `
      <h1>Learn hiragana in ${LESSONS.length} steps</h1>
      <p class="lead">Follow Tofugu's order: learn a column with its mnemonics, quiz everything so far, then do the worksheet.
        Reading comes first; writing practice is there when you want it.</p>
      <div class="grid">
        ${cards(TRACKS.hiragana)}
        <a class="panel lesson-card" href="#reading">
          <div class="step">Step ${LESSONS.length + 1}</div><div class="title">よみましょう</div>
          <div class="muted">Reading practice · 24 sentences</div>
        </a>
      </div>
      <h1 style="margin-top:2.5rem">Then katakana in ${KATA_LESSONS.length} steps</h1>
      <p class="lead">Katakana spells foreign words and names with the same sounds you already know, so it goes faster.
        Ten kana a step, then the sounds hiragana doesn't have.</p>
      <div class="grid">
        ${cards(TRACKS.katakana)}
        <a class="panel lesson-card" href="${TRACKS.katakana.reading}">
          <div class="step">Step ${KATA_LESSONS.length + 1}</div><div class="title">リーディング</div>
          <div class="muted">Reading practice · English in katakana</div>
        </a>
      </div>`;
  }

  function viewSet(set, script) {
    const { lessons, prefix } = TRACKS[script];
    app.innerHTML = `
      <p><a href="#learn">← All steps</a></p>
      <div class="muted">${script === "katakana" ? "Katakana" : "Hiragana"}</div>
      <h1>${esc(set.name)}</h1>
      <p class="lead">One column a step. Each quiz takes in the columns before it, so go in order.</p>
      <div class="grid">${setSteps(lessons, set).map(([l, i]) =>
        lessonCard(`#learn/${prefix}${i + 1}`, `Step ${i + 1}`, l.title, l.sub, kanaOf(l.groups))).join("")}</div>`;
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
            ${artBtn(k.kana)}${strokeBtn(k.kana)}
          </div>`;
    // A row of cards per column where the column is the lesson [しゃ しゅ しょ side by side under "し (shi) + small ゃゅょ"].
    const row = (g) => `
          <div class="kana-row"><div class="muted">${esc(g.note)}</div>
            <div class="row-cards">${g.kana.map(card).join("")}</div>
          </div>`;
    const kanaCards = !lessonGroups.length ? ""
      : l.rows ? `<div class="kana-rows">${lessonGroups.map(row).join("")}</div>`
      : `<div class="kana-list">${lessonGroups.flatMap((g) => g.kana).map(card).join("")}</div>`;
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
      l.groups.length ? { text: "Learn to write them: each stroke is shown for you to trace, then you write the kana from memory.", href: `#write/${l.groups.join(",")}/1/learn`, label: "Practice writing" } : null,
      l.smallTsu || l.longVowel ? { text: "No exercise for this one. Move on to reading real sentences.", href: reading, label: "Reading practice" } : null,
    ].filter(Boolean);
    const name = script === "katakana" ? "Katakana step" : "Step";
    app.innerHTML = `
      <p><a href="#learn">← All steps</a>${l.set ? ` · <a href="#learn/${prefix}${l.set.id}">${esc(l.set.name)}</a>` : ""}</p>
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
          <div class="card-art">${artBtn(k.kana)}${strokeBtn(k.kana)}</div>
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
    if (sel && kanaOf(sel.split(",")).length) {
      const key = `${sel}/${roundsOf(rounds)}`;
      return runQuiz(kanaOf(sel.split(",")), roundsOf(rounds), keepBest(key) ? key : null);
    }
    const selected = new Set(store.get("quiz.sel", main));
    let r = store.get("quiz.rounds", 1);
    let mode = store.get("quiz.mode", "read");
    const LEAD = {
      read: `Type the romaji for each kana. Right answers move on by themselves; press <span class="kbd">Enter</span> to give up on one.
        Misses come back later in the round. Go for speed once you're accurate.`,
      write: `Write each kana from its romaji in stroke order, with a finger or the mouse. Learn shows each stroke to trace, then asks
        the kana from memory. Self shows the answer over your drawing and you say whether you had it. Per stroke and Whole kana check it for you.`,
    };
    app.innerHTML = `
      <h1>Quiz</h1>
      <div class="seg" id="mode" style="margin-bottom:.8rem"><button data-mode="read">Read</button><button data-mode="write">Write</button></div>
      <p class="lead" id="lead"></p>
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
      const best = mode === "write" ? study.write.best(key()) : store.get("quiz.best", {})[key()];
      app.querySelector("#lead").innerHTML = LEAD[mode];
      app.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
      app.querySelector("#best").textContent = !keepBest(key()) ? (n ? "Times are kept for whole categories only" : "")
        : best ? `Best: ${fmtTime(best.ms)} at ${best.acc}%` : "";
      store.set("quiz.sel", [...selected]);
    };
    app.querySelector("#pick").appendChild(picker(selected, update));
    app.querySelector("#rounds").addEventListener("change", (e) => { r = +e.target.value; store.set("quiz.rounds", r); update(); });
    app.querySelector("#mode").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (!b) return;
      mode = b.dataset.mode;
      store.set("quiz.mode", mode);
      update();
    });
    app.querySelector("#go").addEventListener("click", () => { location.hash = `#${mode === "write" ? "write" : "quiz"}/${key()}`; });
    update();
  }

  function runQuiz(list, rounds, bestKey) {
    cleanup();
    const queue = spaced(list, rounds, Math.random, shareKana);
    const total = queue.length, gap = gapFor(list.length);
    const misses = new Map();
    // Each kana's correct answers in ms [か twice at 1.2s and 0.8s = [1200, 800]].
    const took = new Map();
    // The box is never read-only, which drops a phone keyboard; flags hold it instead [`settling` for 160 ms after a right answer, `waiting` after a miss].
    let idx = 0, right = 0, wrong = 0, waiting = false, settling = false, carryFrom = 0, shownAt = 0;
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
      // Cleared before Done so a later Enter there finds nothing to continue [it redrew Done at 0:01, 0:03, 0:05].
      waiting = false;
      if (idx >= queue.length) return finish();
      const k = queue[idx];
      app.querySelector("#kana").textContent = k.kana;
      app.querySelector("#prog").textContent = `${idx + 1} / ${queue.length}`;
      // Letters typed while the last answer settled start this one ["ka" + "k" leaves "k"].
      input.value = settling ? input.value.slice(carryFrom) : "";
      input.className = "quiz-input"; input.focus();
      settling = false;
      fb.innerHTML = "";
      shownAt = Date.now();
      // A whole answer typed ahead counts at once ["ai" in one burst answers あ and い].
      if (input.value && norm(input.value) === k.romaji) correct(k);
    }
    function correct(k) {
      record(k.kana, true);
      right++;
      took.set(k, [...(took.get(k) || []), Date.now() - shownAt]);
      app.querySelector("#ok").textContent = right;
      input.classList.add("right"); settling = true; carryFrom = input.value.length;
      idx++;
      after(160, show);
    }
    function miss(k) {
      record(k.kana, false);
      wrong++;
      misses.set(k, (misses.get(k) || 0) + 1);
      app.querySelector("#bad").textContent = wrong;
      input.classList.add("wrong");
      fb.innerHTML = `<div class="ans">${esc(k.romaji)} ${speakBtn(k.kana)}</div><div class="muted">${esc(k.mnemonic)}</div>
        ${artBtn(k.kana)}
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
      requeue(queue, idx, gap, Math.random, shareKana);
      idx++;
      waiting = true;
    }
    input.addEventListener("input", () => {
      if (waiting || settling) return;
      const k = queue[idx], v = norm(input.value);
      if (v === k.romaji) correct(k);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (waiting) return show();
      if (settling) return;
      const k = queue[idx];
      norm(input.value) === k.romaji ? correct(k) : miss(k);
    });
    // A missed answer stays put until Continue [typing over "zz" is blocked; a phone keyboard's composing still shows, "zz" + "xy", but the quiz ignores it].
    input.addEventListener("beforeinput", (e) => { if (waiting) e.preventDefault(); });
    // Buttons under a miss take no focus, so the answer box keeps the keyboard [Listen, Show illustration, Continue].
    fb.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    // Enter still continues if focus ever leaves the answer box [a tap on the kana itself].
    onKey((e) => { if (waiting && e.key === "Enter" && e.target !== input && !e.target.closest("button")) show(); });
    function finish() {
      doneScreen({
        start, right, wrong, total, list, misses, took, again: () => runQuiz(list, rounds, bestKey), drill: (items) => runQuiz(items, 3, null),
        best: bestKey && { get: () => store.get("quiz.best", {})[bestKey], set: (b) => store.set("quiz.best", { ...store.get("quiz.best", {}), [bestKey]: b }) },
      });
    }
    show();
  }

  // The end of a run, reading or writing [a writing run's best goes to the deck, a reading run's to quiz.best].
  function doneScreen({ start, right, wrong, total, list, misses, took, best, again, drill }) {
    const ms = Date.now() - start;
    const acc = Math.round((right / (right + wrong)) * 100);
    let note = "";
    if (best) {
      const prev = best.get();
      if (!prev || acc > prev.acc || (acc === prev.acc && ms < prev.ms)) {
        best.set({ ms, acc });
        note = prev ? `<span class="badge">New best!</span> previous ${fmtTime(prev.ms)} at ${prev.acc}%` : "First run — now beat it.";
      } else note = `Best: ${fmtTime(prev.ms)} at ${prev.acc}%`;
    }
    const sorted = [...misses].sort((a, b) => b[1] - a[1]);
    const mean = (ms) => ms.reduce((a, b) => a + b, 0) / ms.length;
    // A drill of every kana is just Again [a 4-kana quiz's slowest 75% is 3 of them, so it stays].
    const drills = slowest(new Map([...took].map(([k, ms]) => [k, mean(ms)])), sorted.map(([k]) => k)).filter((d) => d.items.length < list.length);
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
        </div>
        ${drills.length ? `<h2>Drill on time</h2><div class="row" style="justify-content:center">${drills.map((d, i) =>
          `<button class="ghost slow" data-i="${i}">${sorted.length ? "Missed + slowest" : "Slowest"} ${d.share * 100}% <small class="muted">${d.items.length} kana</small></button>`).join("")}</div>` : ""}
        </div>`;
    app.querySelector("#re").addEventListener("click", again);
    app.querySelector("#miss")?.addEventListener("click", () => drill(sorted.map(([k]) => k)));
    app.querySelectorAll(".slow").forEach((b) => b.addEventListener("click", () => drill(drills[b.dataset.i].items)));
  }

  // ---------- Writing ----------
  function viewWrite([sel, rounds, mode]) {
    if (!sel || !kanaOf(sel.split(",")).length) return location.replace("#quiz");
    const key = `${sel}/${roundsOf(rounds)}`;
    runWrite(kanaOf(sel.split(",")), roundsOf(rounds), keepBest(key) ? key : null, mode === "learn" ? "learn" : null);
  }

  // A run of kana written from their romaji [あ: Learn traces its 3 strokes first, Self shows it over your drawing, Per stroke and Whole kana judge it against KanjiVG].
  function runWrite(list, rounds, bestKey, forced) {
    cleanup();
    const { pathPoints, strokeMatches, grade, written } = window.HiraWrite;
    // A stored mode this code doesn't know opens in Self [a value from a later version, or "zz"].
    let check = forced || store.get("write.check", "self");
    if (!["learn", "self", "stroke", "whole"].includes(check)) check = "self";
    const learn = check === "learn";
    // Learn meets the kana in chart order every round [あ column, 2 rounds = あいうえおあいうえお, where Self shuffles].
    const queue = learn ? Array.from({ length: rounds }, () => list).flat() : spaced(list, rounds, Math.random, shareKana);
    const total = queue.length, gap = gapFor(list.length);
    const misses = new Map(), took = new Map();
    let idx = 0, right = 0, wrong = 0, shownAt = 0, all = null, gone = false;
    // The kana on the pad and how far along it is [next 2, tries 1 = two strokes down, one miss on the third].
    let k = null, targets = [], n = 1, drawn = [], next = 0, tries = 0, hinted = false, waiting = false, pts = null;
    // Self after Show, Learn's two passes, and the pause before the next kana [pass "memory", helped = a demo was needed from memory].
    let shown = false, shownFor = 0, pass = "trace", helped = false, pause = false, traced = false;
    const start = Date.now();
    teardown.push(() => { gone = true; });

    app.innerHTML = `
      <div class="row"><a href="#quiz">← Choose kana</a><span class="spacer"></span>
        <span class="seg" id="checkmode"><button data-check="learn">Learn</button><button data-check="self">Self</button><button data-check="stroke">Per stroke</button><button data-check="whole">Whole kana</button></span>
        <span class="progress-line" id="prog"></span></div>
      <div class="stage">
        <div class="write-prompt"><b id="romaji">…</b> <span id="say"></span><div class="muted small" id="script"></div></div>
        <svg class="pad" id="pad"></svg>
        <div class="row" id="acts"></div>
        <div class="feedback" id="fb"></div>
        <div class="stats"><span>✓ <b id="ok">0</b></span><span>✗ <b id="bad">0</b></span><span>⏱ <b id="time">0:00</b></span></div>
      </div>`;
    const pad = app.querySelector("#pad"), fb = app.querySelector("#fb"), acts = app.querySelector("#acts");
    every(500, () => { const t = app.querySelector("#time"); if (t) t.textContent = fmtTime(Date.now() - start); });
    const points = (p) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const line = (p, cls) => `<polyline class="${cls}" points="${points(p)}"/>`;
    // A KanjiVG stroke in its cell, made one path long for the draw-in animation when i is given [pathLength="1" and --i:2].
    const path = (t, cls, i) => `<path class="${cls}" d="${t.d}" transform="translate(${109 * t.j} 0)"${i === undefined ? "" : ` pathLength="1" style="--i:${i}"`}/>`;
    const num = (x, y, i) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" style="--i:${i}">${i + 1}</text>`;
    const layer = (name) => pad.querySelector(`.${name}`);
    // No kana takes input yet or any more [before strokes.json arrives, behind a miss's Continue, in the 400 ms after a right kana or any Learn kana].
    const busy = () => !k || waiting || pause;
    // Which kana a romaji asks for when two share it, by the kana it voices or its length [ぢ: ji, from ち; ヲ: wo, one kana].
    const twinHint = (k) => {
      if (!KANA.some((x) => x.script === k.script && x.romaji === k.romaji && x.kana !== k.kana)) return "";
      const plain = k.kana[0].normalize("NFD")[0];
      return plain !== k.kana[0] ? ` · from ${plain}` : ` · ${[...k.kana].length === 1 ? "one kana" : "two kana"}`;
    };

    const ACTS = {
      learn: `<button class="ghost" id="hint">Show again</button>`,
      self: `<button class="ghost" id="undo">Undo</button><button class="ghost" id="clear">Clear</button><button id="show">Show <span class="kbd">Space</span></button>`,
      shown: `<button class="bad" id="again">Again <span class="kbd">1</span></button><button class="good" id="got">Got it <span class="kbd">2</span></button>`,
      stroke: `<button class="ghost" id="hint">Hint</button>`,
      whole: `<button class="ghost" id="undo">Undo</button><button class="ghost" id="clear">Clear</button><button id="done">Check <span class="kbd">Enter</span></button>`,
    };
    function drawChecks() {
      app.querySelectorAll("#checkmode button").forEach((b) => b.classList.toggle("on", b.dataset.check === check));
      acts.innerHTML = ACTS[shown ? "shown" : check];
      acts.querySelector("#hint")?.addEventListener("click", hint);
      acts.querySelector("#undo")?.addEventListener("click", () => { drawn.pop(); inkDrawn(); });
      acts.querySelector("#clear")?.addEventListener("click", () => { drawn = []; inkDrawn(); });
      acts.querySelector("#done")?.addEventListener("click", checkWhole);
      acts.querySelector("#show")?.addEventListener("click", single(reveal));
      acts.querySelector("#again")?.addEventListener("click", () => kanaDone(false));
      acts.querySelector("#got")?.addEventListener("click", () => kanaDone(true));
    }
    // A new pad for the kana, or the same kana afresh after the check mode changed [きゃ = two 109-unit cells side by side].
    function reset() {
      const chars = [...k.kana];
      n = chars.length;
      targets = chars.flatMap((c, j) => all[c].d.map((d, i) => ({ d, j, label: all[c].n[i], pts: pathPoints(d).map(([x, y]) => [x + 109 * j, y]) })));
      drawn = []; next = 0; tries = 0; hinted = false; waiting = false; pts = null;
      shown = false; shownFor = 0; pass = "trace"; helped = false; traced = false;
      pad.setAttribute("viewBox", `0 0 ${109 * n} 109`);
      pad.setAttribute("class", `pad${n > 1 ? " wide" : ""}`);
      pad.innerHTML = `<g class="guide">${chars.map((_, j) => `<rect x="${109 * j + 1}" y="1" width="107" height="107" rx="6"/>
        <path d="M${109 * j + 54.5} 5V104M${109 * j + 5} 54.5H${109 * j + 104}"/>`).join("")}</g>
        <g class="hint"></g><g class="ink"></g><polyline class="live" points=""/>`;
      fb.innerHTML = learn ? `<p class="muted">Trace each stroke as it's shown.</p>` : "";
      drawChecks();
      if (learn) demo(0);
    }
    function show() {
      // Cleared before Done, as in the reading quiz [a later Enter redrew it].
      waiting = false;
      // No kana once the run is over, so busy() shuts the keys on Done [a 2 there graded the last kana again].
      if (idx >= queue.length) { k = null; return finish(); }
      k = queue[idx];
      app.querySelector("#romaji").textContent = k.romaji;
      app.querySelector("#say").innerHTML = speakBtn(k.kana);
      app.querySelector("#script").textContent = k.script + twinHint(k);
      app.querySelector("#prog").textContent = `${idx + 1} / ${queue.length}`;
      reset();
      shownAt = Date.now();
    }
    const inkDrawn = () => { layer("ink").innerHTML = drawn.map((p) => line(p, "mine")).join(""); };
    // One stroke drawn in for you and left as a faint trail to trace [a miss on it plays it again].
    const demo = (i) => { layer("hint").innerHTML = path(targets[i], "demo", 0); };
    // The next stroke to trace, and the kana then counts as a miss [Per stroke: 3 misses on one stroke show it too; Learn: only from memory].
    function hint() {
      if (busy()) return;
      if (learn) { helped ||= pass === "memory"; return demo(next); }
      if (check !== "stroke") return;
      hinted = true;
      layer("hint").innerHTML = path(targets[next], "");
    }
    function strokeDone(p) {
      if (check === "whole" || check === "self") { drawn.push(p); return inkDrawn(); }
      const t = targets[next];
      if (strokeMatches(p, t.pts)) {
        layer("ink").insertAdjacentHTML("beforeend", path(t, "mine"));
        layer("hint").innerHTML = "";
        next++; tries = 0;
        if (next < targets.length) { if (pass === "trace" && learn) demo(next); return; }
        if (!learn) return kanaDone(!hinted);
        return pass === "trace" ? fromMemory() : kanaDone(!helped);
      }
      layer("ink").insertAdjacentHTML("beforeend", line(p, "bad"));
      const el = layer("ink").lastElementChild;
      after(350, () => el.remove());
      if (learn) return hint();
      if (++tries >= 3) hint();
    }
    // The traced kana wiped after a moment, or at once when the next stroke starts sooner [a quick hand's first stroke still counts].
    function fromMemory() {
      pass = "memory"; next = 0; traced = true;
      fb.innerHTML = `<p class="muted">Now from memory.</p>`;
      after(400, wipe);
    }
    const wipe = () => { if (traced) layer("ink").innerHTML = ""; traced = false; };
    // The answer drawn in over your drawing, and your strokes numbered in your order [え with its bottom stroke first: your 1 sits on its 2].
    function reveal() {
      if (shown || busy() || check !== "self") return;
      shown = true;
      shownFor = Date.now() - shownAt;
      layer("ink").insertAdjacentHTML("beforeend", drawn.map((p, i) => num(p[0][0], p[0][1] - 2, i)).join(""));
      layer("hint").innerHTML = targets.map((t, i) => path(t, "answer", i) + num(t.label[0] + 109 * t.j, t.label[1], i)).join("");
      drawChecks();
    }
    function checkWhole() {
      if (busy() || !drawn.length) return;
      if (written(drawn, targets.map((t) => t.pts))) return kanaDone(true);
      const marks = grade(drawn, targets.map((t) => t.pts));
      layer("ink").innerHTML = drawn.map((p, i) => line(p, marks[i] ? "mine" : "bad")).join("");
      layer("hint").innerHTML = targets.map((t) => path(t, "")).join("");
      kanaDone(false);
    }
    // One kana finished, and only a checker's miss waits for Continue [Learn records and puts back nothing, Self has its answer on screen already].
    function kanaDone(ok) {
      idx++;
      if (!learn) study.write.record(k.kana, ok);
      if (ok) {
        right++;
        if (!learn) took.set(k, [...(took.get(k) || []), shownFor || Date.now() - shownAt]);
        app.querySelector("#ok").textContent = right;
      } else {
        wrong++;
        misses.set(k, (misses.get(k) || 0) + 1);
        app.querySelector("#bad").textContent = wrong;
        if (!learn) requeue(queue, idx - 1, gap, Math.random, shareKana);
      }
      if (check === "self") return show();
      if (ok || learn) {
        if (ok) pad.classList.add("right");
        pause = true;
        return after(400, () => { pause = false; show(); });
      }
      waiting = true;
      fb.innerHTML = `<div class="ans">${esc(k.kana)} ${speakBtn(k.kana)}</div>${strokeBtn(k.kana)}
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
    }

    // Box units from a pointer [the middle of a 300px pad = 54.5].
    const at = (e) => {
      const r = pad.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 109 * n, ((e.clientY - r.top) / r.height) * 109];
    };
    const live = () => pad.querySelector(".live");
    pad.addEventListener("pointerdown", (e) => {
      if (busy() || shown) return;
      e.preventDefault();
      wipe();
      pad.setPointerCapture(e.pointerId);
      pts = [at(e)];
    });
    pad.addEventListener("pointermove", (e) => {
      if (!pts) return;
      pts.push(at(e));
      live().setAttribute("points", points(pts));
    });
    const lift = (keep) => {
      if (!pts) return;
      const p = pts;
      pts = null;
      live().setAttribute("points", "");
      if (keep) strokeDone(p);
    };
    pad.addEventListener("pointerup", () => lift(true));
    pad.addEventListener("pointercancel", () => lift(false));
    // A clicked button keeps no focus, so Space and Enter stay the run's [Space after Undo pressed Undo again, after the speaker played it again].
    [acts, fb, app.querySelector("#checkmode"), app.querySelector(".write-prompt")].forEach((el) => el.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }));
    app.querySelector("#checkmode").addEventListener("click", (e) => {
      const b = e.target.closest("[data-check]");
      if (!b || b.dataset.check === check) return;
      store.set("write.check", b.dataset.check);
      // Learn has its own order and keeps nothing, so a switch into or out of it starts the run over [#write/a/1/learn becomes #write/a/1].
      if (learn || b.dataset.check === "learn") {
        history.replaceState(null, "", location.hash.replace(/\/learn$/, ""));
        return runWrite(list, rounds, bestKey);
      }
      check = b.dataset.check;
      if (busy()) drawChecks(); else reset();
    });
    onKey((e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.closest("button, a")) return;
      if (typing(e)) return;
      if (waiting) { if (e.key === "Enter") { e.preventDefault(); show(); } return; }
      if (busy()) return;
      const keep = check === "whole" || (check === "self" && !shown);
      if (check === "self" && !shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      else if (shown && (e.key === "1" || e.key === "ArrowLeft")) kanaDone(false);
      else if (shown && (e.key === "2" || e.key === "ArrowRight")) kanaDone(true);
      else if (e.key === "Enter" && check === "whole") { e.preventDefault(); checkWhole(); }
      else if (e.key === "Backspace" && keep) { e.preventDefault(); drawn.pop(); inkDrawn(); }
    });
    function finish() {
      study.flush();
      doneScreen({
        start, right, wrong, total, list, misses, took, again: () => runWrite(list, rounds, bestKey, forced), drill: (items) => runWrite(items, 3, null, forced),
        best: bestKey && !learn && { get: () => study.write.best(bestKey), set: (b) => study.write.setBest(bestKey, b) },
      });
    }
    window.HiraStrokes.load().then((data) => { all = data; if (!gone) show(); }, () => {
      if (gone) return;
      fb.innerHTML = `<p class="muted">Can't load the stroke data.</p><button class="ghost" id="retry">Try again</button>`;
      fb.querySelector("#retry").addEventListener("click", () => runWrite(list, rounds, bestKey, forced));
    });
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
        const ok = norm(inp.value) === k.romaji;
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
      app.querySelector("#fin")?.addEventListener("click", single(finish));
      app.querySelector("#skip")?.addEventListener("click", single(() => { round++; drawRound(); scrollTo(0, 0); }));
      app.querySelector("#brk")?.addEventListener("click", single(() => takeBreak(minutes)));
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
      // A skipped break stops its clock, or it later takes over the next break [4:59 left beside Start round 3].
      const go = () => { stop(); document.title = title; round++; drawRound(); };
      teardown.push(() => { document.title = title; });
      app.querySelector("#go").addEventListener("click", single(go));
      const stop = every(250, () => {
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
    // The romaji typed for this sentence and whether it was checked right [kept while Show romaji redraws].
    let typed = "", typedOk = false;
    const done = new Set(store.get("reading.done", []));

    function draw() {
      const text = list[i];
      const kata = sheet === 2;
      const step = readingFrom.match(/^#learn\/(k?)(\d+)$/);
      app.innerHTML = `
        ${readingFrom ? `<p><a id="back" href="${esc(readingFrom)}">← ${step ? `${step[1] ? "Katakana step" : "Step"} ${step[2]}` : "All steps"}</a></p>` : ""}
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
          <div class="typing ${typedOk ? "right" : ""}" id="typing">
            <input class="sentence-input" id="typed" value="${esc(typed)}" autocomplete="off" autocapitalize="off" autocorrect="off"
              spellcheck="false" enterkeyhint="done" aria-label="The sentence in romaji">
            <div class="sentence ${showAll ? "show-all" : ""}" id="sent">${tokens(text).map((t) =>
              [...t].some(isKana) ? `<span class="tok" data-r="${esc(toRomaji(t))}" data-k="${esc(t)}"><span class="tt"></span>${esc(t)}</span>` : esc(t)).join("")}</div>
          </div>
          ${showAll ? `<div class="romaji-line">${esc(toRomaji(text))}</div>` : ""}
          <p class="muted small" id="typed-fb">Tap the sentence and type it in romaji, then Enter. Tap a typed kana to go back to it.</p>
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
      const box = app.querySelector("#typed");
      // A typed kana puts the caret after its letters, an untyped one shows its romaji [tap し in "watash" = caret after "watash"].
      app.querySelector("#typing").addEventListener("click", (e) => {
        const t = e.target.closest(".tok");
        box.focus();
        if (!t) return;
        const toks = [...app.querySelectorAll(".tok")], j = toks.indexOf(t);
        const total = letters(typed).length;
        const start = toks.slice(0, j).reduce((s, x) => s + letters(x.dataset.r).length, 0);
        if (start < total) {
          const end = j === toks.length - 1 ? total : Math.min(total, start + letters(t.dataset.r).length);
          const at = rawAt(end);
          box.setSelectionRange(at, at);
          return spread();
        }
        t.classList.toggle("peek");
        if (clipFor(t.dataset.k)) say(t.dataset.k);
      });
      app.querySelectorAll(".dot").forEach((d) => d.addEventListener("click", () => go(+d.dataset.j)));
      app.querySelector("#prev").addEventListener("click", () => go(i - 1));
      app.querySelector("#next").addEventListener("click", () => go(i + 1));
      app.querySelector("#all").addEventListener("click", toggle);
      app.querySelector("#read").addEventListener("click", markRead);
      box.addEventListener("input", () => {
        typed = box.value; typedOk = false;
        app.querySelector("#typing").classList.remove("right");
        spread();
      });
      // Arrow keys and Home move the caret without an input event [← twice in "watashi" = caret between s and h].
      box.addEventListener("keydown", () => setTimeout(spread));
      box.addEventListener("focus", spread);
      box.setSelectionRange(typed.length, typed.length);
      spread();
      box.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (typedOk) return go(i + 1);
        checkTyped();
      });
    }
    const letters = (r) => r.toLowerCase().replace(/[^a-z]/g, "");
    // Where the n-th typed letter ends in the raw text [n 2 in "wa ta" = 2, n 3 = 4, past the space].
    function rawAt(n) {
      let at = 0;
      for (let seen = 0; at < typed.length && seen < n; at++) if (/[a-z]/i.test(typed[at])) seen++;
      return at;
    }
    // The typed letters over the kana they spell, by each kana's letter count, the caret among them [watashi = wa, ta, shi; letters past the end sit on the last kana].
    function spread() {
      const box = app.querySelector("#typed");
      if (!box) return;
      const toks = [...app.querySelectorAll(".tok")];
      const caret = letters(typed.slice(0, box.selectionStart ?? typed.length)).length;
      let rest = letters(typed), from = 0;
      toks.forEach((t, j) => {
        const n = j === toks.length - 1 ? rest.length : letters(t.dataset.r).length;
        const here = rest.slice(0, n), tt = t.querySelector(".tt");
        // The caret sits on the kana whose letters it ends [caret 2 in "wata" = after wa, not before ta].
        const mine = caret === 0 ? j === 0 : caret > from && caret <= from + here.length;
        tt.textContent = "";
        if (mine) tt.append(here.slice(0, caret - from), Object.assign(document.createElement("i"), { className: "caret" }), here.slice(caret - from));
        else tt.textContent = here;
        rest = rest.slice(n); from += here.length;
      });
    }
    // Typed romaji against the letter-by-letter reading, letters only [いっしゅうかん、 = "isshuukan", the comma and spaces don't count].
    function checkTyped() {
      const want = letters(toRomaji(list[i])), got = letters(typed);
      if (!got) return;
      if (got === want) {
        typedOk = true;
        done.add(`${sheet}-${i}`);
        store.set("reading.done", [...done]);
        draw();
        app.querySelector("#typed").focus();
        return;
      }
      app.querySelector("#typed-fb").textContent = "Not quite: it goes off at the marked kana.";
      // The kana where the typing first goes wrong, the last one when it runs on [さんじ typed as "sanzi" marks じ].
      let at = 0;
      while (at < got.length && got[at] === want[at]) at++;
      let seen = 0;
      const toks = [...app.querySelectorAll(".tok")];
      const tok = toks.find((t) => (seen += letters(t.dataset.r).length) > at) || toks.at(-1);
      app.querySelectorAll(".tok.off").forEach((t) => t.classList.remove("off"));
      tok?.classList.add("off");
    }
    function go(j) {
      if (j < 0 || j >= list.length) return;
      i = j; showAll = false; typed = ""; typedOk = false;
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
    // Reading or writing mastery, each kept apart [か read at box 4, never written = box 0 here].
    const mode = store.get("chart.mode", "read");
    const box = mode === "write" ? (kana) => study.write.of(kana)?.box || 0 : boxOf;
    const cell = (k) => k
      ? `<td class="box-${box(k.kana)}" data-kana="${esc(k.kana)}"><span class="kana">${esc(k.kana)}</span><small>${esc(k.romaji)}</small></td>`
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
    const mastered = (script) => `${KANA.filter((k) => k.script === script && box(k.kana) >= 3).length} of ${KANA.filter((k) => k.script === script).length} known`;
    app.innerHTML = `
      <h1>Kana chart</h1>
      <p class="lead">Every kana, coloured by how well you know it. Click one for its mnemonic.</p>
      <div class="seg" id="chart-mode" style="margin-bottom:1rem"><button data-mode="read" class="${mode === "read" ? "on" : ""}">Reading</button><button data-mode="write" class="${mode === "write" ? "on" : ""}">Writing</button></div>
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
    app.querySelector("#chart-mode").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (!b) return;
      store.set("chart.mode", b.dataset.mode);
      viewChart();
    });
    app.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("Forget all progress, quiz bests, worksheet scores and writing on every device?")) return;
      study.write.reset();
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

  const study = window.HiraStudy;
  const routes = { learn: viewLearn, cards: viewCards, quiz: viewQuiz, write: viewWrite, sheets: viewSheets, reading: viewReading, chart: viewChart, ...study.routes };
  // Runs the teardown of whatever was on screen [a finished quiz's clock stops, a left review uploads].
  function cleanup() {
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
    app.inert = false;
    teardown.forEach((fn) => fn());
    teardown = [];
  }
  // The page shown before this one, and the Learn page that opened the reading [#learn/26 for small tsu's Reading practice].
  let lastPage = "", readingFrom = "";
  function route() {
    cleanup();
    // Each part decoded on its own, a broken escape kept as typed [#kanji/%E5 = the Kanji tab with "%E5", not a URIError].
    const [tab, ...rest] = location.hash.slice(1).split("/").map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    // Only the routes' own names [#__proto__ found Object.prototype and threw].
    const view = Object.hasOwn(routes, tab) ? tab : "learn";
    if (view === "reading" && !lastPage.startsWith("#reading")) readingFrom = lastPage.startsWith("#learn") ? lastPage : "";
    lastPage = view === "learn" ? location.hash || "#learn" : location.hash;
    document.body.dataset.section = view in study.routes ? "japanese" : "kana";
    document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.tab === (view === "write" ? "quiz" : view)));
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
    await Promise.all([sync(), study.flush()]);
    if ((unsynced() || study.unsynced()) && !confirm("Your latest answers haven't reached the server yet. Sign out and lose them?")) return;
    await backend.signOut();
    ["sync.allowed", "sync.savedAt", "sync.resetAt", "sync.pushedAt", "sync.user", ...SYNCED].forEach((k) => localStorage.removeItem("hira." + k));
    study.reset();
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
    const pulledStudy = backend.loadStudy();
    pulledStudy.catch(() => {});
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
    owned = true;
    await Promise.all([sync(pulled), study.start({ app, esc, fmtTime, onKey, say, onLeave: (fn) => teardown.push(fn), cleanup, backend, user, syncState, openModal }, pulledStudy)]);
    route();
  }
  boot();
})();
