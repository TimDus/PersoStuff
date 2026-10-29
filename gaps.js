// The Particles tab: a sentence with one particle out, picked from four [電車＿乗ります → に].
(function () {
  const { SENTENCES, options, pieces } = window.HiraParticles;
  const { STEPS, own, narrow, stepQueue, reviewQueue } = window.HiraParticleLessons;
  const { spaced, gapFor } = window.HiraOrder;
  const study = window.HiraStudy;
  const COUNTS = [10, 20, 40];
  const SEL = "hira.particles.count";
  const fmt = (ms) => study.shell().fmtTime(ms);
  const esc = (s) => study.shell().esc(s);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const loadCount = () => { const n = +localStorage.getItem(SEL); return COUNTS.includes(n) ? n : 10; };
  // A finished step is a best under a key no count makes, so it syncs like one [best["step:wa-ga"]; a count is "10"].
  const stepKey = (s) => `step:${s.id}`;
  const finished = () => STEPS.filter((s) => study.particles.best(stepKey(s)));

  // The sentence with readings over its kanji and the gap shown, or filled once answered [私＿学生です → 私は学生です].
  const sentence = (c, fill) => pieces(c.s).map((p) => (p.gap ? `<span class="gap ${fill ? "filled" : ""}">${fill ? esc(fill) : "＿"}</span>`
    : p.kanji ? `<ruby>${esc(p.kanji)}<rt>${esc(p.rt)}</rt></ruby>` : esc(p.text))).join("");
  // Hand text, its bracketed examples shown in parentheses [[私は学生です, I am a student] reads (私は学生です, I am a student)].
  const prose = (s) => esc(s).replace(/\[([^\]]+)\]/g, "($1)");

  // A run that isn't the picker's: its cards, its back link and what finishing it does, showing no best [a step's finish stores best["step:wo"]].
  const stepPlan = (step) => ({
    make: () => stepQueue(step),
    back: { href: `#particles/learn/${step.id}`, label: step.title },
    finished: (best) => study.particles.setBest(stepKey(step), best),
  });
  const reviewPlan = () => ({ make: () => reviewQueue(finished()), back: { href: "#particles", label: "Particles" } });

  function viewParticles([mode, id, sub]) {
    const count = loadCount();
    const step = mode === "learn" && STEPS.find((s) => s.id === id);
    if (step) return sub === "run" ? run(count, null, stepPlan(step)) : lesson(step);
    if (mode === "review" && finished().length) return run(count, null, reviewPlan());
    // Nothing after run, so an old grammar-point link opens the picker [#particles/run/を/wo].
    if (mode === "run" && !id) return run(count, null, null);
    picker(count);
  }

  function lesson(step) {
    const { app } = study.shell();
    const i = STEPS.indexOf(step), prev = STEPS[i - 1], next = STEPS[i + 1];
    // Each sentence filled with this step's particles it takes [バス＿降ります in を's step reads を, not から; 学校＿行きます reads に／へ].
    const fill = (c) => narrow(c, step.particles).ok.join("／");
    app.innerHTML = `
      <div class="row"><a href="#particles">← Particles</a><span class="spacer"></span><span class="muted small">Step ${i + 1} of ${STEPS.length}</span></div>
      <div class="verb-lesson">
        <h1>${esc(step.title)}</h1>
        <p class="lead">${prose(step.intro)}</p>
        <h2>How it's used</h2>
        <ul>${step.rules.map((r) => `<li>${prose(r)}</li>`).join("")}</ul>
        <h2>In sentences</h2>
        <ul class="part-ex">${own(step).map((c) => `<li data-id="${c.id}"><span class="jp">${sentence(c, fill(c))}</span><div class="muted small">${esc(c.en)}</div></li>`).join("")}</ul>
        <p><strong>Watch out:</strong> ${prose(step.mistake)}</p>
        <div class="row" style="margin-top:1.2rem">
          <a class="btn" id="drill" href="#particles/learn/${step.id}/run">Drill this step</a>
          ${(step.tofugu || []).map(([p, slug]) => `<a class="btn ghost tofugu" href="https://www.tofugu.com/japanese-grammar/${slug}/" target="_blank" rel="noopener">Tofugu on <span class="jp">${esc(p)}</span> ↗</a>`).join("")}
        </div>
        <div class="row" style="margin-top:1.2rem">
          ${prev ? `<a class="btn ghost" href="#particles/learn/${prev.id}">← Step ${i}</a>` : ""}<span class="spacer"></span>
          ${next ? `<a class="btn ghost" href="#particles/learn/${next.id}">Step ${i + 2} →</a>` : ""}
        </div>
      </div>`;
  }

  function picker(count) {
    const { app } = study.shell();
    const best = study.particles.best(String(count));
    const done = new Set(finished());
    app.innerHTML = `
      <h1>Particles</h1>
      <p class="lead">Learn the particles a step at a time: each step explains the ones that get mixed up, shows them in sentences,
        then drills them with what came before.</p>
      <div class="grid">${STEPS.map((s, i) => `
        <a class="panel lesson-card verb-step ${done.has(s) ? "done" : ""}" href="#particles/learn/${s.id}">
          <div class="step">Step ${i + 1}${done.has(s) ? " · done ✓" : ""}</div><div class="title">${esc(s.title)}</div>
        </a>`).join("")}</div>
      <div class="row" style="margin-top:1rem">
        <span class="muted" id="review-note">${done.size ? `${done.size} of ${STEPS.length} steps finished` : "Start with Step 1 above"}</span><span class="spacer"></span>
        <a class="btn ${done.size ? "" : "disabled"}" id="review" href="#particles/review">Review finished steps</a>
      </div>
      <h2 style="margin-top:2rem">All particles mixed</h2>
      <p class="muted">Pick the particle the sentence wants. The English says which meaning is meant, and a choice
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

  // `given` is the missed ones, asked as they are; a plan draws afresh on each run, and neither keeps a best [Again on a step draws another 10].
  function run(count, given, plan) {
    const { app } = study.shell();
    const queue = given ? spaced(given, 1) : plan ? plan.make() : shuffle([...SENTENCES]).slice(0, count);
    const back = plan ? plan.back : { href: "#particles", label: "Particles" };
    // Every particle right for this English, the one on screen first [学校＿行きます: に, also へ].
    const also = (c, g) => c.ok.filter((x) => x !== g);
    const alsoLine = (list) => (list.length ? `<div class="muted">Also right here: <span class="jp">${list.map(esc).join(", ")}</span></div>` : "");
    HiraDrill.run({
      queue, gap: gapFor(queue.length),
      back: { href: back.href, label: `← ${back.label}` }, done: back,
      finished: plan && !given ? plan.finished : undefined,
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
      best: given || plan ? null : { key: String(count), store: study.particles },
      again: () => run(count, given, plan),
      drillMissed: (misses) => run(count, misses, plan),
    });
  }

  study.routes.particles = viewParticles;
})();
