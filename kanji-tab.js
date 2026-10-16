// The Kanji tab, its deck and a kanji's page, which a word card's note opens as a popup so the review underneath goes on [学 = study, its strokes and the 13 words with it].
(function () {
  const study = window.HiraStudy;
  const { wordsWith, kanjiOf, order, forms, kanjiQueue, mature, partsOf, byReading, metReadings, family } = window.HiraKanji;
  const { NAMES } = window.HiraRadicals;
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
  // The parts, the kanji's history note, and its radical forms with the first 8 kanji using them in study order [水: 氵 in 泳 活 消 泊…, 海 further on].
  function parts(c, page) {
    const info = study.kanjiInfo() || {}, fs = forms(c, info), why = study.history(c)?.note;
    const at = fs.length ? new Map(order(info, study.frames()).map((d, i) => [d, i])) : null;
    return `${comps(c, page)}${why ? `<div class="kanji-why small">${esc(why)}</div>` : ""}${fs.map(({ f, cs }) => {
      const first = [...cs].sort((a, b) => at.get(a) - at.get(b));
      return `<div class="kanji-forms small">As a radical it's written <span class="jp">${esc(f)}</span>: ${listed(first.slice(0, 8), page)}${cs.length > 8 ? " …" : ""}</div>`;
    }).join("")}`;
  }
  // The list's kanji sharing its sound part and an on'yomi, each a link on its page and plain in a popup [晴: Same sound セイ: 青 静].
  const fam = (c, page) => family(c, study.kanjiInfo() || {}).map(({ r, cs }) => `<div class="kanji-family small">Same sound <span class="jp">${r.map(esc).join(" · ")}</span>: ${listed(cs, page)}</div>`).join("");
  // The parts Koohii's data decides, drawn from whatever has arrived [before it lands: a plain keyword or KANJIDIC's meaning, no frame, no stories].
  function head(c, page) {
    const info = study.kanjiInfo()?.[c] || {}, k = study.koohii(c);
    return `
      <div class="kanji-kw">${esc(study.keyword(c))}</div>
      <div class="muted small kanji-meta">${[info.sc && `${info.sc} strokes`, info.lv >= 4 && `N${info.lv}`, k?.frame && `RTK ${k.frame}`].filter(Boolean).join(" · ")}</div>
      ${k && study.keyword(c) === k.kw ? `<div class="muted small">Keyword from Remembering the Kanji © James W. Heisig</div>` : ""}
      ${parts(c, page)}`;
  }
  function stories(c) {
    const k = study.koohii(c);
    const list = k ? [...(k.mine ? [{ by: "From the site's Koohii account", text: k.mine }] : []), ...k.stories] : [];
    // Heisig's keywords the stories use where the page shows a plain one, the kanji's or a part's, matched at a word's start through tags [封's <em>measure</em>ments = 寸; 重's primidi.com isn't 里 ri].
    const said = list.map((x) => x.text).join(" ").replace(/<[^>]*>/g, "").toLowerCase();
    const uses = (kw) => { for (let i = said.indexOf(kw); i >= 0; i = said.indexOf(kw, i + 1)) if (!/[a-z]/.test(said[i - 1] || "")) return true; return false; };
    const swapped = [c, ...partsOf(c, study.kanjiInfo() || {})].filter((d) => { const kw = study.koohii(d)?.kw; return kw && study.keyword(d) !== kw && uses(kw.toLowerCase()); });
    const his = swapped.length ? `<div class="muted small">Heisig's keyword${swapped.length > 1 ? "s" : ""} in these stories: ${swapped.map((d) => `${esc(d)} ${esc(study.koohii(d).kw)}`).join(", ")} · Remembering the Kanji © James W. Heisig</div>` : "";
    return his + list.map((s) => `
      <div class="story"><div class="story-by muted small">${esc(s.by)}</div><div class="story-text">${safe(s.text)}</div></div>`).join("");
  }
  const ws = (x) => `<span class="kr-words">${x.words.map(({ w, met }) => `<span${met ? "" : ` class="unmet"`}>${esc(w.w)}</span>`).join(" · ")}</span>`;
  const readingRows = (rs) => rs.map((x) => `<div class="kr-row"><span class="kr">${esc(x.r)}</span>${ws(x)}</div>`).join("");
  // The main reading large over the kanji, the others in rows under it, all off on a kanji.json cached without them [四: シ 四 over 四, then よっ.つ, よん, よ].
  const big = (c, { top, rest }) => {
    const main = top ? `<div class="kanji-top jp"><div class="kr-main">${esc(top.r)}</div>${ws(top)}</div>` : "";
    const rows = readingRows(rest);
    return `${main}<div class="kanji-big jp">${esc(c)}</div>${rows ? `<div class="kanji-reading jp">${rows}</div>` : ""}`;
  };
  const readings = (c, words) => byReading(c, words, study.cards(), study.kanjiInfo() || {});
  // A review's back: the met readings, then every reading in a shut fold when that shows more [学 with 大学 met: ガク 大学, the fold adds 学校 学生 and まな.ぶ].
  const metBig = (c, words) => {
    const all = readings(c, words), met = metReadings(c, words, study.cards(), study.kanjiInfo() || {});
    const size = ({ top, rest }) => [top, ...rest].filter(Boolean).reduce((n, x) => n + 1 + x.words.length, 0);
    const every = [all.top, ...all.rest].filter(Boolean);
    return `${big(c, met)}${size(all) > size(met) ? `<details class="kr-all small"><summary>All readings</summary><div class="kanji-reading jp">${readingRows(every)}</div></details>` : ""}`;
  };
  const rows = (c, words, n = Infinity) => wordsWith(c, words, study.cards()).slice(0, n).map((w) => `
    <div class="kw-row${study.met(w.k) ? "" : " unmet"}"><span class="jp">${study.ruby(w)}</span> <span class="small">${esc(w.m)}</span></div>`).join("");
  // The story behind a shut fold, in a slot fillHistory fills and Koohii's fill-in never redraws [魚 has a note and no story, so no fold].
  const story = (c) => {
    const h = study.history(c)?.history;
    return h ? `<details class="kanji-story small"><summary>History</summary><p>${esc(h)}</p></details>` : "";
  };
  const body = (c, words, page) => `
    ${big(c, readings(c, words))}
    <div class="kanji-head">${head(c, page)}</div>
    <div class="kanji-hist">${story(c)}</div>
    ${fam(c, page)}
    ${window.HiraStrokes.button(c)}
    <div class="stories">${stories(c)}</div>
    <div class="kanji-words">${rows(c, words)}</div>`;

  // Redraws the head of every open page or popup of c and one slot below it, from whatever has landed [an open stroke order or History fold outside the slot stays].
  const redraw = (c, slot, html) => document.querySelectorAll(".kanji-pop").forEach((el) => {
    if (el.dataset.c !== c) return;
    el.querySelector(".kanji-head").innerHTML = head(c, "page" in el.dataset);
    el.querySelector(slot).innerHTML = html;
  });
  // Asks for Koohii's file if it hasn't arrived, once more if that load fails, and fills in the Koohii parts of an open page or popup [学 opened mid-load: "study, learning" becomes "study", an open stroke order stays].
  async function fillKoohii(c) {
    if (study.koohii(c)) return;
    await study.loadKoohii();
    if (!study.koohii(c)) await study.loadKoohii();
    if (study.koohii(c)) redraw(c, ".stories", stories(c));
  }
  // Fills the history note and story into a popup opened before history.json landed, which it never waits for [3 pressed at once graded the card under it].
  async function fillHistory(c) {
    if (study.history(c)) return;
    await study.loadHistory();
    if (study.history(c)) redraw(c, ".kanji-hist", story(c));
  }
  async function popup(c) {
    const words = await study.words();
    study.shell().openModal(`<div class="kanji-pop" data-c="${esc(c)}">${body(c, words, false)}</div>`);
    fillKoohii(c);
    fillHistory(c);
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
    try { [words] = await Promise.all([study.words(), study.loadHistory()]); } catch { if (location.hash === here) study.needWords(() => viewKanji([sub])); return; }
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
        all its kanji. A card shows Heisig's keyword, or a plainer one where his misleads: recall the kanji on paper, or draw it here, then turn the card and grade yourself.</p>
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
    const back = `${metBig(c, words)}${parts(c, false)}${draw ? window.HiraStrokes.shown(c) : window.HiraStrokes.button(c)}
      <div class="stories">${stories(c)}</div><div class="kanji-words">${rows(c, words.filter((w) => study.met(w.k)), 5)}</div>`;
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
  // A fold clicked with the mouse gives the focus back, so Space still moves an introduction on [Enter on it is a click with detail 0 and keeps it].
  document.addEventListener("click", (e) => { if (e.detail) e.target.closest(".kr-all summary")?.blur(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".kpad [data-clear]");
    if (!b) return;
    // Space after Clear turns the card rather than clearing again [a focused button keeps its own key in runCards].
    b.blur();
    b.closest(".kpad").querySelector("svg").replaceChildren();
  });

  study.routes.kanji = viewKanji;
})();
