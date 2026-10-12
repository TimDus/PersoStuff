// The Japanese section: JLPT vocabulary on Anki-style reviews, both directions, synced to its own column [progress.study, beside the kana in progress.data].
(function () {
  const { dayOf, grade, preview, queue, mergeStudy } = window.HiraSRS;
  const { same, bump } = window.HiraSync;
  let shell = null;
  let words = null;
  let loading = null;
  // Fetched on the first visit and kept [data/vocab.json, 1,385 words, 369 KB].
  const loadWords = () => (loading ||= fetch("data/vocab.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((list) => (words = list))
    .catch((e) => { loading = null; throw e; }));

  // The deck on this device [cards keyed "会う|あう#r" for Japanese → English, "#p" the other way].
  const KEY = "hira.study";
  const blank = () => ({ cards: {}, settings: { newPerDay: 20, at: 0 }, savedAt: 0 });
  const local = () => {
    try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); }
  };
  let deck = local();
  const today = () => dayOf(Date.now());
  // Always past the last stamp, so an answer after syncing with a fast-clock device still counts as unsent [that push 13:00, this answer 12:10].
  function save() {
    deck.savedAt = Math.max(Date.now(), (deck.savedAt || 0) + 1);
    localStorage.setItem(KEY, JSON.stringify(deck));
    scheduleSync();
  }

  // Pull, merge, push, chained so two syncs never interleave; the merge reads the deck after the pull [an answer meanwhile is kept].
  let chain = Promise.resolve(), timer = null;
  const pushedAt = () => +localStorage.getItem(KEY + ".pushedAt") || 0;
  function sync(pulled) {
    clearTimeout(timer);
    timer = null;
    chain = chain.then(async () => {
      if (!shell?.user) return;
      try {
        const remote = await (pulled || shell.backend.loadStudy());
        const merged = mergeStudy(local(), remote);
        deck = merged;
        localStorage.setItem(KEY, JSON.stringify(merged));
        if (!same(merged, remote)) await shell.backend.saveStudy(shell.user.id, merged);
        localStorage.setItem(KEY + ".pushedAt", merged.savedAt);
        shell.syncState("study", true);
      } catch {
        shell.syncState("study", false);
      }
    });
    return chain;
  }
  // A quiet spell before uploading, as the whole deck goes up each time [a 1,385-word deck is 328 KB; per answer, 200 cards were 65.6 MB].
  function scheduleSync() {
    if (!shell?.user) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 20000);
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) sync(); });
  addEventListener("online", () => { if (shell?.user) sync(); });

  const esc = (s) => shell.esc(s);
  const ruby = (w) => w.fu.map(([text, rt]) => (rt ? `<ruby>${esc(text)}<rt>${esc(rt)}</rt></ruby>` : esc(text))).join("");
  const speak = (text) => `<button class="speak" data-say="${esc(text)}" title="Listen">🔊</button>`;
  const examples = (w) => (w.ex.length ? `<div class="examples">${w.ex.map(([jp, en]) => `
    <div class="ex"><span class="jp">${esc(jp)}</span> ${speak(jp)}<div class="muted small">${esc(en)}</div></div>`).join("")}</div>` : "");
  const days = (n) => (n === 0 ? "now" : n < 30 ? `${n}d` : n < 365 ? `${Math.round(n / 30)}mo` : `${Math.round(n / 365)}y`);

  function needWords(retry) {
    shell.app.innerHTML = `
      <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
        <h1>Can't load the words</h1>
        <p class="muted">The word list comes with the site and needs a connection the first time.</p>
        <button id="retry">Try again</button>
      </div>`;
    shell.app.querySelector("#retry").addEventListener("click", retry);
  }

  // #words is the hub, #words/review today's session, #words/practice/<set> a round that doesn't count.
  async function viewWords([mode, set]) {
    if (!words) {
      shell.app.innerHTML = `<p class="muted">Loading words…</p>`;
      const here = location.hash;
      let failed = false;
      try { await loadWords(); } catch { failed = true; }
      // Gone to another page while it loaded [Words, then Chart before vocab.json landed].
      if (location.hash !== here) return;
      if (failed) return needWords(() => viewWords([mode, set]));
    }
    deck = local();
    if (mode === "review") return runReview();
    if (mode === "practice") return runPractice(set);
    hub();
  }

  // Cards answered today [last === today], and the ones among them that got an Again [miss === today].
  const answeredToday = (missedOnly) => Object.entries(deck.cards)
    .filter(([, c]) => c.last === today() && (!missedOnly || c.miss === today())).map(([key]) => key);
  // Cards met at a level, both sides [秋 read and recalled = 2 N5 cards].
  const levelKeys = (lv) => { const all = byKey(); return Object.keys(deck.cards).filter((k) => all.get(k)?.word.lv === lv); };
  const byKey = () => new Map(words.flatMap((w) => [[`${w.k}#r`, { key: `${w.k}#r`, word: w, dir: "r" }], [`${w.k}#p`, { key: `${w.k}#p`, word: w, dir: "p" }]]));

  function hub() {
    const q = queue({ words, cards: deck.cards, today: today(), newPerDay: deck.settings.newPerDay });
    const isNew = (it) => !deck.cards[it.key];
    const fresh = q.filter(isNew).length;
    const seen = (lv) => words.filter((w) => w.lv === lv && deck.cards[`${w.k}#r`]).length;
    const levelCards = (lv) => levelKeys(lv).length;
    // A word counts as known once both its sides are on three-week intervals [Anki calls 21 days mature].
    const known = (lv) => words.filter((w) => w.lv === lv && ["r", "p"].every((d) => deck.cards[`${w.k}#${d}`]?.ivl >= 21)).length;
    const total = (lv) => words.filter((w) => w.lv === lv).length;
    const today_ = answeredToday(false).length, missed = answeredToday(true).length;
    shell.app.innerHTML = `
      <h1>Words</h1>
      <p class="lead">The JLPT N5 words, then N4, most common first. Each word is a card both ways: read the Japanese, then
        recall it from English the next day. Answer honestly; the buttons set when it comes back.</p>
      <div class="panel">
        <div class="stats" style="margin-bottom:1rem">
          <div><div class="big-number" id="due">${q.length - fresh}</div>to review</div>
          <div><div class="big-number" id="new">${fresh}</div>new</div>
        </div>
        <div class="row">
          ${q.length ? `<a class="btn" id="go" href="#words/review">Study ${q.length} card${q.length > 1 ? "s" : ""}</a>`
            : `<span class="badge">All done for today</span>`}
          <span class="spacer"></span>
          <label>New words a day <select id="per">${[5, 10, 20, 30].map((n) => `<option ${n === deck.settings.newPerDay ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        </div>
      </div>
      <h2>Practice</h2>
      <p class="muted small">Plain flashcards that don't change when anything is due, so go again as often as you like.</p>
      <div class="row">
        <a class="btn ghost ${today_ ? "" : "disabled"}" href="#words/practice/today">Today's cards (${today_})</a>
        <a class="btn ghost ${missed ? "" : "disabled"}" href="#words/practice/missed">Today's misses (${missed})</a>
        <a class="btn ghost ${levelCards(5) ? "" : "disabled"}" href="#words/practice/n5">N5 cards so far (${levelCards(5)})</a>
        <a class="btn ghost ${levelCards(4) ? "" : "disabled"}" href="#words/practice/n4">N4 cards so far (${levelCards(4)})</a>
      </div>
      <h2>Levels</h2>
      <div class="grid">${[5, 4].map((lv) => `
        <div class="panel"><div class="title">JLPT N${lv}</div>
          <div class="muted small">${seen(lv)} of ${total(lv)} met · ${known(lv)} known</div>
          <div class="bar"><span style="width:${Math.round((seen(lv) / total(lv)) * 100)}%"></span></div></div>`).join("")}
      </div>`;
    shell.app.querySelector("#per").addEventListener("change", (e) => {
      deck = local();
      deck.settings = { newPerDay: +e.target.value, at: Math.max(Date.now(), (deck.settings.at || 0) + 1) };
      save();
      hub();
    });
  }

  // One card's two faces [r: 会う with あ over 会 → meaning; p: "to meet · godan verb" → 会う].
  function faces(it) {
    const w = it.word;
    const word = `<div class="word jp">${ruby(w)}</div>`;
    const meaning = `<div class="meaning">${esc(w.m)}</div><div class="muted small">${esc(w.t || "word")} · N${w.lv}</div>`;
    const back = `${speak(w.r)} ${it.dir === "r" ? meaning : word}${examples(w)}`;
    return { front: it.dir === "r" ? word : meaning, back: it.dir === "r" ? back : `${back}<div class="muted small">${esc(w.m)}</div>` };
  }

  // A run of cards: flip, then answer; `buttons` are [label, key, value] and `answer` says whether the card comes back this run.
  function runCards({ items, title, buttons, answer, done }) {
    shell.cleanup();
    const run = [...items];
    let flipped = false;
    function draw() {
      if (!run.length) return done();
      const it = run[0];
      flipped = false;
      const { front, back } = faces(it);
      shell.app.innerHTML = `
        <div class="row"><a href="#words">← Words</a><span class="spacer"></span>
          <span class="muted small">${esc(title)}</span>
          <span class="progress-line" id="left">${run.length} left</span></div>
        <div class="stage vocab ${it.dir === "p" ? "produce" : ""}">
          <div class="vcard" id="card"><div class="face front">${front}
            <div class="hint"><span class="key-only">click or <span class="kbd">space</span></span><span class="touch-only">tap</span> to show the answer</div></div>
            <div class="face back" hidden>${back}</div></div>
          <div class="row grades">${buttons(it).map(([label, key, value, sub]) => `
            <button class="${value === 1 ? "bad" : value >= 3 ? "good" : "ghost"}" data-g="${value}" disabled>${label}${sub ? ` <small>${sub}</small>` : ""} <span class="kbd">${key}</span></button>`).join("")}</div>
        </div>`;
      shell.app.querySelector("#card").addEventListener("click", (e) => { if (!e.target.closest("[data-say]")) flip(); });
      shell.app.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => pick(+b.dataset.g)));
    }
    function flip() {
      if (flipped) return;
      flipped = true;
      shell.app.querySelector(".face.back").hidden = false;
      shell.app.querySelector(".hint").hidden = true;
      shell.app.querySelectorAll("[data-g]").forEach((b) => { b.disabled = false; });
    }
    function pick(g) {
      const it = run.shift();
      // Back a few cards later, or last when fewer are left [3 cards on = the 4th card shown].
      if (answer(it, g)) run.splice(Math.min(3, run.length), 0, it);
      draw();
    }
    shell.onKey((e) => {
      if (e.target.matches("input, textarea, select") || !run.length) return;
      if (e.key === " " || e.key === "Enter") {
        // A focused button or link takes its own key [Enter on a focused Easy grades Easy, not flips].
        if (e.target.closest("button, a")) return;
        e.preventDefault();
        flip();
        return;
      }
      const b = flipped && /^[1-4]$/.test(e.key) && shell.app.querySelector(`.grades button:nth-child(${e.key})`);
      if (b) b.click();
    });
    draw();
  }

  function runReview() {
    const items = queue({ words, cards: deck.cards, today: today(), newPerDay: deck.settings.newPerDay });
    if (!items.length) return hub();
    const again = new Set();
    runCards({
      items, title: "Review",
      buttons: (it) => {
        const [a, h, g, e] = preview(deck.cards[it.key], today()).map(days);
        return [["Again", 1, 1, a], ["Hard", 2, 2, h], ["Good", 3, 3, g], ["Easy", 4, 4, e]];
      },
      answer(it, g) {
        // The day of the answer, not of the session [started 03:58, answered 04:03 = the new day].
        const day = today();
        deck = local();
        const r = grade(deck.cards[it.key], g, day);
        deck.cards[it.key] = g === 1 ? { ...r.card, miss: day } : r.card;
        save();
        if (g === 1) again.add(it.key);
        return r.again;
      },
      done() {
        sync();
        finish(items.length, again.size);
      },
    });
    // Leaving part-way sends what was answered, after runCards has cleared the last page's hooks [stop after 30 cards and go to the kana].
    shell.onLeave(() => { if (timer) sync(); });
  }

  function finish(n, again) {
    shell.app.innerHTML = `
      <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
        <h1>Done for today!</h1>
        <p class="muted">${n} card${n > 1 ? "s" : ""}${again ? ` · ${again} Again` : " · no misses"}. Come back tomorrow for the next ones.</p>
        <div class="row" style="justify-content:center;margin-top:1.2rem">
          <a class="btn" href="#words/practice/today">Practice today's cards</a>
          ${again ? `<a class="btn ghost" href="#words/practice/missed">Only the misses</a>` : ""}
          <a class="btn ghost" href="#words">Words</a>
        </div>
        <p class="muted small">Practice doesn't change when anything is due.</p>
      </div>`;
  }

  function runPractice(set) {
    const all = byKey();
    const keys = set === "today" ? answeredToday(false) : set === "missed" ? answeredToday(true)
      : levelKeys(set === "n4" ? 4 : 5);
    const items = keys.map((k) => all.get(k)).filter(Boolean).sort(() => Math.random() - 0.5);
    if (!items.length) return hub();
    const title = { today: "Practice: today's cards", missed: "Practice: today's misses", n5: "Practice: N5", n4: "Practice: N4" }[set] || "Practice";
    const missed = new Set();
    runCards({
      items, title,
      buttons: () => [["Again", 1, 1], ["Got it", 2, 3]],
      answer(it, g) {
        if (g === 1) missed.add(it.key);
        return g === 1;
      },
      done() {
        shell.app.innerHTML = `
          <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
            <h1>Practice done</h1>
            <p class="muted">${items.length} card${items.length > 1 ? "s" : ""} · ${missed.size ? `${missed.size} needed another look` : "no misses"}</p>
            <div class="row" style="justify-content:center"><a class="btn" href="#words/practice/${esc(set)}" id="again">Again</a><a class="btn ghost" href="#words">Words</a></div>
          </div>`;
        // The link points at this page's own hash, which wouldn't fire a route [#words/practice/today again].
        shell.app.querySelector("#again").addEventListener("click", (e) => { e.preventDefault(); runPractice(set); });
      },
    });
  }

  window.HiraStudy = {
    routes: { words: viewWords },
    // Once the account is let in: a deck owned by someone else, or by nobody, is dropped first [a tab from before the deck signed out without clearing it].
    start(s, pulled) {
      shell = s;
      const owner = JSON.stringify(s.user.id);
      if (localStorage.getItem(KEY + ".user") !== owner) this.reset();
      localStorage.setItem(KEY + ".user", owner);
      deck = local();
      return sync(pulled);
    },
    reset() {
      [KEY, KEY + ".pushedAt", KEY + ".user"].forEach((k) => localStorage.removeItem(k));
      deck = blank();
    },
    flush: () => sync(),
    // Writing progress and bests, kept in the deck so they sync with it [write.kana["か"] = { box: 3, right: 4, wrong: 1 }].
    write: {
      of: (kana) => deck.write?.kana?.[kana],
      best: (key) => deck.write?.best?.[key],
      record(kana, ok) {
        const w = (deck.write ||= { kana: {}, best: {}, resetAt: 0 });
        bump(w.kana[kana] ||= { box: 0, right: 0, wrong: 0 }, ok);
        save();
      },
      setBest(key, best) {
        (deck.write ||= { kana: {}, best: {}, resetAt: 0 }).best[key] = best;
        save();
      },
      // Newer than any writing reset this device has seen, whatever its clock says [last reset 1000, clock reads 900 = 1001].
      reset() {
        deck.write = { kana: {}, best: {}, resetAt: Math.max(Date.now(), (deck.write?.resetAt || 0) + 1) };
        save();
        return sync();
      },
    },
    unsynced: () => local().savedAt > pushedAt(),
  };
})();
