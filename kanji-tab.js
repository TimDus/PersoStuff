// The Kanji tab, its deck and a kanji's page, which a word card's note opens as a popup so the review underneath goes on [学 = study, its strokes and the 13 words with it].
(function () {
  const study = window.HiraStudy;
  const { wordsWith, kanjiOf, unlocks, kanjiQueue, mature } = window.HiraKanji;
  const esc = (s) => study.shell().esc(s);
  // Stories are other members' HTML, so every < that doesn't open an em or strong is shown as text [a broken <img onerror= stays text].
  const safe = (html) => html.replace(/<(?!\/?(?:em|strong)>)/g, "&lt;");

  // A kanji's parts with their keywords, each listed kanji a link on its page and plain in a popup [学: ⺍ 冖 子 child; a link would end the review].
  function comps(c, page) {
    const info = study.kanjiInfo() || {}, list = info[c]?.c || [];
    return list.length ? `<div class="kanji-comps small">${list.map((p) => {
      const label = `<span class="jp">${esc(p)}</span>${study.keyword(p) ? ` ${esc(study.keyword(p))}` : ""}`;
      return page && info[p] ? `<a href="#kanji/${esc(p)}">${label}</a>` : `<span>${label}</span>`;
    }).join("")}</div>` : "";
  }
  // The parts Koohii's data decides, drawn from whatever has arrived [before it lands: KANJIDIC's meaning, no frame, no stories].
  function head(c, page) {
    const info = study.kanjiInfo()?.[c] || {}, k = study.koohii(c);
    return `
      <div class="kanji-kw">${esc(study.keyword(c))}</div>
      <div class="muted small kanji-meta">${[info.sc && `${info.sc} strokes`, info.lv >= 4 && `N${info.lv}`, k?.frame && `RTK ${k.frame}`].filter(Boolean).join(" · ")}</div>
      ${k ? `<div class="muted small">Keyword from Remembering the Kanji © James W. Heisig</div>` : ""}
      ${comps(c, page)}`;
  }
  function stories(c) {
    const k = study.koohii(c);
    const list = k ? [...(k.mine ? [{ by: "From the site's Koohii account", text: k.mine }] : []), ...k.stories] : [];
    return list.map((s) => `
      <div class="story"><div class="story-by muted small">${esc(s.by)}</div><div class="story-text">${safe(s.text)}</div></div>`).join("");
  }
  const rows = (c, words, n = Infinity) => wordsWith(c, words, study.cards()).slice(0, n).map((w) => `
    <div class="kw-row${study.met(w.k) ? "" : " unmet"}"><span class="jp">${study.ruby(w)}</span> <span class="small">${esc(w.m)}</span></div>`).join("");
  const body = (c, words, page) => `
    <div class="kanji-big jp">${esc(c)}</div>
    <div class="kanji-head">${head(c, page)}</div>
    ${window.HiraStrokes.button(c)}
    <div class="stories">${stories(c)}</div>
    <div class="kanji-words">${rows(c, words)}</div>`;

  // Asks for Koohii's file if it hasn't arrived, once more if that load fails, and fills in the Koohii parts of an open page or popup [学 opened mid-load: "study, learning" becomes "study", an open stroke order stays].
  async function fillKoohii(c) {
    if (study.koohii(c)) return;
    await study.loadKoohii();
    if (!study.koohii(c)) await study.loadKoohii();
    if (!study.koohii(c)) return;
    document.querySelectorAll(".kanji-pop").forEach((el) => {
      if (el.dataset.c !== c) return;
      el.querySelector(".kanji-head").innerHTML = head(c, "page" in el.dataset);
      el.querySelector(".stories").innerHTML = stories(c);
    });
  }
  async function popup(c) {
    const words = await study.words();
    study.shell().openModal(`<div class="kanji-pop" data-c="${esc(c)}">${body(c, words, false)}</div>`);
    fillKoohii(c);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kanji]");
    if (!b) return;
    // Focus stays on the note's button until the next frame, so a quick space would open a second popup on the first [学 twice, Close shut only the top one].
    b.blur();
    popup(b.dataset.kanji);
  });

  // Paper or Draw, per device [hira.kanji.mode = "draw" puts a pad under the keyword].
  const MODE = "hira.kanji.mode";
  const mode = () => { try { return JSON.parse(localStorage.getItem(MODE)) === "draw" ? "draw" : "paper"; } catch { return "paper"; } };

  // #kanji is the hub, #kanji/review today's cards, #kanji/<kanji> its page.
  async function viewKanji([sub]) {
    const { app } = study.shell();
    const here = location.hash;
    let words;
    app.innerHTML = `<p class="muted">Loading kanji…</p>`;
    try { words = await study.words(); } catch { if (location.hash === here) study.needWords(() => viewKanji([sub])); return; }
    if (location.hash !== here) return;
    study.loadKoohii();
    if (sub === "review") return review(words, here);
    // Only a kanji of the word list has a page, kanji.json or not [#kanji/constructor is the hub].
    if (sub && words.some((w) => kanjiOf(w).includes(sub))) return page(sub, words);
    hub(words);
  }

  function hub(words) {
    const { app } = study.shell();
    const k = study.kanjiDeck();
    const open = unlocks(words, study.cards());
    const q = kanjiQueue({ unlocked: open, cards: k.cards, today: study.today(), newPerDay: k.settings.newPerDay });
    const fresh = q.filter((c) => !k.cards[c]).length;
    const opened = new Set(open.map((o) => o.c));
    const info = study.kanjiInfo() || {};
    const all = [...new Set(words.flatMap(kanjiOf))];
    const state = (c) => (mature(k.cards[c]) ? "learned" : k.cards[c] ? "studying" : opened.has(c) ? "unlocked" : "locked");
    const groups = [["JLPT N5", (lv) => lv === 5], ["JLPT N4", (lv) => lv === 4], ["Beyond N4", (lv) => lv !== 5 && lv !== 4]];
    app.innerHTML = `
      <h1>Kanji</h1>
      <p class="lead">A kanji opens once a word you've met uses it. Its card shows Heisig's keyword: recall the kanji on paper, or draw it
        here, then turn the card and grade yourself.</p>
      <div class="panel">
        <div class="stats" style="margin-bottom:1rem">
          <div><div class="big-number" id="k-due">${q.length - fresh}</div>to review</div>
          <div><div class="big-number" id="k-new">${fresh}</div>new</div>
        </div>
        <p class="muted small" id="k-sum">${opened.size} of ${all.length} unlocked · ${all.filter((c) => state(c) === "learned").length} learned</p>
        <div class="row">
          ${q.length ? `<a class="btn" id="go" href="#kanji/review">Study ${q.length} kanji</a>`
            : `<span class="badge">${opened.size ? "All done for today" : "Meet words in Words to open kanji"}</span>`}
          <span class="spacer"></span>
          <span class="seg">${[["paper", "Paper"], ["draw", "Draw"]].map(([m, label]) => `<button class="${m === mode() ? "on" : ""}" data-mode="${m}" aria-pressed="${m === mode()}">${label}</button>`).join("")}</span>
          <label>New kanji a day <select id="kper">${[5, 10, 20].map((n) => `<option ${n === k.settings.newPerDay ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        </div>
      </div>
      ${(Object.keys(info).length ? groups : [["All kanji", () => true]]).map(([title, ok]) => {
        const cs = all.filter((c) => ok(info[c]?.lv));
        return cs.length ? `<h2>${title}</h2><div class="kgrid">${cs.map((c) => `<a class="jp ${state(c)}" href="#kanji/${esc(c)}" title="${esc(study.keyword(c))}">${esc(c)}</a>`).join("")}</div>` : "";
      }).join("")}`;
    app.querySelector("#kper").addEventListener("change", (e) => { study.setKanjiSettings(+e.target.value); hub(words); });
    app.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { localStorage.setItem(MODE, JSON.stringify(b.dataset.mode)); hub(words); }));
  }

  function page(c, words) {
    study.shell().app.innerHTML = `
      <div class="row"><a href="#kanji">← Kanji</a></div>
      <div class="panel kanji-pop kanji-page" data-c="${esc(c)}" data-page>${body(c, words, true)}</div>`;
    fillKoohii(c);
  }

  // The question is the keyword, or a word with the kanji blanked when there is none [no kanji.json: ＿生 · student].
  function prompt(c, words) {
    if (study.keyword(c)) return study.keyword(c);
    const w = wordsWith(c, words, study.cards())[0];
    return w ? `${w.w.replaceAll(c, "＿")} · ${w.m}` : "?";
  }
  function faces(c, words, draw) {
    const front = `<div class="kanji-prompt">${esc(prompt(c, words))}</div>${draw
      ? `<div class="kpad" data-noflip><svg viewBox="0 0 109 109" aria-label="Drawing pad"></svg><button class="ghost small" type="button" data-clear>Clear</button></div>`
      : `<div class="muted small">Write it on paper, then turn the card</div>`}`;
    const back = `<div class="kanji-big jp">${esc(c)}</div>${draw ? window.HiraStrokes.shown(c) : window.HiraStrokes.button(c)}
      <div class="stories">${stories(c)}</div><div class="kanji-words">${rows(c, words, 5)}</div>`;
    return { front, back };
  }

  async function review(words, here) {
    // The keyword is the question, so Koohii's gets a moment to land before the first card [a hung sign gives up after 3 s and asks KANJIDIC's meaning].
    await Promise.race([study.loadKoohii(), new Promise((r) => setTimeout(r, 3000))]);
    if (location.hash !== here) return;
    const k = study.kanjiDeck();
    const items = kanjiQueue({ unlocked: unlocks(words, study.cards()), cards: k.cards, today: study.today(), newPerDay: k.settings.newPerDay }).map((c) => ({ key: c, c }));
    if (!items.length) {
      history.replaceState(null, "", "#kanji");
      return hub(words);
    }
    const draw = mode() === "draw";
    const again = new Set();
    study.runCards({
      items, title: "Kanji review", back: { href: "#kanji", label: "← Kanji" }, introHint: "New kanji: read it through, it's asked in a moment",
      intro: (it) => !study.kanjiDeck().cards[it.c],
      faces: (it) => faces(it.c, words, draw),
      buttons: (it) => study.gradeButtons(study.kanjiDeck().cards[it.c]),
      answer(it, g) {
        if (g === 1) again.add(it.c);
        return study.gradeKanji(it.c, g).again;
      },
      done() {
        study.flush();
        finish(items.length, again.size);
      },
    });
    study.shell().onLeave(() => { if (study.pending()) study.flush(); });
  }

  function finish(n, again) {
    study.shell().app.innerHTML = `
      <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
        <h1>Done for today!</h1>
        <p class="muted">${n} kanji${again ? ` · ${again} Again` : " · no misses"}. More open as you meet words.</p>
        <div class="row" style="justify-content:center;margin-top:1.2rem">
          <a class="btn" href="#kanji">Kanji</a>
          <a class="btn ghost" href="#words">Words</a>
        </div>
      </div>`;
  }

  // Free strokes on the pad, judged by nobody [Draw mode: draw, turn the card, compare with KanjiVG's].
  let stroke = null;
  const at = (svg, e) => {
    const r = svg.getBoundingClientRect();
    return `${(((e.clientX - r.left) / r.width) * 109).toFixed(1)} ${(((e.clientY - r.top) / r.height) * 109).toFixed(1)}`;
  };
  document.addEventListener("pointerdown", (e) => {
    const svg = e.target.closest(".kpad svg");
    if (!svg) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(p);
    // A tap leaves a dot, as a line to its own start [M 50 50 L 50 50].
    stroke = { id: e.pointerId, p, svg, d: `M ${at(svg, e)} L ${at(svg, e)}` };
    p.setAttribute("d", stroke.d);
  });
  document.addEventListener("pointermove", (e) => {
    if (!stroke || e.pointerId !== stroke.id) return;
    stroke.d += ` L ${at(stroke.svg, e)}`;
    stroke.p.setAttribute("d", stroke.d);
  });
  const end = (e) => { if (stroke?.id === e.pointerId) stroke = null; };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".kpad [data-clear]");
    if (!b) return;
    // Space after Clear turns the card rather than clearing again [a focused button keeps its own key in runCards].
    b.blur();
    b.closest(".kpad").querySelector("svg").replaceChildren();
  });

  study.routes.kanji = viewKanji;
})();
