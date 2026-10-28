// The Verbs tab's steps: a short lesson per form, in our own words, and its examples worked on real words [飲む → 飲みます].
(function (root) {
  const conj = typeof module !== "undefined" ? require("./conj.js") : root.HiraConj;
  const { classOf, conjugate } = conj;

  const STEPS = [
    {
      id: "masu", title: "Verb groups and ます", forms: ["masu"], kinds: ["verb"], tofugu: "masu",
      intro: "Every verb's dictionary form ends in an う-row kana [飲む, 食べる, する]. How it changes depends on its group, so spot the group first. ます is the polite ending for people you don't know well: 飲みます is \"(I) drink\" or \"(I) will drink\", since Japanese has no separate future.",
      rules: [
        "る-verbs end in いる or える: drop the る and add ます [食べる → 食べます, 見る → 見ます].",
        "う-verbs are all the rest: move the last kana to its い-row and add ます [飲む → 飲みます, 書く → 書きます, 待つ → 待ちます].",
        "Irregular: する → します and 来る → きます. A noun with する works the same [勉強する → 勉強します].",
      ],
      mistake: "Some verbs end in いる or える and are still う-verbs: 帰る, 入る, 走る, 知る, 切る. They give 帰ります, never 帰ます.",
    },
    {
      id: "masen", title: "Polite negative: ません", forms: ["masen"], kinds: ["verb"], tofugu: "masu",
      intro: "ません is ます's \"not\": 飲みません is \"(I) don't drink\" or \"(I) won't drink\".",
      rules: ["Make the ます form, then swap ます for ません [食べます → 食べません, 行きます → 行きません, します → しません]."],
      mistake: "Only the ending changes; the part before it stays as in ます [飲みません, never 飲まません].",
    },
    {
      id: "past", title: "Polite past: ました, ませんでした", forms: ["mashita", "masendeshita"], kinds: ["verb"], tofugu: "masu",
      intro: "ました is \"did\" and ませんでした \"didn't\": 飲みました is \"(I) drank\", 飲みませんでした \"(I) didn't drink\".",
      rules: [
        "ます → ました [食べます → 食べました].",
        "ません → ませんでした, which is ません plus でした, the past of です [食べません → 食べませんでした].",
      ],
      mistake: "The past negative keeps the whole ません [ませんでした, not ませんした or ましたでした].",
    },
    {
      id: "te", title: "て form", forms: ["te"], kinds: ["verb"], tofugu: "te-form",
      intro: "The て form joins actions (\"…and then…\") and builds many patterns, like ～てください \"please do\" and ～ている \"is doing\". It has no tense of its own.",
      rules: [
        "る-verbs: drop る, add て [食べる → 食べて].",
        "う-verbs by their last kana: う つ る → って [買って, 待って, 帰って]; む ぶ ぬ → んで [飲んで, 遊んで, 死んで]; く → いて [書いて]; ぐ → いで [泳いで]; す → して [話して].",
        "Irregular: する → して, 来る → きて.",
      ],
      mistake: "行く is the one く-verb that takes って: 行って, never 行いて.",
    },
    {
      id: "nai", title: "Plain negative: ない", forms: ["nai"], kinds: ["verb"], tofugu: "verb-negative-nai-form",
      intro: "ない is the casual \"not\", for friends and family and inside longer sentences: 飲まない is \"(I) don't drink\".",
      rules: [
        "る-verbs: drop る, add ない [食べる → 食べない].",
        "う-verbs: move the last kana to its あ-row and add ない [飲む → 飲まない, 書く → 書かない].",
        "Irregular: する → しない, 来る → こない, and ある (there is) → ない on its own.",
      ],
      mistake: "A verb ending in う takes わ, not あ [買う → 買わない, never 買あない].",
    },
    {
      id: "ta", title: "Plain past: た, なかった", forms: ["ta", "nakatta"], kinds: ["verb"], tofugu: "verb-past-ta-form",
      intro: "た is the casual \"did\" and なかった the casual \"didn't\": 飲んだ, 飲まなかった.",
      rules: [
        "た: make the て form and swap て for た, で for だ [食べて → 食べた, 飲んで → 飲んだ, 行って → 行った].",
        "なかった: make the ない form and swap ない for なかった [飲まない → 飲まなかった].",
      ],
      mistake: "Build た from the て form, not from the dictionary form [書く → 書いて → 書いた, never 書った].",
    },
    {
      id: "adj-i", title: "い-adjectives", forms: ["nai", "ta", "nakatta", "te"], kinds: ["adj-i"],
      intro: "An い-adjective ends in い and changes that い itself, much like a verb [高い, high or expensive].",
      rules: [
        "Not: い → くない [高くない]. Past: い → かった [高かった]. Past not: い → くなかった [高くなかった].",
        "て form: い → くて, \"…and…\" [高くて].",
        "いい (good) changes as よい [よくない, よかった].",
      ],
      mistake: "Polite only adds です after the form [高くないです, 高かったです]; 高いでした is wrong.",
    },
    {
      id: "adj-na", title: "な-adjectives", forms: ["nai", "ta", "nakatta", "te"], kinds: ["adj-na"],
      intro: "A な-adjective works like a noun: the word stays as it is and the ending goes after it [静か, quiet].",
      rules: [
        "Not: + じゃない [静かじゃない]; ではない is the same, more formal.",
        "Past: + だった [静かだった]. Past not: + じゃなかった [静かじゃなかった].",
        "て form: + で [静かで].",
      ],
      mistake: "Some な-adjectives end in い and still don't change it [きれいじゃない, 嫌いじゃない, never きれくない].",
    },
    {
      id: "potential", title: "Potential: can do", forms: ["potential"], kinds: ["verb"],
      intro: "\"Can\": 泳げる is \"(I) can swim\". The result is a る-verb of its own, so it takes ます, ない and the rest.",
      rules: [
        "る-verbs: る → られる [食べる → 食べられる].",
        "う-verbs: last kana to its え-row, then る [飲む → 飲める, 書く → 書ける].",
        "Irregular: する → できる, 来る → こられる.",
      ],
      mistake: "What you can do usually takes が, not を [日本語が話せる].",
    },
    {
      id: "volitional", title: "Volitional: let's", forms: ["volitional"], kinds: ["verb"],
      intro: "The casual \"let's\" or \"I think I'll\": 行こう is \"let's go\". The polite one is ましょう [行きましょう].",
      rules: [
        "る-verbs: る → よう [食べる → 食べよう].",
        "う-verbs: last kana to its お-row, then う [飲む → 飲もう, 書く → 書こう].",
        "Irregular: する → しよう, 来る → こよう.",
      ],
      mistake: "The う is a long vowel, not a second word [行こう is いこう, said ikō].",
    },
    {
      id: "ba", title: "ば conditional: if", forms: ["ba"], kinds: ["verb", "adj-i"],
      intro: "\"If\", leaning on the condition: 安ければ買う is \"(I'll) buy it if it's cheap\".",
      rules: [
        "Verbs: last kana to its え-row, then ば [飲む → 飲めば, 食べる → 食べれば, する → すれば, 来る → くれば].",
        "い-adjectives: い → ければ [高い → 高ければ].",
      ],
      mistake: "A る-verb keeps its る's row change too [食べれば, not 食べば].",
    },
    {
      id: "tara", title: "たら conditional: if, when", forms: ["tara"], kinds: ["verb", "adj-i", "adj-na"],
      intro: "\"If\" or \"when…, then\", the everyday one: 雨が降ったら is \"if it rains\" or \"when it rains\".",
      rules: [
        "Make the plain past and add ら [飲んだ → 飲んだら, 食べた → 食べたら].",
        "Adjectives the same way [高かった → 高かったら, 静かだった → 静かだったら].",
      ],
      mistake: "It is built on the past, but the time comes from the rest of the sentence [明日雨が降ったら is about tomorrow].",
    },
    {
      id: "passive", title: "Passive: is done to", forms: ["passive"], kinds: ["verb"],
      intro: "Something done to the subject: 先生に叱られた is \"(I) was scolded by the teacher\". Japanese also uses it when something annoying happens to you [雨に降られた, got rained on].",
      rules: [
        "る-verbs: る → られる [食べる → 食べられる], the same as their potential.",
        "う-verbs: last kana to its あ-row, then れる [飲む → 飲まれる, 買う → 買われる].",
        "Irregular: する → される, 来る → こられる.",
      ],
      mistake: "The one who does it takes に [犬に噛まれた, bitten by a dog].",
    },
    {
      id: "causative", title: "Causative: make or let", forms: ["causative"], kinds: ["verb"],
      intro: "Making or letting someone do it: 子供に野菜を食べさせる is \"make the child eat vegetables\".",
      rules: [
        "る-verbs: る → させる [食べる → 食べさせる].",
        "う-verbs: last kana to its あ-row, then せる [飲む → 飲ませる, 買う → 買わせる].",
        "Irregular: する → させる, 来る → こさせる.",
      ],
      mistake: "Like ない, a verb ending in う takes わ [買わせる, never 買あせる].",
    },
    {
      id: "imperative", title: "Imperative: do it!", forms: ["imperative"], kinds: ["verb"],
      intro: "A blunt order, heard from coaches, on signs and in anime more than in polite talk: 止まれ is \"stop!\".",
      rules: [
        "る-verbs: る → ろ [食べる → 食べろ].",
        "う-verbs: last kana to its え-row [飲む → 飲め, 書く → 書け].",
        "Irregular: する → しろ, 来る → こい.",
      ],
      mistake: "Said to a person it is rude; ～てください asks politely [食べてください].",
    },
  ];

  // A word's group as the lessons name it [帰る: う-verb; 勉強: irregular, as 勉強する].
  const groupOf = (w) => {
    const c = classOf(w) || "";
    return c.startsWith("v1") ? "る-verb" : c.startsWith("v5") ? "う-verb" : /^(vk|vs)/.test(c) ? "irregular"
      : c === "adj-na" ? "な-adjective" : c.startsWith("adj") ? "い-adjective" : null;
  };
  const GROUPS = { verb: ["う-verb", "る-verb"], "adj-i": ["い-adjective"], "adj-na": ["な-adjective"] };

  // One word per group the step drills, a met one first, else the list's first; verbs end on する and 来る [masu: 飲む 食べる する 来る].
  function examples(words, step, isMet) {
    const withForms = (word) => {
      const forms = step.forms.map((f) => conjugate(word, f));
      return forms.every(Boolean) ? { word, group: groupOf(word), forms } : null;
    };
    const out = [];
    for (const kind of step.kinds) {
      for (const g of GROUPS[kind]) {
        const usable = words.filter((w) => groupOf(w) === g && withForms(w));
        const word = usable.find((w) => isMet(w.k)) || usable[0];
        if (word) out.push(withForms(word));
      }
      if (kind === "verb") out.push(...["する|する", "来る|くる"].map((k) => withForms(words.find((w) => w.k === k))).filter(Boolean));
    }
    return out;
  }

  const api = { STEPS, examples, groupOf };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraVerbLessons = api;
})(this);
