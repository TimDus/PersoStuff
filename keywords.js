// Plain keywords for the kanji whose Heisig keyword is a coinage or contradicts its words or main reading, pure so node can test them [旦 nightbreak = dawn; 後 behind, read ゴ as in 午後 = after].
(function (root) {
  // No sense shared with another kanji's keyword, as a review asks it to recall one kanji [中 middle, inside beside 内 within].
  const PLAIN = {
    旦: "dawn", 中: "middle, inside", 内: "within", 乙: "the second, B", 升: "measuring box, 1.8 L", 寸: "inch", 斗: "dipper, 18 L",
    尺: "Japanese foot, 30 cm", 召: "summon", 介: "mediate", 然: "in that way", 里: "hometown, countryside", 向: "facing, toward",
    相: "mutual", 暮: "dusk, make a living", 丁: "exact, careful", 直: "fix, straight", 炎: "flame", 計: "measure, total",
    話: "talk", 調: "check, tune", 歴: "career", 誕: "birth", 章: "composition, badge", 歳: "years of age",
    記: "record", 達: "attain, plural", 着: "wear, arrive", 準: "prepare, semi-", 確: "certain", 困: "troubled",
    必: "without fail", 存: "exist, be aware", 更: "renew, further", 弁: "dialect, speech", 治: "govern, cure",
    致: "humbly do", 列: "queue", 趣: "hobby, taste", 漫: "cartoon, rambling",
    寧: "courteous", 敬: "revere", 警: "warn", 式: "ceremony, style", 市: "city, market", 競: "compete",
    洋: "Western, ocean", 誌: "magazine", 律: "regulation", 徒: "follower, pupil", 私: "I, private",
    奥: "inner part", 様: "polite Mr., way", 仕: "serve", 以: "from, by means of",
    瓶: "bottle, vase", 屋: "shop, roof", 房: "chamber", 戻: "go back", 礼: "thanks, etiquette", 察: "inspect, guess",
    由: "reason", 申: "humbly say", 質: "quality, substance", 当: "fitting, the very", 君: "you, -kun", 画: "drawing, stroke",
    曲: "bend, melody", 料: "materials, fee", 渡: "cross over, hand over", 矢: "arrow", 沸: "boil", 号: "serial number",
    暑: "hot weather", 校: "school", 院: "institution", 階: "storey, stairs", 探: "search", 緒: "cord",
    経: "go by, experience", 細: "slender, fine", 通: "pass through", 興: "interest, revive", 節: "joint, period",
    館: "large building", 辞: "term, resign", 性: "nature, gender", 軒: "house counter, eaves", 険: "steep",
    匹: "small-animal counter", 発: "start off, emit", 対: "versus, opposite", 楽: "enjoy, music", 変: "weird, alter",
    供: "offer, attend", 承: "consent", 弾: "pluck, bullet", 驚: "surprise", 魔: "demon", 鬼: "ogre",
    辺: "area, vicinity", 覧: "view",
    拶: "greeting", 踊: "dancing", 至: "reach, as far as", 我: "my, our", 身: "physical self, standing", 伯: "elder uncle, count",
    乾: "dry out, toast (乾杯)", 薄: "thin, diluted", 故: "accident, bygone", 平: "flat, level", 安: "peaceful, cheap",
    貼: "stick, paste", 典: "canon, rule book", 凄: "tremendous", 碗: "bowl", 斉: "uniform, alike",
    原: "origin, meadow", 鳴: "ring, chirp", 為: "for the sake of, do", 又: "also, once more", 爪: "nail, claw",
    面: "mask, facet", 丈: "sturdy, length", 研: "hone", 番: "number in order, on duty",
    布: "cloth", 段: "tier, rank", 後: "after", 方: "manner, direction", 長: "chief, long", 円: "yen, circle", 空: "sky, empty",
    答: "answer", 代: "era, substitute", 文: "text, sentence", 足: "foot, leg",
  };
  // The keyword a kanji shows: the plain one, else Heisig's, else KANJIDIC's meaning [旦 dawn; 学 study; 学 before Koohii's file, study, learning].
  const keywordOf = (c, koohii, info) => PLAIN[c] || koohii?.[c]?.kw || info?.[c]?.m || "";
  const api = { PLAIN, keywordOf };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraKeywords = api;
})(this);
