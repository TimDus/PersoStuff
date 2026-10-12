// Stroke matching for the writing quiz, pure for browser and node [a drawn stroke against KanjiVG's, both in its 109-unit box].
(function (root) {
  const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;
  // Points along a KanjiVG path, which is one M and relative c curves only [M30.5,30.25c1.88,0.75,4.64,1.06,5.88,0.88].
  function pathPoints(d, steps = 8) {
    const nums = d.match(NUM).map(Number);
    let [x, y] = nums;
    const pts = [[x, y]];
    for (let i = 2; i + 5 < nums.length; i += 6) {
      const [ax, ay, bx, by, ex, ey] = nums.slice(i, i + 6).map((v, j) => v + (j % 2 ? y : x));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        pts.push([u * u * u * x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey]);
      }
      x = ex; y = ey;
    }
    return pts;
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const length = (pts) => pts.slice(1).reduce((n, p, i) => n + dist(pts[i], p), 0);
  // The same line as n points evenly spaced along it [a 2-point line into 24 = every 1/23 of the way].
  function resample(pts, n) {
    const total = length(pts);
    if (!total) return Array(n).fill(pts[0]);
    const out = [pts[0]];
    let i = 1, from = pts[0], left = total / (n - 1);
    while (out.length < n - 1 && i < pts.length) {
      const seg = dist(from, pts[i]);
      if (seg >= left) {
        const t = left / seg;
        from = [from[0] + (pts[i][0] - from[0]) * t, from[1] + (pts[i][1] - from[1]) * t];
        out.push(from);
        left = total / (n - 1);
      } else { left -= seg; from = pts[i++]; }
    }
    while (out.length < n) out.push(pts.at(-1));
    return out;
  }

  // How far a drawing may stray, in box units of 109 [every stroke 12 off still passes, 16 off none do].
  const TOL = { avg: 13, ends: 22, chord: 6 };
  const N = 24;
  // Whether a drawn stroke is the expected one: the same course, start and end, and direction [い's first stroke drawn bottom to top fails].
  function strokeMatches(drawn, target) {
    if (drawn.length < 2 || length(drawn) < 2) return false;
    const a = resample(drawn, N), b = resample(target, N);
    const avg = a.reduce((n, p, i) => n + dist(p, b[i]), 0) / N;
    if (avg > TOL.avg || dist(a[0], b[0]) > TOL.ends || dist(a[N - 1], b[N - 1]) > TOL.ends) return false;
    const ca = [a[N - 1][0] - a[0][0], a[N - 1][1] - a[0][1]], cb = [b[N - 1][0] - b[0][0], b[N - 1][1] - b[0][1]];
    const la = Math.hypot(...ca), lb = Math.hypot(...cb);
    return lb < TOL.chord || (la > 0 && (ca[0] * cb[0] + ca[1] * cb[1]) / (la * lb) > 0.5);
  }
  // Each target stroke against the stroke drawn in its place [あ drawn 2, 1, 3 = [false, false, true]].
  const grade = (drawn, targets) => targets.map((t, i) => !!drawn[i] && strokeMatches(drawn[i], t));

  // A whole kana written right: every stroke, in order, and nothing more [あ in 4 strokes = false].
  const written = (drawn, targets) => drawn.length === targets.length && grade(drawn, targets).every(Boolean);

  const api = { pathPoints, resample, strokeMatches, grade, written, TOL };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraWrite = api;
})(this);
