// The Grammar tab: a page per N5 point and a drill that hides which point it asks [日本語で＿。「話す」 → 話してください].
(function () {
  const { toKana, accepts } = window.HiraConj;
  const { spaced, gapFor } = window.HiraOrder;
  const study = window.HiraStudy;
  const COUNTS = [10, 20, 40];
  const SEL = "hira.grammar.sel";
  // How long a right answer stays up with the readings it uncovered [800 ms; Verbs moves on after 350, with one word to read].
  const SETTLE = 800;
  let data = null, loading = null;
  // Fetched on the first visit and kept [data/grammar.json, 40 points, 368 sentences].
  const load = () => (loading ||= fetch("data/grammar.json", { cache: "no-cache" }).catch(() => fetch("data/grammar.json", { cache: "force-cache" }))
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((d) => (data = d))
    .catch((e) => { loading = null; throw e; }));

  const esc = (s) => study.shell().esc(s);
  const fmt = (ms) => study.shell().fmtTime(ms);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const drilled = () => data.points.filter((p) => !p.particles);
  const pointOf = (id) => data.points.find((p) => p.id === id);
  // Furigana runs, the ones over N5 kanji marked to be recalled [学生 asked; 写真's N4 kanji given].
  const ruby = (fu) => fu.map(([t, rt, lv]) => (rt ? `<ruby>${esc(t)}<rt${lv >= 5 ? ' class="ask"' : ""}>${esc(rt)}</rt></ruby>` : esc(t))).join("");
  const sentence = (s, fill) => s.fu.map((run) => (run ? ruby([run]) : `<span class="gap ${fill ? "filled" : ""}">${fill ? ruby(fill.fu || [[fill.w]]) : "　"}</span>`)).join("");

  // The saved pick, keeping only points that drill here [a particle point or a removed id is dropped].
  const loadSel = () => {
    let sel = {};
    try { sel = JSON.parse(localStorage.getItem(SEL)) || {}; } catch {}
    const ids = drilled().map((p) => p.id);
    return {
      points: Array.isArray(sel.points) ? sel.points.filter((id) => ids.includes(id)) : ids,
      count: COUNTS.includes(sel.count) ? sel.count : 20,
    };
  };
  // A best per points drilled and questions asked, never more than the points hold [です alone at 20 = desu,ga-arimasu,ga-imasu|20; tekudasai at 20 = tekudasai|12].
  const selKey = (sel) => `${[...drilledIds(sel.points)].sort().join(",")}|${Math.min(sel.count, poolOf(sel).length)}`;
  // The points a pick drills: each picked point brings its siblings, from the hub and from its page alike [あります alone = あります, います].
  const drilledIds = (ids) => [...new Set([...ids, ...ids.flatMap((id) => pointOf(id)?.with || [])])];
  const poolOf = (sel) => { const ids = drilledIds(sel.points); return data.sentences.filter((s) => ids.includes(s.p)); };

  async function viewGrammar([id, mode]) {
    const { app } = study.shell();
    if (!data) {
      app.innerHTML = `<p class="muted">Loading grammar…</p>`;
      const here = location.hash;
      let failed = false;
      try { await load(); } catch { failed = true; }
      if (location.hash !== here) return;
      if (failed) return cantLoad(() => viewGrammar([id, mode]));
    }
    if (id === "run") return run(loadSel());
    const point = pointOf(id);
    if (point && mode === "run" && !point.particles) return run({ ...loadSel(), points: [id] }, null, point);
    if (point) return page(point);
    hub(loadSel());
  }

  function cantLoad(retry) {
    const { app } = study.shell();
    app.innerHTML = `
      <div class="panel" style="text-align:center;max-width:520px;margin:2rem auto">
        <h1>Can't load the grammar</h1>
        <p class="muted">The grammar points come with the site and need a connection the first time.</p>
        <button id="retry">Try again</button>
      </div>`;
    app.querySelector("#retry").addEventListener("click", retry);
  }

  function hub(sel) {
    const { app } = study.shell();
    const groups = [...new Set(data.points.map((p) => p.group))];
    const best = study.grammar.best(selKey(sel));
    const avail = poolOf(sel).length;
    const brought = drilledIds(sel.points).filter((id) => !sel.points.includes(id));
    app.innerHTML = `
      <h1>Grammar</h1>
      <p class="lead">The JLPT N5 grammar points, grouped by the form they attach to. A drill never says which point a
        sentence wants: the English decides, and you type the whole form in romaji or kana.</p>
      <div class="panel">
        ${groups.map((g, i) => {
          const pts = drilled().filter((p) => p.group === g);
          return pts.length ? `<div class="picker-head"><strong>${esc(g)}</strong>
            <button class="linkish" data-all="${i}">all</button><button class="linkish" data-none="${i}">none</button></div>
            <div class="picker">${pts.map((p) => `<span class="chip ${sel.points.includes(p.id) ? "on" : ""}" role="button" data-point="${p.id}">${esc(p.title)}</span>`).join("")}</div>` : "";
        }).join("")}
        <div class="row" style="margin-top:1.2rem">
          <label>Questions <select id="count">${COUNTS.map((n) => `<option ${n === sel.count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <span class="muted" id="best">${best ? `Best: ${fmt(best.ms)} at ${best.acc}%` : ""}</span>
          <span class="spacer"></span><span class="muted" id="avail">${avail} sentences${brought.length ? `, with ${brought.map((id) => esc(pointOf(id).title)).join(", ")}` : ""}</span>
          <a class="btn ${avail ? "" : "disabled"}" id="go" href="#grammar/run">Start</a>
        </div>
      </div>
      ${groups.map((g) => `<div class="gr-group"><h2>${esc(g)}</h2><div class="gr-list">${data.points.filter((p) => p.group === g).map((p) => `
        <a class="gr-point panel" href="#grammar/${p.id}"><span class="jp">${esc(p.title)}</span><span class="muted small">${esc(p.attach)}</span></a>`).join("")}</div></div>`).join("")}`;
    const save = (next) => { localStorage.setItem(SEL, JSON.stringify(next)); hub(next); };
    const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
    const inGroup = (i) => drilled().filter((p) => p.group === groups[i]).map((p) => p.id);
    app.querySelector(".panel").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-point]"), all = e.target.closest("[data-all]"), none = e.target.closest("[data-none]");
      if (chip) save({ ...sel, points: toggle(sel.points, chip.dataset.point) });
      else if (all) save({ ...sel, points: [...new Set([...sel.points, ...inGroup(+all.dataset.all)])] });
      else if (none) save({ ...sel, points: sel.points.filter((id) => !inGroup(+none.dataset.none).includes(id)) });
    });
    app.querySelector("#count").addEventListener("change", (e) => save({ ...sel, count: +e.target.value }));
  }

  function page(p) {
    const { app } = study.shell();
    const examples = data.sentences.filter((s) => s.p === p.id).slice(0, 3);
    // A particle point is taught by the Particles step holding its particle [に and に／へ = #particles/learn/ni-he].
    const step = p.particles && window.HiraParticleLessons.STEPS.find((s) => s.particles.includes(p.particles[0]));
    const drill = step ? `#particles/learn/${step.id}` : `#grammar/${p.id}/run`;
    app.innerHTML = `
      <div class="row"><a href="#grammar">← Grammar</a><span class="spacer"></span><span class="muted small">${esc(p.group)}</span></div>
      <h1 class="jp">${esc(p.title)}</h1>
      <p class="gr-attach"><strong>${esc(p.attach)}</strong></p>
      <p class="gr-explain">${esc(p.explain)}</p>
      ${examples.length ? `<div class="examples">${examples.map((s) => `
        <div class="ex"><span class="jp gr-ex">${sentence(s, s.gap)}</span><div class="muted small">${esc(s.en)}</div></div>`).join("")}</div>` : ""}
      <div class="row" style="margin-top:1.2rem">
        <a class="btn" id="drill" href="${drill}">${step ? "Learn in Particles" : p.with ? `Drill with ${p.with.map((id) => esc(pointOf(id).title)).join(", ")}` : "Drill this point"}</a>
        <a class="btn ghost tofugu" href="https://www.tofugu.com/japanese-grammar/${esc(p.tofugu)}/" target="_blank" rel="noopener">Tofugu on this ↗</a>
      </div>
      <p class="muted small">Explanation adapted from Wikibooks' <a href="https://en.wikibooks.org/wiki/JLPT_Guide/JLPT_N5_Grammar" target="_blank" rel="noopener">JLPT Guide</a>; sentences from <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>.</p>`;
  }

  // `from` is the point whose page started the run, which its links lead back to [#grammar/tekudasai/run = ← ～てください].
  function run(sel, given, from) {
    const { app } = study.shell();
    // Two cards with one answer kept apart wherever the pick allows, or the second is a copy [行きませんか twice in a row].
    const sameAnswer = (a, b) => a.gap.r === b.gap.r;
    const queue = spaced(given || shuffle(poolOf(sel)).slice(0, sel.count), 1, Math.random, sameAnswer);
    if (!queue.length) { location.hash = "#grammar"; return; }
    const q = () => app.querySelector(".gr-q");
    const back = from ? { href: `#grammar/${from.id}`, label: from.title } : { href: "#grammar", label: "Grammar" };
    HiraDrill.run({
      queue, gap: gapFor(queue.length), clash: sameAnswer, typed: true,
      back: { href: back.href, label: `← ${back.label}` }, done: back,
      card: `<div class="gr-q"><div class="sentence-jp jp" id="sent"></div><div class="muted" id="en"></div><div class="jp" id="hint"></div></div>`,
      show(s) {
        q().dataset.id = s.id;
        q().classList.remove("answered");
        app.querySelector("#sent").innerHTML = sentence(s);
        app.querySelector("#en").textContent = s.en;
        app.querySelector("#hint").innerHTML = s.hint ? `「${ruby(s.hint.fu)}」` : "";
      },
      // The sentence's own answer or one it lists [食べよう for 食べましょう at the end of a sentence].
      judge: (s, typed) => [s.gap, ...s.ok].find((a) => accepts(a, typed)) || null,
      right(s, hit, typed, { input }) {
        q().classList.add("answered");
        app.querySelector("#sent").innerHTML = sentence(s, hit);
        input.value = toKana(typed.trim(), true) === hit.w ? hit.w : hit.r;
        input.classList.add("right");
        return SETTLE;
      },
      wrong(s, typed, { input }) {
        q().classList.add("answered");
        app.querySelector("#sent").innerHTML = sentence(s, s.gap);
        input.classList.add("wrong");
        const p = pointOf(s.p);
        // Only answers that read differently are worth listing [話して下さい is 話してください again].
        const also = s.ok.filter((a, i, all) => a.r !== s.gap.r && all.findIndex((x) => x.r === a.r) === i);
        return `<div class="ans jp">${esc(s.gap.w)}</div>${s.gap.w !== s.gap.r ? `<div class="muted small jp">${esc(s.gap.r)}</div>` : ""}
          <div>Pattern: <a class="jp" href="#grammar/${p.id}">${esc(p.title)}</a></div>
          ${also.length ? `<div class="muted small also">Also right: <span class="jp">${also.map((a) => esc(a.w)).join("、")}</span></div>` : ""}`;
      },
      missLine: (s) => `<span class="jp">${sentence(s, s.gap)}</span> · <a class="jp" href="#grammar/${s.p}">${esc(pointOf(s.p).title)}</a>`,
      best: given ? null : { key: selKey(sel), store: study.grammar },
      again: () => run(sel, given, from),
      drillMissed: (misses) => run(sel, misses, from),
    });
  }

  study.routes.grammar = viewGrammar;
})();
