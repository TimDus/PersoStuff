// Koohii's pages are parsed with regexes into content/koohii.json, so a markup change on their side would quietly
// give every kanji the newest story instead of the best, or let a story's <a> or <script> through into the page.
// The fixture is hand-written in their page's shape; real pages and their stories never go in this public repo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { parse } = require("../tools/build-koohii.js");
const page = fs.readFileSync(path.join(__dirname, "fixtures", "koohii-page.html"), "utf8");

test("a page gives its keyword, frame number and the user's own story", () => {
  const k = parse(page);
  assert.deepEqual([k.kw, k.frame, k.mine], ["study", 346, "My own <em>roof</em> &amp; <strong>study</strong> story."]);
});

test("the top 3 shared stories come from the shared list by stars, never from the newest", () => {
  assert.deepEqual(parse(page).stories.map((s) => [s.by, s.stars]), [["first", 300], ["second", 120], ["third", 40]]);
});

test("a story keeps only its em and strong tags and its entities as written [<a> dropped, &lt;script&gt; stays text]", () => {
  const [first, second, third] = parse(page).stories;
  assert.equal(first.text, "Under a <em>crown</em> of <em>sparks</em>, a <em>child</em> sits down to <strong>study</strong>.");
  assert.equal(second.text, "Second link story.");
  assert.equal(third.text, "Third &lt;script&gt; story.");
});

test("a keyword's entities decode once [&amp;lt; reads &lt;, not <]", () => {
  assert.equal(parse('<span class="ko-MyStory-keyword">a &amp;lt;b&amp;gt; &amp;amp; c</span>').kw, "a &lt;b&gt; &amp; c");
});

test("an empty own story is null, and a page without a keyword gives nothing", () => {
  const empty = page.replace(/<div class="story">My own[^\n]*/, '<div class="empty">[ click here to enter your story ]</div>');
  assert.equal(parse(empty).mine, null);
  assert.equal(parse("<html><form><input name=\"password\"></form></html>"), null);
});
