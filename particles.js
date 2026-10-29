// Particle gaps, pure so node can test them: N5 sentences with one particle out, and the four choices a card offers [電車＿乗ります → に].
(function (root) {
  const CHOICES = ["は", "が", "を", "に", "で", "と", "も", "へ", "から", "まで", "の", "や", "より"];

  // [sentence with {kanji|reading} and one ＿, every particle right for the English, the ones right only for another English]
  // The second list is kept out of the wrong choices, so a card never offers a second right answer [バス＿行きます: に is "to the bus"].
  const SENTENCES = [
    ["{私|わたし}＿{学生|がくせい}です。", ["は"], "I am a student.", ["が", "も"]],
    ["これ＿{私|わたし}の{本|ほん}です。", ["は"], "This is my book.", ["が", "も"]],
    ["{私|わたし}＿{本|ほん}です。", ["の"], "It's my book.", ["は", "も", "が"]],
    ["{水|みず}＿{飲|の}みます。", ["を"], "I drink water.", ["で", "と", "も", "は"]],
    ["パン＿{買|か}いました。", ["を"], "I bought bread.", ["も", "は"]],
    ["{毎朝|まいあさ}コーヒー＿{飲|の}みます。", ["を"], "I drink coffee every morning.", ["で", "と", "も", "は"]],
    ["{学校|がっこう}＿{行|い}きます。", ["に", "へ"], "I go to school.", ["から", "まで", "は", "も"]],
    ["{日本|にほん}＿{来|き}ました。", ["に", "へ"], "I came to Japan.", ["から", "まで", "は", "も"]],
    ["アメリカ＿{来|き}ました。", ["から"], "I came from America.", ["に", "へ", "まで", "は", "も"]],
    ["{駅|えき}＿{歩|ある}きます。", ["まで"], "I walk as far as the station.", ["に", "へ", "から", "で", "を", "は", "も"]],
    ["{家|いえ}＿{駅|えき}まで{歩|ある}きます。", ["から"], "I walk from home to the station.", ["は", "も"]],
    ["バス＿{行|い}きます。", ["で"], "I go by bus.", ["が", "に", "へ", "から", "まで", "は", "も"]],
    ["はし＿{食|た}べます。", ["で"], "I eat with chopsticks.", ["を", "も", "は"]],
    ["{図書館|としょかん}＿{勉強|べんきょう}します。", ["で"], "I study at the library.", ["は", "も"]],
    ["レストラン＿{晩|ばん}ご{飯|はん}を{食|た}べました。", ["で"], "I had dinner at a restaurant.", ["は", "も"]],
    ["{友|とも}だち＿{映画|えいが}を{見|み}ました。", ["と"], "I watched a film with a friend.", ["が", "は", "も", "の"]],
    ["{母|はは}＿{電話|でんわ}しました。", ["に"], "I phoned my mother.", ["と", "が", "から", "へ", "は", "も"]],
    ["{先生|せんせい}＿{話|はな}しました。", ["と"], "I talked with the teacher.", ["に", "が", "は", "も"]],
    ["{九時|くじ}＿{寝|ね}ます。", ["に"], "I go to bed at nine.", ["から", "まで", "は", "も"]],
    ["テストは{九時|くじ}＿{始|はじ}まります。", ["に", "から"], "The test starts at nine.", ["も"]],
    ["{五時|ごじ}＿{待|ま}ちます。", ["まで"], "I'll wait until five.", ["に", "から", "を", "は", "も"]],
    ["{月曜日|げつようび}＿{金曜日|きんようび}まで{働|はたら}きます。", ["から"], "I work from Monday to Friday.", ["は", "も"]],
    ["りんご＿バナナを{買|か}いました。", ["と"], "I bought apples and bananas.", ["や", "が", "の", "は", "も"]],
    ["りんご＿バナナなどを{買|か}いました。", ["や"], "I bought apples, bananas and things like that.", ["と", "の", "は", "も"]],
    ["{部屋|へや}に{猫|ねこ}＿います。", ["が"], "There is a cat in the room.", ["と", "は", "も"]],
    ["{机|つくえ}の{上|うえ}に{本|ほん}＿あります。", ["が"], "There is a book on the desk.", ["は", "も"]],
    ["{私|わたし}は{犬|いぬ}＿{好|す}きです。", ["が"], "I like dogs.", ["を", "は", "も"]],
    ["{日本語|にほんご}＿わかります。", ["が"], "I understand Japanese.", ["を", "で", "は", "も"]],
    ["お{金|かね}＿ありません。", ["が"], "I have no money.", ["は", "も"]],
    ["{私|わたし}＿{行|い}きます。", ["も"], "I'll go too.", ["は", "が", "と", "から"]],
    ["{兄|あに}も{姉|あね}＿{学生|がくせい}です。", ["も"], "My older brother and my older sister are both students.", ["は", "が"]],
    ["{明日|あした}＿{休|やす}みです。", ["は"], "Tomorrow is a day off.", ["も", "が", "から", "まで"]],
    ["トイレ＿どこですか。", ["は"], "Where is the toilet?", ["が", "も"]],
    ["{誰|だれ}＿{来|き}ましたか。", ["が"], "Who came?", ["と", "から", "も"]],
    ["{雨|あめ}＿{降|ふ}っています。", ["が"], "It's raining.", ["は", "も"]],
    ["この{花|はな}＿{名前|なまえ}は{何|なん}ですか。", ["の"], "What is the name of this flower?", ["は"]],
    ["{日本|にほん}＿{車|くるま}はいいです。", ["の"], "Japanese cars are good.", ["と", "や", "で", "は", "も"]],
    ["{公園|こうえん}＿{散歩|さんぽ}します。", ["を", "で"], "I take a walk in the park.", ["から", "まで", "は", "も"]],
    ["{道|みち}＿{渡|わた}ります。", ["を"], "I cross the road.", ["は", "も"]],
    ["バス＿{降|お}ります。", ["を", "から"], "I get off the bus.", ["は", "も"]],
    ["{電車|でんしゃ}＿{乗|の}ります。", ["に"], "I get on the train.", ["は", "も"]],
    ["{部屋|へや}＿{入|はい}ります。", ["に", "へ"], "I go into the room.", ["から", "まで", "は", "も"]],
    ["{家|いえ}＿{出|で}ます。", ["を", "から"], "I leave the house.", ["は", "も"]],
    ["{医者|いしゃ}＿なりたいです。", ["に"], "I want to become a doctor.", ["と", "は", "も"]],
    ["{友|とも}だち＿プレゼントをあげました。", ["に"], "I gave a present to a friend.", ["と", "が", "の", "へ", "は", "も"]],
    ["{兄|あに}＿{本|ほん}をもらいました。", ["に", "から"], "I got a book from my older brother.", ["と", "が", "の", "は", "も"]],
    ["{日本語|にほんご}＿{話|はな}してください。", ["で"], "Please speak in Japanese.", ["を", "は", "も"]],
    ["{紙|かみ}＿{名前|なまえ}を{書|か}きます。", ["に"], "I write my name on the paper.", ["で", "の", "は", "も"]],
    ["この{電車|でんしゃ}は{東京|とうきょう}＿{行|い}きますか。", ["に", "へ", "まで"], "Does this train go to Tokyo?", ["から", "も"]],
    ["{東京|とうきょう}は{大阪|おおさか}＿{大|おお}きいです。", ["より"], "Tokyo is bigger than Osaka.", ["も"]],
    ["コーヒーと{紅茶|こうちゃ}と、どちら＿{好|す}きですか。", ["が"], "Which do you like better, coffee or tea?", ["を", "も"]],
    ["{一人|ひとり}＿{旅行|りょこう}しました。", ["で"], "I travelled alone.", ["が", "は", "も"]],
    ["{私|わたし}の{父|ちち}＿{医者|いしゃ}です。", ["も"], "My father is a doctor too.", ["は", "が"]],
    ["{弟|おとうと}はりんご＿バナナも{食|た}べません。", ["も"], "My younger brother eats neither apples nor bananas.", ["と", "や", "は"]],
    ["{明日|あした}＿{雨|あめ}でしょう。", ["も"], "It will probably rain tomorrow too.", ["は", "が"]],
    ["{机|つくえ}の{上|うえ}にペン＿ノートなどがあります。", ["や"], "There are pens, notebooks and other things on the desk.", ["と", "の", "も"]],
    ["{休|やす}みの{日|ひ}は{本|ほん}＿{雑誌|ざっし}を{読|よ}みます。", ["や"], "On my days off I read things like books and magazines.", ["と", "も", "の"]],
    ["{公園|こうえん}には{犬|いぬ}＿{猫|ねこ}などがいます。", ["や"], "There are dogs, cats and other animals in the park.", ["と", "も", "の"]],
    ["{冷蔵庫|れいぞうこ}に{卵|たまご}＿{牛乳|ぎゅうにゅう}などがあります。", ["や"], "There are eggs, milk and such in the fridge.", ["と", "も", "の"]],
    ["{私|わたし}は{母|はは}＿{買|か}い{物|もの}に{行|い}きました。", ["と"], "I went shopping with my mother.", ["は", "も", "の"]],
    ["{兄|あに}＿{姉|あね}がいます。", ["と"], "I have an older brother and an older sister.", ["や", "も", "の", "は"]],
    ["{東京|とうきょう}＿{大|おお}きい{町|まち}です。", ["は"], "Tokyo is a big city.", ["が", "も"]],
    ["{日曜日|にちようび}＿{休|やす}みます。", ["は"], "On Sundays I take the day off.", ["に", "を", "も"]],
    ["{店|みせ}は{夜|よる}{十時|じゅうじ}＿{開|あ}いています。", ["まで"], "The shop is open until ten at night.", ["に", "から", "は", "も"]],
    ["{明日|あした}＿{待|ま}ってください。", ["まで"], "Please wait until tomorrow.", ["から", "に", "を", "は", "も"]],
    ["{夏休|なつやす}みは{八月|はちがつ}＿です。", ["まで"], "The summer holidays last until August.", ["から", "に", "は", "も"]],
    ["{母|はは}＿{車|くるま}は{赤|あか}いです。", ["の"], "My mother's car is red.", ["と", "や", "は", "も"]],
    ["{日本語|にほんご}＿{先生|せんせい}は{優|やさ}しいです。", ["の"], "The Japanese teacher is kind.", ["と", "や", "で", "は", "も"]],
    ["あれは{誰|だれ}＿{傘|かさ}ですか。", ["の"], "Whose umbrella is that?", ["が", "は", "も"]],
    ["{電車|でんしゃ}はバス＿{速|はや}いです。", ["より"], "The train is faster than the bus.", ["が", "も"]],
    ["{今日|きょう}は{昨日|きのう}＿{暑|あつ}いです。", ["より"], "Today is hotter than yesterday.", ["から", "が", "も"]],
    ["{私|わたし}は{肉|にく}＿{魚|さかな}が{好|す}きです。", ["より"], "I like fish more than meat.", ["と", "や", "も"]],
    ["{兄|あに}は{父|ちち}＿{背|せ}が{高|たか}いです。", ["より"], "My older brother is taller than my father.", ["の", "も"]],
  ].map(([s, ok, en, near], id) => ({ id, s, ok, en, near }));

  // A card's four choices in a shuffled order: one right particle and three that fit no reading [バス＿行きます: で, を, と, の].
  function options(card, rand = Math.random) {
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const wrong = CHOICES.filter((p) => !card.ok.includes(p) && !card.near.includes(p));
    const out = [pick(card.ok)];
    while (out.length < 4) {
      const p = pick(wrong.filter((x) => !out.includes(x)));
      out.push(p);
    }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  // The sentence as text and ruby pieces [{私|わたし}＿ = 私 over わたし, then the gap].
  const pieces = (s) => [...s.matchAll(/\{([^|}]+)\|([^}]+)\}|＿|[^{＿]+/g)].map((m) => (m[1] ? { kanji: m[1], rt: m[2] } : m[0] === "＿" ? { gap: true } : { text: m[0] }));

  const api = { CHOICES, SENTENCES, options, pieces };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraParticles = api;
})(this);
