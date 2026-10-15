// Stroke order from KanjiVG, fetched the first time it's needed [data/strokes.json is 51 KB for 154 kana, kanji-strokes.json 618 KB for 778 kanji].
(function () {
  const files = {};
  // A failed fetch is forgotten so the next press tries again [offline on the train, then back online].
  const fetchOnce = (name) => (files[name] ||= fetch(`data/${name}`, { cache: "no-cache" }).catch(() => fetch(`data/${name}`, { cache: "force-cache" }))
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .catch((e) => { delete files[name]; throw e; }));
  const load = () => fetchOnce("strokes.json");
  // A button shows one kanji or kana only, so one file serves it [学 = kanji-strokes.json, きゃ = strokes.json].
  const loadFor = (text) => (/[一-鿿]/.test(text) ? fetchOnce("kanji-strokes.json") : load());
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // One character in KanjiVG's 109-unit box, each stroke drawn after the last [キャ: ャ's first stroke is the 4th to draw].
  const glyph = (c, { d, n }, start) => `<svg viewBox="0 0 109 109" role="img" aria-label="Stroke order of ${esc(c)}">
    ${d.map((p, i) => `<path d="${p}" pathLength="1" style="--i:${start + i}"/>`).join("")}
    ${n.map(([x, y], i) => `<text x="${x}" y="${y}" style="--i:${start + i}">${i + 1}</text>`).join("")}</svg>`;
  function draw(text, all) {
    let start = 0;
    return `<div class="strokes" title="Click to replay">${[...text].map((c) => {
      if (!all[c]) return "";
      const svg = glyph(c, all[c], start);
      start += all[c].d.length;
      return svg;
    }).join("")}</div>`;
  }

  const button = (text) => `<div class="stroke-slot" data-strokes="${esc(text)}"><button class="ghost stroke-toggle" type="button">Stroke order</button></div>`;
  document.addEventListener("click", async (e) => {
    const shown = e.target.closest(".strokes");
    if (shown) return shown.replaceWith(shown.cloneNode(true));
    const b = e.target.closest(".stroke-toggle");
    if (!b) return;
    b.blur();
    const slot = b.closest(".stroke-slot");
    const open = slot.querySelector(".strokes");
    // A press while loading cancels, like a press on open strokes [two quick taps leave nothing drawn].
    if (open || slot.dataset.loading) { open?.remove(); delete slot.dataset.loading; b.textContent = "Stroke order"; return; }
    slot.dataset.loading = "1";
    let all;
    try { all = await loadFor(slot.dataset.strokes); } catch { if (slot.dataset.loading) b.textContent = "Can't load stroke order, try again"; delete slot.dataset.loading; return; }
    if (!slot.dataset.loading) return;
    delete slot.dataset.loading;
    slot.insertAdjacentHTML("beforeend", draw(slot.dataset.strokes, all));
    b.textContent = "Hide stroke order";
  });

  // Strokes drawn unasked once the file is in, or the button to try again if it fails [a Draw-mode kanji card's back, hidden until the card turns].
  const shown = (text) => {
    const fill = (html) => document.querySelectorAll(".stroke-slot[data-shown]").forEach((slot) => {
      if (slot.dataset.strokes === text && !slot.children.length) slot.innerHTML = html;
    });
    loadFor(text).then((all) => fill(draw(text, all)), () => fill(`<button class="ghost stroke-toggle" type="button">Stroke order</button>`));
    return `<div class="stroke-slot" data-strokes="${esc(text)}" data-shown></div>`;
  };

  window.HiraStrokes = { button, shown, load };
})();
