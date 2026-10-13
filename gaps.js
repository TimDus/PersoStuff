// The Particles tab: a sentence with one particle out, picked from four [電車＿乗ります → に].
(function () {
  const { SENTENCES, options, pieces } = window.HiraParticles;
  const { better } = window.HiraSync;
  const { spaced, requeue, gapFor } = window.HiraOrder;
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

  function viewParticles([mode]) {
    const count = loadCount();
    if (mode === "run") return run(count);
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

  function run(count, given) {
    const { app, onKey, cleanup } = study.shell();
    cleanup();
    const queue = given ? spaced(given, 1) : shuffle([...SENTENCES]).slice(0, count);
    const gap = gapFor(queue.length);
    const missed = [];
    let idx = 0, right = 0, wrong = 0, shown = [], waiting = false, settling = false;
    const start = Date.now();
    app.innerHTML = `
      <div class="row"><a href="#particles">← Particles</a><span class="spacer"></span><span class="progress-line" id="prog"></span></div>
      <div class="stage">
        <div class="gap-q"><div class="sentence-jp jp" id="sent"></div><div class="muted" id="en"></div></div>
        <div class="row gap-opts" id="opts"></div>
        <div class="feedback" id="fb"></div>
        <div class="stats"><span>✓ <b id="ok">0</b></span><span>✗ <b id="bad">0</b></span></div>
      </div>`;
    const fb = app.querySelector("#fb");
    function show() {
      // Cleared before Done so a later key there finds nothing to continue [as in the Verbs drill].
      waiting = false; settling = false;
      if (idx >= queue.length) return finish();
      const c = queue[idx];
      shown = options(c);
      app.querySelector("#sent").innerHTML = sentence(c);
      app.querySelector("#en").textContent = c.en;
      app.querySelector("#prog").textContent = `${idx + 1} / ${queue.length}`;
      app.querySelector(".gap-q").dataset.id = c.id;
      app.querySelector("#opts").innerHTML = shown.map((p, i) => `<button class="ghost gap-opt jp" data-p="${esc(p)}">${esc(p)} <span class="kbd">${i + 1}</span></button>`).join("");
      app.querySelectorAll(".gap-opt").forEach((b) => b.addEventListener("click", () => pick(b.dataset.p)));
      fb.innerHTML = "";
    }
    function pick(p) {
      if (waiting || settling) return;
      const c = queue[idx];
      const good = shown.find((x) => c.ok.includes(x));
      app.querySelector(`.gap-opt[data-p="${good}"]`).classList.add("right");
      app.querySelector("#sent").innerHTML = sentence(c, good);
      // Every particle right for this English, the one on screen first [学校＿行きます: に, also へ].
      const also = c.ok.filter((x) => x !== good);
      if (p === good) {
        right++;
        app.querySelector("#ok").textContent = right;
        settling = true;
        idx++;
        if (also.length) fb.innerHTML = `<div class="muted">Also right here: <span class="jp">${also.map(esc).join(", ")}</span></div>`;
        setTimeout(() => { if (settling && fb.isConnected) show(); }, also.length ? 1200 : 450);
        return;
      }
      wrong++;
      missed.push(c);
      app.querySelector("#bad").textContent = wrong;
      app.querySelector(`.gap-opt[data-p="${p}"]`).classList.add("wrong");
      fb.innerHTML = `<div class="ans jp">${esc(good)}</div>${also.length ? `<div class="muted">Also right here: <span class="jp">${also.map(esc).join(", ")}</span></div>` : ""}
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
      requeue(queue, idx, gap);
      idx++;
      waiting = true;
    }
    onKey((e) => {
      if (waiting && (e.key === "Enter" || e.key === " ") && !e.target.closest("button")) { e.preventDefault(); return show(); }
      const n = /^[1-4]$/.test(e.key) && shown[+e.key - 1];
      if (n) pick(n);
    });
    function finish() {
      const ms = Date.now() - start;
      const acc = Math.round((right / (right + wrong)) * 100);
      let note = "";
      if (!given) {
        const key = String(count), prev = study.particles.best(key);
        if (!prev || better(prev, { ms, acc }) !== prev) {
          study.particles.setBest(key, { ms, acc });
          note = prev ? `New best! Previous ${fmt(prev.ms)} at ${prev.acc}%` : "First run — now beat it.";
        } else note = `Best: ${fmt(prev.ms)} at ${prev.acc}%`;
      }
      study.flush();
      const misses = [...new Set(missed)];
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
          <h1>Done!</h1>
          <div class="stats" style="margin:1rem 0"><div><div class="big-number">${fmt(ms)}</div>time</div><div><div class="big-number">${acc}%</div>accuracy</div></div>
          <p class="muted">${note}</p>
          ${misses.length ? `<h2>Missed</h2><div class="verb-misses">${misses.map((c) => `<div><span class="jp">${sentence(c, c.ok[0])}</span> · ${esc(c.en)}</div>`).join("")}</div>` : ""}
          <div class="row" style="justify-content:center;margin-top:1.2rem">
            <button id="re">Again</button>
            ${misses.length ? `<button class="ghost" id="miss">Drill the missed ones</button>` : ""}
            <a class="btn ghost" href="#particles">Particles</a>
          </div>
        </div>`;
      app.querySelector("#re").addEventListener("click", () => run(count, given));
      app.querySelector("#miss")?.addEventListener("click", () => run(count, misses));
    }
    show();
  }

  study.routes.particles = viewParticles;
})();
