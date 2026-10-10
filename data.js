// Kana, mnemonics and lesson order after Tofugu's Learn Hiragana guide [104 kana in 12 steps].
(function () {
  // Each row is [kana, romaji, other accepted spellings, mnemonic, look-alike note].
  const groups = [
    { id: "a", label: "あ", name: "Vowels", kind: "main", kana: [
      ["あ", "a", [], "Find the capital A hidden inside it.", "お has a loop on the right instead of a cross."],
      ["い", "i", [], "Two eels standing upright, like a letter i.", ""],
      ["う", "u", [], "A sideways U wearing a little hat.", "つ is the same curve without the hat."],
      ["え", "e", [], "An exotic bird with a feathery head.", ""],
      ["お", "o", [], "You can spot two little o's in it.", "あ has no loop on the right."],
    ]},
    { id: "k", label: "か", name: "K-column", kind: "main", kana: [
      ["か", "ka", [], "A mosquito (ka in Japanese) — cut it out!", "が is the same with two dakuten dashes."],
      ["き", "ki", [], "It looks like a key.", "さ has one cross bar, き has two."],
      ["く", "ku", [], "A cuckoo's open beak going ku ku.", ""],
      ["け", "ke", [], "A strand of wiggly kelp.", "は has a loop at the bottom."],
      ["こ", "ko", [], "Two worms cohabiting side by side.", "い stands up, こ lies down."],
    ]},
    { id: "s", label: "さ", name: "S-column", kind: "main", kana: [
      ["さ", "sa", [], "Two hands stirring a bowl of chunky salsa.", "ち faces the other way."],
      ["し", "shi", ["si"], "A shepherd's crook for herding sheep (shee). Not 'si'!", ""],
      ["す", "su", [], "A swing that loops and flings the kid: I'M GONNA SUE!", ""],
      ["せ", "se", [], "A mouth with one vampire fang, selling you a set of teeth.", ""],
      ["そ", "so", [], "A mouth slurping soda.", ""],
    ]},
    { id: "t", label: "た", name: "T-column", kind: "main", kana: [
      ["た", "ta", [], "A fork with a lime garnish, next to a taco.", "な has a loop at the bottom."],
      ["ち", "chi", ["ti"], "A forced 'cheese' smile in a group photo. Not 'ti'!", "さ faces the other way."],
      ["つ", "tsu", ["tu"], "A tsunami wave swooshing past. Not 'tu'!", "う has a hat on top."],
      ["て", "te", [], "A telescope held in your hand (te means hand).", ""],
      ["と", "to", [], "A toe with a splinter stuck in it.", ""],
    ]},
    { id: "n", label: "な", name: "N-column", kind: "main", kana: [
      ["な", "na", [], "A nun praying at a cross... for nachos.", "た has no loop."],
      ["に", "ni", [], "A needle pulling thread.", "こ plus a line on the left."],
      ["ぬ", "nu", [], "A bowl of soft, bendy noodles — no sharp corners.", "め has no loop at the end."],
      ["ね", "ne", [], "Nelly the cat (neko) curling her tail.", "れ ends in a kick, わ ends in a curve."],
      ["の", "no", [], "A pig's big nose — or a No Smoking sign.", ""],
    ]},
    { id: "h", label: "は", name: "H-column", kind: "main", kana: [
      ["は", "ha", [], "A capital H and a little a squeezed together: Ha!", "ほ has an extra bar on top."],
      ["ひ", "hi", [], "A guy with a huge nose saying hee hee.", ""],
      ["ふ", "fu", ["hu"], "A fool dancing with a hula hoop — somewhere between f and h.", ""],
      ["へ", "he", [], "Mount Saint Helens, squat and wide.", ""],
      ["ほ", "ho", [], "A mutant Santa climbing down a chimney: ho ho ho.", "は has no bar on top."],
    ]},
    { id: "m", label: "ま", name: "M-column", kind: "main", kana: [
      ["ま", "ma", [], "Mama doing evil magic — taking her own head off.", "ほ has a line on the left."],
      ["み", "mi", [], "A 21 in blackjack: lucky me!", ""],
      ["む", "mu", [], "A cow going moo.", ""],
      ["め", "me", [], "A beautiful eye (me means eye) with makeup.", "ぬ has a loop at the end."],
      ["も", "mo", [], "A fish hook catching more and more worms.", "し with two bars."],
    ]},
    { id: "y", label: "や", name: "Y-column", kind: "main", kana: [
      ["や", "ya", [], "A yacht with its anchor out — or a yak's face.", ""],
      ["ゆ", "yu", [], "A big fish eye staring at you.", ""],
      ["よ", "yo", [], "A Y and an o: play it like a yo-yo.", "ま has two bars."],
    ]},
    { id: "r", label: "ら", name: "R-column", kind: "main", kana: [
      ["ら", "ra", [], "A rabbit facing left with droopy ears.", "ち has a cross bar."],
      ["り", "ri", [], "Reeds swaying in the wind.", "Some fonts join the two strokes into one."],
      ["る", "ru", [], "A route with a loop at the end of it.", "ろ is the same road without the loop."],
      ["れ", "re", [], "A man on his knees, retching.", "ね ends in a loop, わ ends in a curve."],
      ["ろ", "ro", [], "A plain road — no loop.", "る has a loop."],
    ]},
    { id: "w", label: "わ", name: "W & N", kind: "main", kana: [
      ["わ", "wa", [], "A wasp flying straight up, away from the cat ね.", "ね ends in a loop, れ ends in a kick."],
      ["を", "wo", ["o"], "A chinless man hit by a boomerang: whoa! (Said 'o', mostly a particle.)", ""],
      ["ん", "n", ["nn"], "Looks like a lowercase n. The only kana with no vowel.", ""],
    ]},
    { id: "g", label: "が", name: "G (dakuten)", kind: "dakuten", note: "か + ゛: the car (ka) crashes into the guard rail (ga).", kana: [
      ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
    ]},
    { id: "z", label: "ざ", name: "Z (dakuten)", kind: "dakuten", note: "さ + ゛: the saw (sa) gets zapped (za). し becomes じ (ji).", kana: [
      ["ざ", "za"], ["じ", "ji", ["zi"]], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
    ]},
    { id: "d", label: "だ", name: "D (dakuten)", kind: "dakuten", note: "た + ゛: TA-DA! ち becomes ぢ (ji) and つ becomes づ (zu), both rare.", kana: [
      ["だ", "da"], ["ぢ", "ji", ["di", "dzi", "zi"]], ["づ", "zu", ["du", "dzu"]], ["で", "de"], ["ど", "do"],
    ]},
    { id: "b", label: "ば", name: "B (dakuten)", kind: "dakuten", note: "は + ゛: laughing 'ha ha' at a bar (ba)...", kana: [
      ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
    ]},
    { id: "p", label: "ぱ", name: "P (han-dakuten)", kind: "dakuten", note: "は + ゜: ...gets you punched (pa). The circle is the fist.", kana: [
      ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
    ]},
  ];

  // Combination kana from an い-row kana plus small ゃゅょ [き + ゃ = kya].
  const youon = [
    ["ky", "き", "ky", ["ky"]], ["sh", "し", "sh", ["sy"]], ["ch", "ち", "ch", ["ty", "cy"]],
    ["ny", "に", "ny", []], ["hy", "ひ", "hy", []], ["my", "み", "my", []], ["ry", "り", "ry", []],
    ["gy", "ぎ", "gy", []], ["j", "じ", "j", ["jy", "zy"]], ["by", "び", "by", []], ["py", "ぴ", "py", []],
  ];
  for (const [id, base, cons, alts] of youon) {
    const baseRomaji = groups.flatMap((g) => g.kana).find((k) => k[0] === base)[1];
    groups.push({
      id: "y-" + id, label: base + "ゃ", name: `${base}ゃ ${base}ゅ ${base}ょ`, kind: "youon",
      note: `${base} (${baseRomaji}) + small ゃゅょ: drop the i sound.`,
      kana: [["ゃ", "a"], ["ゅ", "u"], ["ょ", "o"]].map(([small, v]) => [base + small, cons + v, alts.map((a) => a + v)]),
    });
  }

  const KANA = [];
  for (const g of groups) {
    g.kana = g.kana.map(([kana, romaji, alts = [], mnemonic = "", lookalike = ""]) => {
      const k = { kana, romaji, accept: [romaji, ...alts], mnemonic: mnemonic || g.note || "", lookalike, group: g.id, kind: g.kind };
      KANA.push(k);
      return k;
    });
  }

  const ids = (kind) => groups.filter((g) => g.kind === kind).map((g) => g.id);
  const main = ids("main");
  const upTo = (id) => main.slice(0, main.indexOf(id) + 1);

  // Steps of the guide; tasks are what it asks you to do after each one [step 2: quiz あ and か five times].
  const LESSONS = [
    { title: "あ い う え お", sub: "The vowels", groups: ["a"], sheet: "vowels",
      intro: "Every other kana is built on these five sounds, so get them solid first. Say each one out loud as you go.",
      tasks: [{ quiz: upTo("a"), rounds: 5, text: "Quiz the vowels five times." }] },
    { title: "か き く け こ", sub: "K-column", groups: ["k"], sheet: "k",
      intro: "Consonant + vowel from here on: k plus the five vowels.",
      tasks: [{ quiz: upTo("k"), rounds: 5, text: "Quiz あ and か columns five times." }] },
    { title: "さ し す せ そ", sub: "S-column", groups: ["s"], sheet: "s",
      intro: "The first exception: し is shi, not si. Do the worksheet with real breaks; recall after a pause is what makes it stick.",
      tasks: [{ quiz: upTo("s"), rounds: 5, text: "Quiz あ, か and さ columns five times." }] },
    { title: "た ち つ て と", sub: "T-column", groups: ["t"], sheet: "t",
      intro: "Two exceptions: ち is chi and つ is tsu. That's 20 kana — a quarter of the way there.",
      tasks: [{ quiz: upTo("t"), rounds: 5, text: "Quiz all four columns five times." }] },
    { title: "な に ぬ ね の", sub: "N-column", groups: ["n"], sheet: null,
      intro: "Watch the loops: ぬ vs め and ね vs れ vs わ are the classic mix-ups.",
      tasks: [{ quiz: upTo("n"), rounds: 3, text: "Quiz five columns three times." }] },
    { title: "は ひ ふ へ ほ", sub: "H-column", groups: ["h"], sheet: "nh",
      intro: "ふ sits between f and h — let air out of your lips without touching them.",
      tasks: [{ quiz: upTo("h"), rounds: 3, text: "Quiz six columns, and time yourself to beat your score." }] },
    { title: "ま み む め も や ゆ よ", sub: "M & Y-columns", groups: ["m", "y"], sheet: "my",
      intro: "Y has only three kana: や ゆ よ. The yi and ye spots are empty.",
      tasks: [{ quiz: upTo("y"), rounds: 3, text: "Quiz eight columns three times." }] },
    { title: "ら り る れ ろ", sub: "R-column", groups: ["r"], sheet: null,
      intro: "Japanese r is a quick tap of the tongue, halfway between r, l and d.",
      tasks: [{ quiz: upTo("r"), rounds: 3, text: "Quiz nine columns three times." }] },
    { title: "わ を ん", sub: "W & N", groups: ["w"], sheet: "rwn",
      intro: "を sounds like お and is almost only a particle. ん is the only lone consonant; type nn when a vowel or y follows.",
      tasks: [{ quiz: main, rounds: 1, text: "Quiz all 46 main kana as fast as you can." }] },
    { title: "が ざ だ ば ぱ", sub: "Dakuten & han-dakuten", groups: ids("dakuten"), sheet: "dakuten",
      intro: "Two dashes (゛) voice a sound: k→g, s→z, t→d, h→b. A small circle (゜) turns h into p.",
      tasks: [{ quiz: ids("dakuten"), rounds: 3, text: "Quiz only the dakuten kana for 5–10 minutes." },
              { quiz: [...main, ...ids("dakuten")], rounds: 1, text: "Then mix them in with everything." }] },
    { title: "きゃ しゅ ちょ", sub: "Combination kana", groups: ids("youon"), sheet: "youon",
      intro: "An い-row kana plus a small ゃ, ゅ or ょ blends into one syllable: drop the i. き + ゃ = kya, not kiya.",
      tasks: [{ quiz: ids("youon"), rounds: 2, text: "Quiz the combinations twice." }] },
    { title: "っ", sub: "Small tsu", groups: [], sheet: null, smallTsu: true,
      intro: "A small っ is a short pause that doubles the next consonant. It has no sound of its own.",
      tasks: [] },
  ];

  // Word pairs the guide uses to show the small-tsu pause [かこ kako vs かっこ kakko].
  const SMALL_TSU = [["したい", "しったい"], ["かこ", "かっこ"], ["いた", "いった"], ["いしょ", "いっしょ"]];

  window.HIRAGANA = { groups, KANA, LESSONS, SMALL_TSU, ids, main };
})();
