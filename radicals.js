// Names for the kanji parts that aren't deck kanji, pure so node can test them [近's ⻌ = road, movement].
(function (root) {
  // A shape's name, KANJIDIC's meaning reworded where it says only "radical (no. 40)" [宀 = roof].
  const NAMES = {
    "⻌": "road, movement", "丿": "a falling stroke", "宀": "roof", "艹": "grass, plants", "亠": "lid", "厶": "private, self",
    "冖": "crown, cover", "丶": "dot", "丨": "vertical stroke", "攵": "strike, action", "广": "shelter", "厂": "cliff",
    "𠂊": "bent top", "⺕": "hand, the ヨ shape", "囗": "enclosure", "冂": "upside-down box", "彳": "going, a step",
    "尸": "corpse, a bent body", "匕": "spoon", "夂": "slow walk", "禾": "grain", "𠂉": "slanted top",
    "頁": "head, now page", "乂": "cross, cutting", "卩": "kneeling person, seal", "亅": "hook", "廾": "two hands",
    "⻏": "village, on the right", "勹": "wrap", "云": "cloud, say", "卜": "divining", "龶": "a 生-like top", "⺍": "three strokes",
    "廿": "twenty", "艮": "stopping", "隹": "small bird", "匸": "box open on the right", "戈": "halberd", "罒": "net",
    "聿": "brush", "疒": "illness", "廴": "long stride", "凵": "open box", "开": "two pillars",
    "冫": "ice", "关": "barrier, connection", "幺": "short thread, small", "帚": "broom", "儿": "legs", "业": "work, 業 simplified",
    "彡": "hair, streaks", "㑒": "all together", "耂": "old, the top of 老", "歹": "bare bone, death", "酉": "wine jar",
    "殳": "hand with a pole", "甬": "passage", "复": "return, again", "卯": "rabbit of the zodiac", "勿": "must not", "袁": "long robe",
    "㕣": "marsh, hollow", "豕": "pig", "𠦝": "sunrise through grass", "几": "table, wind", "气": "steam, breath", "虍": "tiger",
    "圣": "warp threads", "冓": "framework", "冋": "tall building", "乍": "sudden", "从": "two people", "戋": "small, slice",
    "弋": "stake", "𡗗": "the top of 春", "⺦": "split wood", "昜": "sunrise, open", "㓁": "net, hollow", "疋": "foot",
    "埶": "planting, power", "兌": "exchange", "龰": "foot", "翟": "pheasant", "也": "to be, classical", "勺": "ladle",
    "癶": "outstretched legs", "咅": "spit, split", "毋": "do not", "マ": "the マ shape", "矣": "a classical particle",
    "夗": "curled up", "韋": "tanned leather", "丆": "one and a slash", "习": "feather, half of 羽", "戉": "battle-axe", "龷": "the top of 黄",
    "昷": "warm", "叚": "borrow, false", "哥": "elder brother", "咼": "crooked mouth", "寉": "crane", "卦": "divination sign",
    "奐": "bright, change", "彦": "fine young man", "戍": "guarding soldier", "甶": "ghost head", "喬": "tall", "夹": "pressed between",
    "竟": "end, finally", "菫": "violet, clay", "禺": "monkey", "尹": "official", "苟": "be on guard", "奚": "servant",
    "卬": "look up", "夬": "decide, cut", "縣": "county, hanging", "肙": "small worm", "鹵": "salt", "乎": "call out",
    "胡": "foreign", "吾": "I, my", "蒦": "seize", "兀": "high and bare", "𢆉": "the bottom of 幸", "巷": "alley",
    "丂": "breath held back", "夅": "descend", "昏": "dusk", "坐": "sit", "冉": "slowly rising", "戌": "dog of the zodiac",
    "巛": "river", "而": "beard, and yet", "尗": "bean sprout, younger", "佰": "hundred", "朮": "millet", "隼": "falcon",
    "劵": "tired", "尭": "high", "夭": "young, bending", "㐮": "help", "吊": "hang", "巴": "coiled snake",
    "辰": "dragon of the zodiac", "陏": "melon", "娄": "count, many", "巽": "southeast, gentle", "叟": "old man", "乇": "rely on",
    "朋": "friend", "爰": "pull, lead on", "壬": "ninth sign", "氐": "bottom, base", "啇": "stem, root", "涂": "mud",
    "沓": "pile up", "孚": "hatch, nourish", "寍": "peaceful", "丰": "lush", "溥": "wide", "髟": "long hair",
    "釆": "animal tracks", "畀": "give", "并": "side by side", "𠂤": "mound", "舛": "opposing feet", "圭": "jewel, corner",
    "弗": "not, twist", "辟": "punish", "亦": "also", "呆": "dumbfounded", "甫": "seedlings, at first", "莫": "sunset in the grass",
    "菐": "thicket", "曼": "stretch out", "帛": "silk cloth", "俞": "boat, pass over", "𠂇": "left hand", "斿": "streaming flag, roam",
    "䍃": "earthen jar", "䒑": "horns", "枼": "leaves, thin slips", "覀": "cover", "洛": "a river",
    "彔": "carve wood", "侖": "in order", "粦": "flickering fire", "电": "lightning", "亏": "lack",
  };
  // Heisig's names for parts, which the stories use where the card's label says something else [寸 inch is glue, 扌 hand is fingers].
  const HEISIG = {
    "寸": ["glue"], "宀": ["house"], "艹": ["flower"], "攵": ["taskmaster"], "扌": ["finger"], "言": ["words"], "日": ["sun"], "月": ["moon", "flesh"],
    "人": ["umbrella"], "丶": ["drop"], "一": ["floor", "ceiling"], "卜": ["magic wand"], "亠": ["top hat"], "八": ["animal legs", "horns"],
    "𠂊": ["bound up"], "勹": ["bound up"], "十": ["needle"], "士": ["samurai"], "夂": ["walking legs"], "丿": ["drop"], "囗": ["pent in"],
    "广": ["cave"], "隹": ["turkey"], "又": ["crotch"], "廴": ["stretch"], "己": ["snake"], "忄": ["state of mind"], "衤": ["cloak"],
    "罒": ["eye"], "刀": ["dagger"], "大": ["st. bernard"], "兄": ["teenager"], "戈": ["fiesta"], "殳": ["missile"], "禾": ["wheat"],
    "尸": ["flag"], "礻": ["altar"], "示": ["altar"], "厶": ["elbow"], "⺕": ["broom", "rake"], "刂": ["saber"], "凵": ["shovel"], "臣": ["slave"],
    "⻖": ["pinnacle"], "⻏": ["city walls"], "卩": ["stamp"], "艮": ["silver"], "幺": ["cocoon"], "龶": ["grow up"], "癶": ["teepee"],
    "酉": ["whiskey"], "豆": ["table"], "弋": ["arrow"], "田": ["brain"], "乙": ["fishhook"], "力": ["muscle"],
  };

  const api = { NAMES, HEISIG };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraRadicals = api;
})(this);
