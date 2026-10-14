// A kanji's page, opened as a popup from a word card's note so the review underneath goes on [学 = study, learning, its strokes and the 13 words with it].
(function () {
  const study = window.HiraStudy;
  const { wordsWith } = window.HiraKanji;

  async function popup(c) {
    const shell = study.shell(), esc = shell.esc;
    const words = await study.words();
    const info = study.kanjiInfo()[c] || {};
    const rows = wordsWith(c, words, study.cards()).map((w) => `
      <div class="kw-row${study.met(w.k) ? "" : " unmet"}"><span class="jp">${study.ruby(w)}</span> <span class="small">${esc(w.m)}</span></div>`).join("");
    shell.openModal(`
      <div class="kanji-big jp">${esc(c)}</div>
      <div class="kanji-kw">${esc(study.keyword(c))}</div>
      <div class="muted small">${[info.sc && `${info.sc} strokes`, info.lv >= 4 && `N${info.lv}`].filter(Boolean).join(" · ")}</div>
      ${window.HiraStrokes.button(c)}
      <div class="kanji-words">${rows}</div>`);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kanji]");
    if (!b) return;
    // Focus stays on the note's button until the next frame, so a quick space would open a second popup on the first [学 twice, Close shut only the top one].
    b.blur();
    popup(b.dataset.kanji);
  });
})();
