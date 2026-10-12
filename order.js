// Quiz order, pure so node can test it: what comes next, where a missed kana comes back, and what to drill after.
(function (root) {
  // Others between two of the same kana [5 from 7 kana up, 3 for the 5 vowels so rounds still shuffle, 1 for 2 kana].
  const gapFor = (n) => Math.max(Math.min(5, n - 2), Math.min(1, n - 1));

  // Small kana count as their big ones [ゃ is や, ッ is ツ].
  const BIG = Object.fromEntries([..."ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ"].map((c, i) => [c, "あいうえおつやゆよわかけアイウエオツヤユヨワカケ"[i]]));
  // Two kana that read as the same card back to back: one shared character, small kana as big [や and きゃ, き and きゃ; や and ヤ differ].
  const shareKana = (a, b) => a === b || [...a.kana].some((c) => [...b.kana].some((d) => (BIG[c] || c) === (BIG[d] || d)));
  const same = (a, b) => a === b;

  // Each item `rounds` times, the most-left first so a round's end never crowds the next one's start [お can't end round 1 and open round 2].
  // `clash` only breaks ties the round and gap rules leave open, so it never costs the gap [ヴ column with ワ ヲ ン: no clean order, gap kept].
  function spaced(items, rounds, rand = Math.random, clash = same) {
    const gap = gapFor(items.length);
    const clashes = (q) => q.slice(1).filter((k, i) => clash(q[i], k)).length;
    function once() {
      const left = new Map(items.map((k) => [k, rounds]));
      const out = [];
      while (out.length < items.length * rounds) {
        const recent = gap ? out.slice(-gap) : [];
        const open = items.filter((k) => left.get(k) > 0 && !recent.includes(k));
        const pool = open.length ? open : items.filter((k) => left.get(k) > 0);
        const most = Math.max(...pool.map((k) => left.get(k)));
        const top = pool.filter((k) => left.get(k) === most);
        const apart = top.filter((k) => !out.length || !clash(out.at(-1), k));
        const choice = apart.length ? apart : top;
        const k = choice[Math.floor(rand() * choice.length)];
        out.push(k);
        left.set(k, left.get(k) - 1);
      }
      return out;
    }
    // One kana at a time can end a round holding only clashing ones, so the best of many tries is kept [や ゆ よ しゃ しゅ しょ: 1 try in 10 is clean].
    let best = once();
    for (let tries = 1; tries < 500 && clashes(best); tries++) {
      const next = once();
      if (clashes(next) < clashes(best)) best = next;
    }
    return best;
  }

  // Puts the kana at idx back twice, 6–8 and 15–20 on, or once at the farthest fit when two won't fit [missed at 30 of 33 = once, last].
  // Never right beside itself; with no such spot it isn't put back and 0 says so [the last kana of the quiz has only that spot].
  function requeue(queue, idx, gap, rand = Math.random, clash = same) {
    const k = queue[idx];
    const apart = (p) => !clash(queue[p - 1], k) && (p >= queue.length || !clash(queue[p], k));
    // An insert at p leaves `gap` others to the nearest copy on each side, and no clashing kana right beside it [gap 5: no k in p-5..p+4].
    const fits = (p) => !queue.slice(Math.max(0, p - gap), p + gap).includes(k) && apart(p);
    const fitting = () => { const ps = []; for (let p = idx + 1; p <= queue.length; p++) if (fits(p)) ps.push(p); return ps; };
    // A random fit inside [from, to], else the nearest after it, else the farthest before it.
    const pick = (ps, from, to) => {
      const inside = ps.filter((p) => p >= from && p <= to);
      if (inside.length) return inside[Math.floor(rand() * inside.length)];
      return ps.find((p) => p > to) ?? ps.filter((p) => p < from).at(-1) ?? -1;
    };
    const firsts = fitting();
    // The earliest first copy leaves the most room for the second, so it's the retry when the random one blocks it.
    for (const p1 of new Set([pick(firsts, idx + 6, idx + 8), firsts[0] ?? -1])) {
      if (p1 === -1) continue;
      queue.splice(p1, 0, k);
      const p2 = pick(fitting(), idx + 15, idx + 20);
      if (p2 !== -1) { queue.splice(p2, 0, k); return 2; }
      queue.splice(p1, 1);
    }
    // Once, at the best spot left: never beside itself, then past the gap, then off shared kana, then the farthest,
    // the same ranking as `spaced` [あ か あ か あ か with か missed third: every spot touches a か, so 0].
    const pastGap = (p) => !queue.slice(Math.max(0, p - gap), p + gap).includes(k);
    const rank = (p) => (pastGap(p) ? 2 : 0) + (apart(p) ? 1 : 0);
    let last = -1;
    for (let p = queue.length; p > idx; p--) {
      if (queue[p - 1] === k || queue[p] === k) continue;
      if (last === -1 || rank(p) > rank(last)) last = p;
    }
    if (last === -1) return 0;
    queue.splice(last, 0, k);
    return 1;
  }

  // Drill lists per share: the missed plus the slowest of the rest, rounded up and ties at a tenth of a second kept [10 clean, 25% = 3].
  function slowest(times, missed, shares = [0.25, 0.5, 0.75]) {
    const tenths = (k) => Math.round(times.get(k) / 100);
    const clean = [...times.keys()].filter((k) => !missed.includes(k)).sort((a, b) => tenths(b) - tenths(a));
    const out = [];
    for (const share of shares) {
      let n = Math.ceil(share * clean.length);
      while (n > 0 && n < clean.length && tenths(clean[n]) === tenths(clean[n - 1])) n++;
      if (n && n !== out.at(-1)?.slow) out.push({ share, slow: n, items: [...missed, ...clean.slice(0, n)] });
    }
    return out;
  }

  const api = { gapFor, spaced, requeue, slowest, shareKana };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraOrder = api;
})(this);
