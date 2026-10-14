// A kanji's page, opened as a popup from a word card's note so the review underneath goes on [学 = study, learning, its strokes and the 13 words with it].
(function () {
  const study = window.HiraStudy;
  const { wordsWith } = window.HiraKanji;
  // Stories are other members' HTML, so every < that doesn't open an em or strong is shown as text [a broken <img onerror= stays text].
  const safe = (html) => html.replace(/<(?!\/?(?:em|strong)>)/g, "&lt;");

  // The parts Koohii's data decides, drawn from whatever has arrived [before it lands: KANJIDIC's meaning, no frame, no stories].
  function head(c) {
    const esc = study.shell().esc, info = study.kanjiInfo()[c] || {}, k = study.koohii(c);
    return `
      <div class="kanji-kw">${esc(study.keyword(c))}</div>
      <div class="muted small kanji-meta">${[info.sc && `${info.sc} strokes`, info.lv >= 4 && `N${info.lv}`, k?.frame && `RTK ${k.frame}`].filter(Boolean).join(" · ")}</div>
      ${k ? `<div class="muted small">Keyword from Remembering the Kanji © James W. Heisig</div>` : ""}`;
  }
  function stories(c) {
    const esc = study.shell().esc, k = study.koohii(c);
    const list = k ? [...(k.mine ? [{ by: "From the site's Koohii account", text: k.mine }] : []), ...k.stories] : [];
    return list.map((s) => `
      <div class="story"><div class="story-by muted small">${esc(s.by)}</div><div class="story-text">${safe(s.text)}</div></div>`).join("");
  }
  function body(c, words) {
    const esc = study.shell().esc;
    const rows = wordsWith(c, words, study.cards()).map((w) => `
      <div class="kw-row${study.met(w.k) ? "" : " unmet"}"><span class="jp">${study.ruby(w)}</span> <span class="small">${esc(w.m)}</span></div>`).join("");
    return `
      <div class="kanji-big jp">${esc(c)}</div>
      <div class="kanji-head">${head(c)}</div>
      ${window.HiraStrokes.button(c)}
      <div class="stories">${stories(c)}</div>
      <div class="kanji-words">${rows}</div>`;
  }

  // Asks for Koohii's file if it hasn't arrived, once more if that load fails, and fills in the Koohii parts of the open popup [学 opened mid-load: "study, learning" becomes "study", an open stroke order stays].
  async function popup(c) {
    const words = await study.words();
    study.shell().openModal(`<div class="kanji-pop" data-c="${study.shell().esc(c)}">${body(c, words)}</div>`);
    if (study.koohii(c)) return;
    await study.loadKoohii();
    if (!study.koohii(c)) await study.loadKoohii();
    const open = [...document.querySelectorAll(".kanji-pop")].find((el) => el.dataset.c === c);
    if (!open || !study.koohii(c)) return;
    open.querySelector(".kanji-head").innerHTML = head(c);
    open.querySelector(".stories").innerHTML = stories(c);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kanji]");
    if (!b) return;
    // Focus stays on the note's button until the next frame, so a quick space would open a second popup on the first [学 twice, Close shut only the top one].
    b.blur();
    popup(b.dataset.kanji);
  });
})();
