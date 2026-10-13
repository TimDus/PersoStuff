// The Particles tab: a sentence with one particle out, picked from four [電車＿乗ります → に].
(function () {
  const { SENTENCES, options, pieces } = window.HiraParticles;
  const { spaced, gapFor } = window.HiraOrder;
  const study = window.HiraStudy;
  const COUNTS = [10, 20, 40];
  const SEL = "hira.particles.count";
  const fmt = (ms) => study.shell().fmtTime(ms);
  const esc = (s) => study.shell().esc(s);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const loadCount = () => { const n = +localStorage.getItem(SEL); return COUNTS.includes(n) ? n : 10; };

  // The sentence with readings over its kanji and the gap shown, or filled once answered [私＿学生です → 私は学生です].
  const sentence = (c, fill) => pieces(c.s).map((p) => (p.gap ? `<span class="gap ${fill ? "filled" : ""}">${fill ? esc(fill) : "＿"}</span>`
    : p.kanji ? `<ruby>${esc(p.kanji)}<rt>${esc(p.rt)}</rt></ruby>` : esc(p.text))).join("");

  function viewParticles([mode, only, from]) {
    const count = loadCount();
    // The grammar point a run was opened from, named by its particles as its page is [#particles/run/に,へ/ni-he = ← に／へ, to #grammar/ni-he].
    const back = /^[a-z-]+$/.test(from || "") && only ? { href: `#grammar/${from}`, label: only.split(",").join("／") } : undefined;
    // A grammar point's drill: only sentences one of its particles fits, and no best [#particles/run/に,へ]; a filter that fits none opens the picker.
    const pool = only ? SENTENCES.filter((c) => c.ok.some((p) => only.split(",").includes(p))) : null;
    if (mode === "run" && (!only || pool.length)) return run(count, null, pool, back);
    picker(count);
  }

  function picker(count) {
    const { app } = study.shell();
    const best = study.particles.best(String(count));
    app.innerHTML = `
      <h1>Particles</h1>
      <p class="lead">Pick the particle the sentence wants. The English says which meaning is meant, and a choice
        that would fit another meaning is never offered as a wrong one.</p>
      <div class="panel">
        <div class="row">
          <label>Questions <select id="count">${COUNTS.map((n) => `<option ${n === count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <span class="muted" id="best">${best ? `Best: ${fmt(best.ms)} at ${best.acc}%` : ""}</span>
          <span class="spacer"></span><span class="muted">${SENTENCES.length} sentences</span>
          <a class="btn" id="go" href="#particles/run">Start</a>
        </div>
      </div>`;
    app.querySelector("#count").addEventListener("change", (e) => { localStorage.setItem(SEL, e.target.value); picker(+e.target.value); });
  }

  // `given` is the missed ones, asked as they are; `pool` a filter drawn from afresh on each run, and neither keeps a best [#particles/run/に: Again draws another 10 of its 12].
  function run(count, given, pool, back = { href: "#particles", label: "Particles" }) {
    const { app } = study.shell();
    const queue = given ? spaced(given, 1) : shuffle([...(pool || SENTENCES)]).slice(0, count);
    // Every particle right for this English, the one on screen first [学校＿行きます: に, also へ].
    const also = (c, g) => c.ok.filter((x) => x !== g);
    const alsoLine = (list) => (list.length ? `<div class="muted">Also right here: <span class="jp">${list.map(esc).join(", ")}</span></div>` : "");
    HiraDrill.run({
      queue, gap: gapFor(queue.length),
      back: { href: back.href, label: `← ${back.label}` }, done: back,
      card: `<div class="gap-q"><div class="sentence-jp jp" id="sent"></div><div class="muted" id="en"></div></div>`,
      show(c) {
        app.querySelector("#sent").innerHTML = sentence(c);
        app.querySelector("#en").textContent = c.en;
        app.querySelector(".gap-q").dataset.id = c.id;
      },
      options: (c) => options(c),
      judge: (c, p) => (c.ok.includes(p) ? p : null),
      right(c, p, _, { fb }) {
        app.querySelector("#sent").innerHTML = sentence(c, p);
        fb.innerHTML = alsoLine(also(c, p));
        return also(c, p).length ? 1200 : 450;
      },
      wrong(c, p, { good: g }) {
        app.querySelector("#sent").innerHTML = sentence(c, g);
        return `<div class="ans jp">${esc(g)}</div>${alsoLine(also(c, g))}`;
      },
      missLine: (c) => `<span class="jp">${sentence(c, c.ok[0])}</span> · ${esc(c.en)}`,
      best: given || pool ? null : { key: String(count), store: study.particles },
      again: () => run(count, given, pool, back),
      drillMissed: (misses) => run(count, misses, null, back),
    });
  }

  study.routes.particles = viewParticles;
})();
