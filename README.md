# ひらがな Flashcards

A study site built on [Tofugu's Learn Hiragana guide](https://www.tofugu.com/japanese/learn-hiragana/), hosted on GitHub Pages behind a Google sign-in through Supabase.

- **Learn**: the guide's 12 steps, each with its kana, mnemonics, look-alikes and the practice the guide asks for at that point.
- **Flashcards**: flip cards for any set of columns, weakest cards first. Cards you miss come back three cards later.
- **Quiz**: type the romaji, with a timer and your best time per set. Missed kana come back later in the same run.
- **Worksheets**: Tofugu's nine drill worksheets with their exact grids, typed instead of handwritten, with the 5- and 10-minute breaks in between rounds.
- **Reading**: the 24 sentences from Hiragana Practice #1 and #2. Tap a kana for its romaji and its sound.
- **Chart**: every kana, coloured by how well you know it.

The 🔊 buttons play Tofugu's recordings: one clip per kana, plus the eight small-tsu example words. Whole sentences have no recording, so they use the browser's Japanese voice, and that button only appears when one is installed.

The mnemonics are short paraphrases of Tofugu's. Their illustrated versions are in the [mnemonic chart](https://www.tofugu.com/japanese/hiragana-mnemonics-chart/).

## What is public and what isn't

The repo and the GitHub Pages site hold only the app: code, the kana and the mnemonics. Tofugu's worksheets, sentences and audio sit in a private Supabase bucket that only accounts in `allowed_emails` can read, so they never enter the repo (`.gitignore` keeps `_research/`, `audio/` and `content/` out).

Progress is stored per account and merged between devices, so practice on the phone and on the PC adds up instead of overwriting.

## Setup

1. **Supabase project.** Create one at supabase.com. Free projects pause after a week without use; resume from the dashboard.
2. **Database.** Open SQL Editor, paste `supabase/setup.sql`, put your Google address on its last line and run it.
3. **Google sign-in.** In Google Cloud Console create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Paste its client ID and secret into Supabase → Authentication → Sign In / Providers → Google.
4. **Redirect URLs.** Supabase → Authentication → URL Configuration: Site URL `https://<github-user>.github.io/<repo>/`, plus redirect URLs for that address and `http://localhost:8000/`.
5. **Content.** Run `npm run build-content`, then in Supabase → Storage → `content` upload `content/worksheets.json` and the `content/audio` folder.
6. **Config.** Put the Project URL and the publishable key (Project Settings → API Keys) in `config.js`. Both are meant to be public.
7. **Sign in once**, then turn off Authentication → Sign In / Providers → "Allow new users to sign up". The allow list already blocks strangers; this stops them creating accounts at all.
8. **GitHub Pages.** Push to a GitHub repo, then Settings → Pages → Deploy from a branch → `main`, folder `/`.

`.env` holds the database password for tools. The site never needs it, and it is ignored by git.

## Local use and tests

```
python -m http.server 8000 --bind 127.0.0.1
npm install
npm test
```

`npm test` runs the progress-merge rules in Node, and the sign-in, allow-list, audio, sync and offline flows in Chrome against a fake Supabase. The real row-level security can only be checked against the live project.
