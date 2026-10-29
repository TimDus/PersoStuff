// The Particles tab's steps: a short lesson per pair of particles that get mixed up, in our own words [は・が, に・へ].
(function (root) {
  const { SENTENCES } = typeof module !== "undefined" ? require("./particles.js") : root.HiraParticles;

  const STEPS = [
    {
      id: "wa-ga", title: "は and が: topic and subject", particles: ["は", "が"], tofugu: [["は", "particle-wa"]],
      intro: "A particle sits after a word and says what that word does in the sentence. は (written は, read わ) marks the topic, what you're talking about: \"as for this…\". が marks the subject, who or what does or is something, and puts the weight on it.",
      rules: [
        "は for the topic, often something already known, with the news after it [私は学生です, I am a student; トイレはどこですか, where is the toilet?].",
        "が after a question word, since it is the new part [誰が来ましたか, who came?].",
        "が for what exists with あります and います [机の上に本があります], and for what is liked, understood or had with 好き, わかる and ある [犬が好きです].",
        "が for something happening that you just see or report [雨が降っています, it's raining].",
      ],
      mistake: "A question word never takes は: 誰が来ましたか, never 誰は. And the answer to a が question keeps が [田中さんが来ました].",
    },
    {
      id: "wo", title: "を: the object", particles: ["を"], tofugu: [["を", "particle-wo"]],
      intro: "を (read お) marks the thing an action is done to: what you drink, buy or watch. It also marks the space you move through and the place you leave.",
      rules: [
        "Object + を + verb [水を飲みます, I drink water; パンを買いました].",
        "A space you move along or across [道を渡ります, I cross the road; 公園を散歩します].",
        "A place you leave or get off [家を出ます, バスを降ります]; から works there too.",
      ],
      mistake: "好き, わかる and ほしい take が, not を: 犬が好きです, 日本語がわかります.",
    },
    {
      id: "ni-he", title: "に and へ: time, destination, target", particles: ["に", "へ"], tofugu: [["に", "particle-ni"], ["へ", "particle-he"]],
      intro: "に marks a point something lands on: a clock time, the place you arrive at, the person who receives something. へ (read え) only means direction, \"towards\".",
      rules: [
        "A clock time or a date [九時に寝ます, I go to bed at nine]. Relative times like 明日 and 毎朝 take none.",
        "Where you go, with 行く, 来る, 帰る and 入る; へ fits here too [学校に行きます = 学校へ行きます].",
        "The person something goes to [友だちにあげました, 母に電話しました], or comes from with もらう [兄に本をもらいました], what you get on or into [電車に乗ります], and what you become [医者になりたい].",
      ],
      mistake: "に marks where you go, not where you do something: 図書館で勉強します, never 図書館に勉強します.",
    },
    {
      id: "de", title: "で: where it happens, and with what", particles: ["で"], tofugu: [["で", "particle-de"]],
      intro: "で marks the place where an action happens, and the means it's done with: a bus, chopsticks, a language.",
      rules: [
        "The place of an action [図書館で勉強します, I study at the library].",
        "The means or tool [バスで行きます, by bus; はしで食べます, with chopsticks; 日本語で話してください].",
        "How many people did it [一人で旅行しました, I travelled alone].",
      ],
      mistake: "Being somewhere takes に, doing something there takes で: 部屋に猫がいます, but 部屋で寝ます.",
    },
    {
      id: "to-ya", title: "と and や: and, and with", particles: ["と", "や"], tofugu: [["と", "particle-to"], ["や", "particle-ya"]],
      intro: "Both join nouns into a list. と means the list is complete; や means these among others, often closed with など. と also means \"with\" a person.",
      rules: [
        "と for a whole list [りんごとバナナを買いました, just those two].",
        "や for a list that leaves things out [本や雑誌を読みます, books, magazines and the like].",
        "と for doing something with someone [友だちと映画を見ました]; 話す with a person takes と or に.",
      ],
      mistake: "As \"and\", と and や join nouns only; two actions join with the て form [食べて、飲みました].",
    },
    {
      id: "mo", title: "も: too, also", particles: ["も"], tofugu: [["も", "particle-mo"]],
      intro: "も means \"too\" or \"also\". It takes the place of は, が or を, and follows other particles.",
      rules: [
        "In place of は, が or を [私も行きます, I'll go too; 父も医者です].",
        "After に, で and others, which stay [日本にも行きました, I went to Japan too].",
        "Twice for \"both … and …\", or with a negative \"neither … nor …\" [兄も姉も学生です; りんごもバナナも食べません].",
      ],
      mistake: "Never stack も on は, が or を: 私も, never 私はも or 私がも.",
    },
    {
      id: "kara-made", title: "から and まで: from and until", particles: ["から", "まで"], tofugu: [["から", "particle-kara"]],
      intro: "から marks where or when something starts, まで where or when it ends. They often come as a pair [九時から五時まで].",
      rules: [
        "から for a starting point in place or time [アメリカから来ました; 月曜日から金曜日まで働きます].",
        "まで for an end point, \"as far as\" or \"until\" [駅まで歩きます; 五時まで待ちます].",
        "から also marks where something comes from, like a person who gives it [兄から本をもらいました]; に works there too.",
      ],
      mistake: "まで is \"until\", an action going on up to then; a deadline, \"by\", is までに [五時までに来てください].",
    },
    {
      id: "no-yori", title: "の and より: of, and than", particles: ["の", "より"],
      intro: "の joins two nouns, the first describing the second: whose it is, what kind, where from. より marks what something is compared against, \"than\".",
      rules: [
        "Noun の noun, the owner or kind first [私の本, my book; 日本の車, Japanese cars; 日本語の先生, a Japanese teacher].",
        "A question word works the same [誰の傘ですか, whose umbrella?].",
        "X は Y より: Y is what X is measured against, so より follows the one that loses [東京は大阪より大きいです, Tokyo is bigger than Osaka].",
      ],
      mistake: "の goes between nouns only; an い-adjective meets its noun straight and a な-adjective takes な [高い本, 静かな町, never 高いの本].",
    },
  ];

  const meets = (c, list) => c.ok.some((p) => list.includes(p));
  const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // The sentences a step teaches, any of its particles right [に・へ: 学校＿行きます and 九時＿寝ます].
  const own = (step) => SENTENCES.filter((c) => meets(c, step.particles));
  // A card with only the taught particles right, the rest kept off its choices [公園＿散歩します in Step 2: を, and で never offered].
  const narrow = (c, taught) => ({ ...c, ok: c.ok.filter((p) => taught.includes(p)), near: [...c.near, ...c.ok.filter((p) => !taught.includes(p))] });

  // A step's 10 cards: up to 6 its own, the rest earlier steps', so the answer changes [を: 6 を cards, 4 は or が].
  function stepQueue(step, rand = Math.random) {
    const i = STEPS.indexOf(step), mine = shuffle(own(step), rand);
    const before = STEPS.slice(0, i).flatMap((s) => s.particles);
    const earlier = shuffle(SENTENCES.filter((c) => !meets(c, step.particles) && meets(c, before)), rand);
    const take = Math.min(mine.length, i ? 6 : 10);
    const picked = [...mine.slice(0, take), ...earlier.slice(0, 10 - take)];
    const taught = [...before, ...step.particles];
    return shuffle([...picked, ...mine.slice(take, take + 10 - picked.length)], rand).map((c) => narrow(c, taught));
  }

  // The finished steps' own sentences together, at most 20 [Steps 1 and 6: は, が and も cards only].
  const reviewQueue = (steps, rand = Math.random) => {
    const taught = steps.flatMap((s) => s.particles);
    return shuffle(SENTENCES.filter((c) => meets(c, taught)), rand).slice(0, 20).map((c) => narrow(c, taught));
  };

  const api = { STEPS, own, narrow, stepQueue, reviewQueue };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraParticleLessons = api;
})(this);
