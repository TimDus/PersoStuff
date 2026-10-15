// The Kanji tab, its deck and a kanji's page, which a word card's note opens as a popup so the review underneath goes on [学 = study, its strokes and the 13 words with it].
(function () {
  const study = window.HiraStudy;
  const { wordsWith, kanjiOf, order, forms, kanjiQueue, mature, byReading, family } = window.HiraKanji;
  const { NAMES, NOTES } = window.HiraRadicals;
  const esc = (s) => study.shell().esc(s);
  // Stories are other members' HTML, so every < that doesn't open an em or strong is shown as text [a broken <img onerror= stays text].
  const safe = (html) => html.replace(/<(?!\/?(?:em|strong)>)/g, "&lt;");

  // A deck kanji as a link on its page and plain in a popup, where a link would end the review [水 water: a link to #kanji/水, text over a card].
  const link = (c, page, label) => (page ? `<a href="#kanji/${esc(c)}">${label}</a>` : `<span>${label}</span>`);
  const listed = (cs, page) => cs.map((d) => link(d, page, `<span class="jp">${esc(d)}</span>`)).join(" ");
  // A kanji's parts by name: a deck kanji by its keyword, a radical form by its full kanji, a shape by its name [学: ⺍ three strokes, 冖 crown, cover, 子 child; 海: 氵 the 水 radical, water].
  function comps(c, page) {
    const info = study.kanjiInfo() || {}, list = info[c]?.c || [];
    return list.length ? `<div class="kanji-comps small">${list.map((p) => {
      const full = info[c].v?.[p];
      if (full && info[full]) return `<span><span class="jp">${esc(p)}</span> the ${link(full, page, `<span class="jp">${esc(full)}</span>`)} radical, ${esc(study.keyword(full))}</span>`;
      const name = info[p] ? study.keyword(p) : NAMES[p];
      const label = `<span class="jp">${esc(p)}</span>${name ? ` ${esc(name)}` : ""}`;
      return info[p] ? link(p, page, label) : `<span>${label}</span>`;
    }).join("")}</div>` : "";
  }
  // The parts, why a misleading one is there, and the kanji's radical forms with the first 8 kanji using them in study order [水: 氵 in 泳 活 消 泊…, 海 further on].
  function parts(c, page) {
    const info = study.kanjiInfo() || {}, fs = forms(c, info);
    const at = fs.length ? new Map(order(info, study.frames()).map((d, i) => [d, i])) : null;
    return `${comps(c, page)}${NOTES[c] ? `<div class="kanji-why small">${esc(NOTES[c])}</div>` : ""}${fs.map(({ f, cs }) => {
      const first = [...cs].sort((a, b) => at.get(a) - at.get(b));
      return `<div class="kanji-forms small">As a radical it's written <span class="jp">${esc(f)}</span>: ${listed(first.slice(0, 8), page)}${cs.length > 8 ? " …" : ""}</div>`;
    }).join("")}`;
  }
  // The list's kanji sharing its sound part and an on'yomi, each a link on its page and plain in a popup [晴: Same sound セイ: 青 静].
  const fam = (c, page) => family(c, study.kanjiInfo() || {}).map(({ r, cs }) => `<div class="kanji-family small">Same sound <span class="jp">${r.map(esc).join(" · ")}</span>: ${listed(cs, page)}</div>`).join("");
  // The parts Koohii's data decides, drawn from whatever has arrived [before it lands: KANJIDIC's meaning, no frame, no stories].
  function head(c, page) {
    const info = study.kanjiInfo()?.[c] || {}, k = study.koohii(c);
    return `
      <div class="kanji-kw">${esc(study.keyword(c))}</div>
      <div class="muted small kanji-meta">${[info.sc && `${info.sc} strokes`, info.lv >= 4 && `N${info.lv}`, k?.frame && `RTK ${k.frame}`].filter(Boolean).join(" · ")}</div>
      ${k ? `<div class="muted small">Keyword from Remembering the Kanji © James W. Heisig</div>` : ""}
      ${parts(c, page)}`;
  }
  function stories(c) {
    const k = study.koohii(c);
    const list = k ? [...(k.mine ? [{ by: "From the site's Koohii account", text: k.mine }] : []), ...k.stories] : [];
    return list.map((s) => `
      <div class="story"><div class="story-by muted small">${esc(s.by)}</div><div class="story-text">${safe(s.text)}</div></div>`).join("");
  }
  // A row per reading a met word uses with those words, the rest on one line, none from a kanji.json cached before readings [学: ガク 大学 · 学校, then まな.ぶ].
  const big = (c, words) => {
    const { used, rest } = byReading(c, words, study.cards(), study.kanjiInfo() || {});
    const rows = used.map(({ r, words: ws }) => `<div class="kr-row"><span class="kr">${esc(r)}</span><span class="kr-words">${ws.map((w) => esc(w.w)).join(" · ")}</span></div>`).join("");
    const line = rest.length ? `<div class="kr-rest">${rest.map((r) => `<span>${esc(r)}</span>`).join(" · ")}</div>` : "";
    return `${rows || line ? `<div class="kanji-reading jp">${rows}${line}</div>` : ""}<div class="kanji-big jp">${esc(c)}</div>`;
  };
  const rows = (c, words, n = Infinity) => wordsWith(c, words, study.cards()).slice(0, n).map((w) => `
    <div class="kw-row${study.met(w.k) ? "" : " unmet"}"><span class="jp">${study.ruby(w)}</span> <span class="small">${esc(w.m)}</span></div>`).join("");
  const body = (c, words, page) => `
    ${big(c, words)}
    <div class="kanji-head">${head(c, page)}</div>
    ${fam(c, page)}
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
    // Only a deck kanji has a page, kanji.json or not [#kanji/未 opens, #kanji/constructor is the hub].
    if (sub && sub !== "review" && (Object.hasOwn(study.kanjiInfo() || {}, sub) || words.some((w) => kanjiOf(w).includes(sub)))) {
      study.loadKoohii();
      return page(sub, words);
    }
    // Heisig's order and his keywords both come in Koohii's file, so it gets a moment to land [a hung sign gives up after 3 s: stroke count and KANJIDIC's meanings].
    await Promise.race([study.loadKoohii(), new Promise((r) => setTimeout(r, 3000))]);
    if (location.hash !== here) return;
    if (sub === "review") return review(words);
    hub(words);
  }

  // Every deck kanji in study order, the word list's alone in list order without kanji.json [秋 足 後 言… when it failed].
  const sequence = (words) => {
    const info = study.kanjiInfo() || {};
    return Object.keys(info).length ? order(info, study.frames()) : [...new Set(words.flatMap(kanjiOf))];
  };

  function hub(words) {
    const { app } = study.shell();
    const k = study.kanjiDeck();
    const all = sequence(words);
    const q = kanjiQueue({ order: all, cards: k.cards, today: study.today(), newPerDay: k.settings.newPerDay });
    const next = new Set(q.filter((c) => !k.cards[c]));
    const info = study.kanjiInfo() || {};
    const used = new Set(words.flatMap(kanjiOf));
    const state = (c) => (mature(k.cards[c]) ? "learned" : k.cards[c] ? "studying" : next.has(c) ? "next" : "later");
    const groups = [["JLPT N5", (c) => used.has(c) && info[c]?.lv === 5], ["JLPT N4", (c) => used.has(c) && info[c]?.lv === 4],
      ["Beyond N4", (c) => used.has(c) && info[c]?.lv !== 5 && info[c]?.lv !== 4], ["Only as parts", (c) => !used.has(c)]];
    app.innerHTML = `
      <h1>Kanji</h1>
      <p class="lead">Kanji come in Heisig's order, each one's parts before it, and a word opens in Words once you've started
        all its kanji. A card shows Heisig's keyword: recall the kanji on paper, or draw it here, then turn the card and grade yourself.</p>
      <div class="panel">
        <div class="stats" style="margin-bottom:1rem">
          <div><div class="big-number" id="k-due">${q.length - next.size}</div>to review</div>
          <div><div class="big-number" id="k-new">${next.size}</div>new</div>
        </div>
        <p class="muted small" id="k-sum">${all.filter((c) => k.cards[c]).length} of ${all.length} started · ${all.filter((c) => state(c) === "learned").length} learned</p>
        <div class="row">
          ${q.length ? `<a class="btn" id="go" href="#kanji/review">Study ${q.length} kanji</a>`
            : `<span class="badge">All done for today</span>`}
          <span class="spacer"></span>
          <span class="seg">${[["paper", "Paper"], ["draw", "Draw"]].map(([m, label]) => `<button class="${m === mode() ? "on" : ""}" data-mode="${m}" aria-pressed="${m === mode()}">${label}</button>`).join("")}</span>
          <label>New kanji a day <select id="kper">${[5, 10, 20].map((n) => `<option ${n === k.settings.newPerDay ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        </div>
      </div>
      ${(Object.keys(info).length ? groups : [["All kanji", () => true]]).map(([title, ok]) => {
        const cs = all.filter(ok);
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
    const back = `${big(c, words)}${parts(c, false)}${draw ? window.HiraStrokes.shown(c) : window.HiraStrokes.button(c)}
      <div class="stories">${stories(c)}</div><div class="kanji-words">${rows(c, words, 5)}</div>`;
    return { front, back };
  }

  function review(words) {
    const k = study.kanjiDeck();
    const items = kanjiQueue({ order: sequence(words), cards: k.cards, today: study.today(), newPerDay: k.settings.newPerDay }).map((c) => ({ key: c, c }));
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
        <p class="muted">${n} kanji${again ? ` · ${again} Again` : " · no misses"}. Words that use them open in Words.</p>
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
