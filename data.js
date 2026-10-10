// Kana, mnemonics and lesson order after Tofugu's hiragana and katakana guides [234 kana in 21 steps].
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
    ["ky", "き", "ky", []], ["sh", "し", "sh", ["sy"]], ["ch", "ち", "ch", ["ty", "cy"]],
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

  groups.forEach((g) => { g.script = "hiragana"; });

  // Katakana sit one code point block above hiragana [か 0x304b = カ 0x30ab].
  const toKata = (s) => [...s].map((c) => {
    const n = c.codePointAt(0);
    return n >= 0x3041 && n <= 0x3096 ? String.fromCodePoint(n + 0x60) : c;
  }).join("");

  // Katakana mnemonics after Tofugu's katakana guide: [mnemonic, look-alike].
  const KATA = {
    ア: ["A capital A, tipped over on its side.", "マ closes the corner; ア's stroke runs through it."],
    イ: ["An eagle (ea) standing on a branch.", ""],
    ウ: ["う with a flat roof, and the same sound.", "ワ has no tick on top."],
    エ: ["The end of a steel girder an engineer builds with.", ""],
    オ: ["An opera singer belting out Ohhh!", ""],
    カ: ["か without its little extra stroke.", "力 is the kanji for power."],
    キ: ["A strange key, like the top half of き.", ""],
    ク: ["A cook's tall hat.", "タ has an extra stroke inside; ケ has a flat top."],
    ケ: ["It looks like the letter K.", "ク and タ curve over the top."],
    コ: ["Two 90-degree corners.", "ユ has its bar at the bottom; ロ is a closed box."],
    サ: ["Two fish on a skewer: a sardine and a salmon.", ""],
    シ: ["A face with both eyes stacked sideways: she has a weird face.", "ツ's dashes stand up; シ's lie flat and its stroke sweeps up from the bottom."],
    ス: ["Superman's empty supersuit striding through the sky.", "ヌ has an extra slash."],
    セ: ["Almost the same as せ.", ""],
    ソ: ["One needle and thread to sew with. Needles stand up.", "ン's dash lies flat and its stroke rises from the bottom."],
    タ: ["A taco-shaped kite (tako means kite).", "ク has nothing inside."],
    チ: ["A cheerleader mid-cheer.", "テ has a flat top line."],
    ツ: ["Two needles and thread. Needles stand up.", "シ's dashes lie flat."],
    テ: ["A telephone pole.", "チ has a slanted top."],
    ト: ["A totem pole.", ""],
    ナ: ["A narwhal surfacing.", "メ is crossed at an angle."],
    ニ: ["Two needles lying on their side.", "二 is the kanji for two."],
    ヌ: ["Chopsticks pulling noodles out of a bowl.", "ス has no slash."],
    ネ: ["A horse jumping a hurdle: neigh!", ""],
    ノ: ["A long nose.", ""],
    ハ: ["A rice-paddy hat, split down the middle.", ""],
    ヒ: ["A cheeky grin: hee hee.", ""],
    フ: ["A triangle flag waving: hooray!", "ワ has a stroke on the left; ウ a tick on top."],
    ヘ: ["Exactly the same as へ.", ""],
    ホ: ["A holy cross giving off light.", ""],
    マ: ["All those angles and lengths: math.", "ア's stroke runs through the corner."],
    ミ: ["Three missiles flying at you.", ""],
    ム: ["A cow's face with a big snout: moo.", ""],
    メ: ["An X over your eye (me means eye).", "ナ is upright; ヌ has a top."],
    モ: ["Close to も.", ""],
    ヤ: ["や minus a little line.", ""],
    ユ: ["You, with a pirate's hook for a hand.", "コ opens to the left; ヨ has three bars."],
    ヨ: ["A yogi in a boxy yoga pose.", "ユ has two bars."],
    ラ: ["A raptor in sunglasses, like a rapper.", "フ has no bar on top; ヲ has two bars."],
    リ: ["Almost the same as り.", ""],
    ル: ["Two routes side by side.", "レ is only the right half."],
    レ: ["Rei's long red hair flowing.", "ル has a second stroke."],
    ロ: ["A square road with no end.", "コ is open on the left; 口 is the kanji for mouth."],
    ワ: ["A question mark: what?", "ウ has a tick on top; フ no stroke on the left."],
    ヲ: ["A dog woofing so hard its tongue flies out: oh!", "ラ has one bar."],
    ン: ["A man with one eye, winking.", "ソ's dash stands up; ン's lies flat and its stroke rises from the bottom."],
  };
  const KATA_NOTES = {
    g: "カ + ゛ = ガ, exactly like か and が.", z: "サ + ゛ = ザ. シ becomes ジ (ji).", d: "タ + ゛ = ダ. ヂ (ji) and ヅ (zu) are rare.",
    b: "ハ + ゛ = バ.", p: "ハ + ゜ = パ.",
  };
  const hiraGroups = groups.slice();
  for (const g of hiraGroups) {
    groups.push({
      id: "k-" + g.id, label: toKata(g.label), name: toKata(g.name), kind: g.kind, script: "katakana",
      note: g.kind === "youon" ? toKata(g.note) : KATA_NOTES[g.id] || "",
      kana: g.kana.map(([kana, romaji, alts]) => {
        const kk = toKata(kana);
        return [kk, romaji, alts, ...(KATA[kk] || [])];
      }),
    });
    if (g.id === "y-j") {
      groups.push({ id: "k-y-dj", label: "ヂャ", name: "ヂャ ヂュ ヂョ", kind: "youon", script: "katakana",
        note: "ヂ (ji) + small ャュョ. Rare, and said just like ジャ.",
        kana: [["ヂャ", "ja", ["dya", "jya", "zya"]], ["ヂュ", "ju", ["dyu", "jyu", "zyu"]], ["ヂョ", "jo", ["dyo", "jyo", "zyo"]]] });
    }
  }
  // Small vowels let katakana spell sounds Japanese lacks [フ + ァ = fa].
  const EXTENDED = [
    ["v", "ヴァ ヴィ ヴ ヴェ ヴォ", "ウ + ゛ = ヴ, plus small vowels for the v-sounds. Most speakers say them closer to b.",
      [["ヴァ", "va", ["bwa"]], ["ヴィ", "vi", ["bwi"]], ["ヴ", "vu", ["bu"]], ["ヴェ", "ve", ["bwe"]], ["ヴォ", "vo", ["bwo"]]]],
    ["w", "ウィ ウェ ウォ", "ウ + a small vowel for the w-sounds that わ and を don't cover.",
      [["ウィ", "wi"], ["ウェ", "we"], ["ウォ", "wo", ["uxo"]]]],
    ["f", "ファ フィ フェ フォ", "フ + a small vowel for every f-sound.",
      [["ファ", "fa"], ["フィ", "fi"], ["フェ", "fe"], ["フォ", "fo"]]],
    ["ts", "ツァ ツィ ツェ ツォ", "ツ + a small vowel, for Italian z and Chinese ts, as in モッツァレラ.",
      [["ツァ", "tsa", ["tza"]], ["ツィ", "tsi", ["tzi"]], ["ツェ", "tse", ["tze"]], ["ツォ", "tso", ["tzo"]]]],
    ["e", "シェ ジェ チェ", "シ, ジ and チ + a small ェ: shell, jelly, check.",
      [["シェ", "she"], ["ジェ", "je", ["jye"]], ["チェ", "che"]]],
    ["t", "ティ トゥ", "テ + small ィ and ト + small ゥ: party, two.",
      [["ティ", "ti", ["thi"]], ["トゥ", "tu", ["twu"]]]],
    ["dh", "ディ ドゥ", "デ + small ィ and ド + small ゥ: candy, dew.",
      [["ディ", "di", ["dhi"]], ["ドゥ", "du", ["dwu"]]]],
  ];
  for (const [id, name, note, kana] of EXTENDED) {
    groups.push({ id: "k-x-" + id, label: kana[0][0], name, kind: "extended", script: "katakana", note, kana });
  }

  const KANA = [];
  const romajiOf = new Map();
  // A dakuten kana past the first in its column, spelled from its plain kana [ぎ = "き (ki) + ゛ = ぎ (gi)."; ぴ is ひ + ゜, two code points up].
  const marked = (g, kana, romaji, i) => {
    if (g.kind !== "dakuten" || i === 0) return "";
    const hand = /han-dakuten/.test(g.name);
    const base = String.fromCodePoint(kana.codePointAt(0) - (hand ? 2 : 1));
    return `${base} (${romajiOf.get(base)}) + ${hand ? "゜" : "゛"} = ${kana} (${romaji}).`;
  };
  for (const g of groups) {
    g.kana = g.kana.map(([kana, romaji, alts = [], mnemonic = "", lookalike = ""], i) => {
      romajiOf.set(kana, romaji);
      const k = { kana, romaji, accept: [romaji, ...alts], mnemonic: mnemonic || marked(g, kana, romaji, i) || g.note || "", lookalike,
        group: g.id, kind: g.kind, script: g.script };
      KANA.push(k);
      return k;
    });
  }

  const ids = (kind, script = "hiragana") => groups.filter((g) => g.kind === kind && g.script === script).map((g) => g.id);
  const main = ids("main");
  const kmain = ids("main", "katakana");
  const upTo = (id) => main.slice(0, main.indexOf(id) + 1);
  const kUpTo = (id) => kmain.slice(0, kmain.indexOf(id) + 1);

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

  const kIds = (kind) => ids(kind, "katakana");
  // Katakana steps after Tofugu's katakana guide, ten kana at a time [step 1 is ア to コ].
  const KATA_LESSONS = [
    { title: "ア イ ウ エ オ カ キ ク ケ コ", sub: "Vowels & K", groups: ["k-a", "k-k"], sheet: "k-ak",
      intro: "Katakana spells foreign words and names: the same sounds as hiragana, in sharper shapes. Some, like カ and ヘ, are nearly their hiragana twin.",
      tasks: [{ quiz: kUpTo("k-k"), rounds: 3, text: "Quiz these ten three times." }] },
    { title: "サ シ ス セ ソ タ チ ツ テ ト", sub: "S & T", groups: ["k-s", "k-t"], sheet: "k-st",
      intro: "Here is the classic trap: シ and ツ, ソ and ン. Needles (ツ, ソ) stand up; faces (シ, ン) lie flat.",
      tasks: [{ quiz: kUpTo("k-t"), rounds: 3, text: "Quiz all twenty three times." }] },
    { title: "ナ ニ ヌ ネ ノ ハ ヒ フ ヘ ホ", sub: "N & H", groups: ["k-n", "k-h"], sheet: "k-nh",
      intro: "Mostly simple strokes. ヘ is identical to へ, and フ is a flag rather than a hula hoop.",
      tasks: [{ quiz: kUpTo("k-h"), rounds: 3, text: "Quiz all thirty three times." }] },
    { title: "マ ミ ム メ モ ヤ ユ ヨ", sub: "M & Y", groups: ["k-m", "k-y"], sheet: "k-my",
      intro: "ユ, ヨ and コ differ only in where the bars sit, so look twice.",
      tasks: [{ quiz: kUpTo("k-y"), rounds: 3, text: "Quiz all thirty-eight three times." }] },
    { title: "ラ リ ル レ ロ ワ ヲ ン", sub: "R, W & N", groups: ["k-r", "k-w"], sheet: "k-rwn",
      intro: "ル and レ are halves of each other, and ワ, ウ and フ differ by a single stroke.",
      tasks: [{ quiz: kmain, rounds: 1, text: "Quiz all 46 katakana as fast as you can." }] },
    { title: "ガ ザ ダ バ パ", sub: "Dakuten & han-dakuten", groups: kIds("dakuten"), sheet: null,
      intro: "These work exactly like hiragana's: k→g, s→z, t→d, h→b, and the circle makes h into p.",
      tasks: [{ quiz: kIds("dakuten"), rounds: 3, text: "Quiz the katakana dakuten." },
              { quiz: [...kmain, ...kIds("dakuten")], rounds: 1, text: "Then mix them in with all katakana." }] },
    { title: "キャ シュ チョ", sub: "Combination katakana", groups: kIds("youon"), sheet: null,
      intro: "The same rule as hiragana: an イ-row kana plus a small ャ, ュ or ョ, and the i drops out.",
      tasks: [{ quiz: kIds("youon"), rounds: 2, text: "Quiz the combinations twice." }] },
    { title: "ファ ティ ヴァ", sub: "Extended sounds", groups: kIds("extended"), sheet: null,
      intro: "Katakana stretches to cover foreign sounds by adding a small ァ, ィ, ゥ, ェ or ォ: fa, ti, wi, va. Being able to read them is enough for now.",
      tasks: [{ quiz: kIds("extended"), rounds: 2, text: "Quiz the extended sounds twice." }] },
    { title: "ー", sub: "Long vowels", groups: [], sheet: null, longVowel: true,
      intro: "Katakana marks a long vowel with a dash: stretch the vowel in front of it.",
      tasks: [] },
  ];
  // Pairs the guide uses for the long-vowel dash [チズ chizu vs チーズ chiizu, cheese].
  const LONG_VOWELS = [["チズ", "チーズ"], ["ベコン", "ベーコン"]];

  window.HIRAGANA = { groups, KANA, LESSONS, KATA_LESSONS, SMALL_TSU, LONG_VOWELS, ids, main, kmain };
})();
