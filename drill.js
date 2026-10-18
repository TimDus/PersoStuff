// The drill runner Verbs, Particles, Grammar and Listening share: the stage, a miss asked again, typed or 1–4 answers, the Done page and its best [a miss in any of them comes back 6–8 cards on].
(function () {
  const { toKana } = window.HiraConj;
  const { better } = window.HiraSync;
  const { requeue } = window.HiraOrder;
  const study = window.HiraStudy;

  // One drill's queue and hooks; `judge` returns the answer an input matches or null, `right` how long a right answer stays up [Verbs 350 ms, Grammar 800].
  function run(d) {
    const { app, onKey, cleanup, esc, fmtTime: fmt } = study.shell();
    cleanup();
    const { queue, gap, clash } = d;
    const missed = [];
    // The typed box is never read-only, which would drop a phone keyboard: `settling` covers the beat after a right answer, `waiting` a miss.
    let idx = 0, right = 0, wrong = 0, waiting = false, settling = false, composing = false;
    const start = Date.now();
    app.innerHTML = `
      <div class="row"><a href="${d.back.href}">${esc(d.back.label)}</a><span class="spacer"></span><span class="progress-line" id="prog"></span></div>
      <div class="stage">
        ${d.card}
        ${d.typed ? `<input class="quiz-input jp" id="in" lang="ja" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="romaji or kana">`
          : `<div class="row gap-opts" id="opts"></div>`}
        <div class="feedback" id="fb"></div>
        <div class="stats"><span>✓ <b id="ok">0</b></span><span>✗ <b id="bad">0</b></span></div>
      </div>`;
    const input = app.querySelector("#in"), fb = app.querySelector("#fb");
    let shown = [];
    function show() {
      // Cleared before Done so a later Enter there finds nothing to continue [it redrew Done at 0:04, 0:05, 0:07].
      waiting = false; settling = false;
      if (idx >= queue.length) return finish();
      const item = queue[idx];
      d.show(item);
      app.querySelector("#prog").textContent = `${idx + 1} / ${queue.length}`;
      if (input) { input.value = ""; input.className = "quiz-input jp"; input.focus(); }
      else {
        shown = d.options(item);
        app.querySelector("#opts").innerHTML = shown.map((p, i) => `<button class="ghost gap-opt${d.latin ? "" : " jp"}" data-p="${esc(p)}">${esc(p)} <span class="kbd">${i + 1}</span></button>`).join("");
        app.querySelectorAll(".gap-opt").forEach((b) => b.addEventListener("click", () => answer(b.dataset.p)));
      }
      fb.innerHTML = "";
    }
    const button = (p) => [...app.querySelectorAll(".gap-opt")].find((b) => b.dataset.p === p);
    function answer(given) {
      // Past the last card a key finds nothing to answer [1 on Particles' Done page threw reading undefined.ok].
      if (waiting || settling || idx >= queue.length) return;
      const item = queue[idx];
      const hit = d.judge(item, given);
      // The right choice lights up either way, the pressed one red on a miss [に green, で red].
      const good = !input && shown.find((p) => d.judge(item, p));
      if (good) { button(good).classList.add("right"); if (!hit) button(given).classList.add("wrong"); }
      if (hit) {
        right++;
        app.querySelector("#ok").textContent = right;
        settling = true;
        idx++;
        const ms = d.right(item, hit, given, { input, fb });
        // Only while this run is still on screen [left for Words while a right answer settles = nothing drawn there].
        setTimeout(() => { if (settling && fb.isConnected) show(); }, ms);
        return;
      }
      wrong++;
      missed.push(item);
      app.querySelector("#bad").textContent = wrong;
      fb.innerHTML = `${d.wrong(item, given, { input, fb, good })}
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
      requeue(queue, idx, gap, Math.random, clash);
      idx++;
      waiting = true;
    }
    if (input) {
      // Romaji before the caret turns into kana as it's typed, except while a Japanese keyboard is composing [anna before します = あんな|します].
      input.addEventListener("compositionstart", () => { composing = true; });
      input.addEventListener("compositionend", () => { composing = false; });
      input.addEventListener("beforeinput", (e) => { if (waiting || settling) e.preventDefault(); });
      input.addEventListener("input", () => {
        if (composing) return;
        const at = input.selectionStart, head = toKana(input.value.slice(0, at));
        if (head === input.value.slice(0, at)) return;
        input.value = head + input.value.slice(at);
        input.setSelectionRange(head.length, head.length);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        if (waiting) return show();
        if (!settling && input.value.trim()) answer(input.value);
      });
      fb.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    }
    onKey((e) => {
      // While a miss shows, Enter or Space moves on from wherever focus is; a link follows itself and Continue presses itself [focus on the clicked で: Enter moves on].
      if (waiting && (e.key === "Enter" || (!input && e.key === " ")) && e.target !== input && !e.target.closest("a, #next")) { e.preventDefault(); return show(); }
      const pick = !input && /^[1-4]$/.test(e.key) && shown[+e.key - 1];
      if (pick) answer(pick);
    });
    function finish() {
      const ms = Date.now() - start;
      const acc = Math.round((right / (right + wrong)) * 100);
      let note = "";
      if (d.best) {
        const { key, store } = d.best, prev = store.best(key);
        if (!prev || better(prev, { ms, acc }) !== prev) {
          store.setBest(key, { ms, acc });
          note = prev ? `New best! Previous ${fmt(prev.ms)} at ${prev.acc}%` : "First run — now beat it.";
        } else note = `Best: ${fmt(prev.ms)} at ${prev.acc}%`;
      }
      // A finished drill uploads at once, like a finished review [a new best reaches the other devices now, not in 20 s].
      study.flush();
      const misses = [...new Set(missed)];
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
          <h1>Done!</h1>
          <div class="stats" style="margin:1rem 0"><div><div class="big-number">${fmt(ms)}</div>time</div><div><div class="big-number">${acc}%</div>accuracy</div></div>
          <p class="muted">${note}</p>
          ${misses.length ? `<h2>Missed</h2><div class="verb-misses">${misses.map((m) => `<div>${d.missLine(m)}</div>`).join("")}</div>` : ""}
          <div class="row" style="justify-content:center;margin-top:1.2rem">
            <button id="re">Again</button>
            ${misses.length ? `<button class="ghost" id="miss">Drill the missed ones</button>` : ""}
            <a class="btn ghost" href="${d.done.href}">${esc(d.done.label)}</a>
          </div>
        </div>`;
      app.querySelector("#re").addEventListener("click", d.again);
      app.querySelector("#miss")?.addEventListener("click", () => d.drillMissed(misses));
    }
    show();
  }

  window.HiraDrill = { run };
})();
