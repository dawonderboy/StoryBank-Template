# Story Bank

An AI-powered interview prep app you can build in a weekend and run for the cost of a Claude subscription.

Built with React + TypeScript + Vite, deployed on Vercel, powered by the Anthropic API. Described in detail in [this Substack post](https://yoursubstack.substack.com/your-post).

![Story Bank](https://img.shields.io/badge/built%20with-Claude%20Code-black?style=flat-square) ![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript) ![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black?style=flat-square&logo=vercel)

---

## What it does

Story Bank is a personal interview prep tool built around your own career stories, structured as STAR narratives. It replaces generic interview prep apps with something purpose-built for your specific experience and weaknesses.

![Stories tab](./screenshots/stories-tab.png)

**Stories** — Your career stories with full STAR breakdowns (Situation, Task, Action, Result) and a reflection on what each one demonstrates. Always in your pocket.

**Q&A mapper** — Common behavioral interview questions, each pre-mapped to the right story and why. No blanking on which story fits which question.

![Practice mode with scoring](./screenshots/practice-score-public.png)

**Practice mode** — An AI interviewer asks the question, you answer (typed or by voice), it scores your answer on Structure, Specificity, and Conciseness (1–5 each) and fires a targeted follow-up probe. Cold open mode randomizes the question so you practice recall, not just repetition.

**Talk-time tracker** — A live timer that starts when you begin your answer. Green under 90 seconds, yellow approaching 2 minutes, red past it.

**Voice input** — Real-time transcription via Groq Whisper. Works in Chrome on iOS.

![Company prep tab](./screenshots/prep-result.png)

**Company prep tab** — Paste a job posting URL (Greenhouse, Lever, Workday, Ashby supported). The app fetches the JD, auto-fills company and role, and generates ranked story recommendations, likely interview questions, and positioning advice for that specific role.

![Stats dashboard](./screenshots/stats.png)

**Stats dashboard** — Every scored session is saved to localStorage. Tracks average score per dimension, per story, and per session over time. Surfaces weak spots and unpracticed stories.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Inline styles with CSS variables |
| AI coaching | Anthropic API (`claude-sonnet-4-20250514`) |
| Voice transcription | Groq Whisper (`whisper-large-v3-turbo`) |
| Job posting fetch | Vercel serverless function (`/api/fetch-job`) |
| Deployment | Vercel |
| Persistence | Browser localStorage |

---

## Quick start

```bash
git clone https://github.com/dawonderboy/StoryBank-template
cd StoryBank-template
npm install
npm run dev
```

You'll need two API keys — both have free tiers:

| Key | Where to get it | Used for |
|---|---|---|
| `VITE_ANTHROPIC_KEY` | [console.anthropic.com](https://console.anthropic.com) | AI coaching, scoring, company prep |
| Groq key (entered in-app) | [console.groq.com](https://console.groq.com) | Voice transcription |

Add the Anthropic key to a `.env` file in the project root:

```
VITE_ANTHROPIC_KEY=sk-ant-...
```

The Groq key is entered via the 🔑 icon in the app header and saved to localStorage.

---

## Making it yours

All stories and Q&A mappings live in `src/App.tsx` as two arrays at the top of the file: `STORIES` and `QA`.

The template ships with 5 placeholder stories — replace them with your own:

```typescript
{
  id: "your-story-id",         // unique slug, no spaces
  cat: "Change Mgmt",          // category label
  emoji: "🔄",                 // pick one that fits
  title: "Short title of the story",
  src: "Company · Year–Year",
  S: "Situation — context and background",
  T: "Task — what you were responsible for",
  A: "Action — specifically what YOU did",
  R: "Result — measurable outcome",
  X: "Reflection — what it demonstrates about you",
  tags: ["tag1", "tag2", "tag3"]
}
```

Then update the `QA` array to map each question to your story ids:

```typescript
{
  q: "Tell me about a time you improved a process",
  lead: ["your-story-id"],       // primary story
  alt: ["another-story-id"],     // backup story
  note: "coaching note to yourself on why this story fits"
}
```

No database, no backend, no auth. The entire app is one file.

---

## Deploying to Vercel

```bash
npm run build
npx vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deploys on push. Add `VITE_ANTHROPIC_KEY` as an environment variable in your Vercel project settings.

The `/api/fetch-job.ts` serverless function handles job posting fetches server-side, bypassing CORS restrictions on ATS platforms. Supports Greenhouse, Lever, Workday, and Ashby out of the box.

---

## Adding it to your iPhone home screen

1. Open your Vercel URL in **Safari**
2. Tap the Share icon → **Add to Home Screen** → **Add**

It runs as a full-screen web app from your home screen.

---

## Project structure

```
/
├── src/
│   └── App.tsx          # entire frontend — stories, Q&A, all five tabs
├── api/
│   └── fetch-job.ts     # Vercel serverless function for ATS job fetching
├── index.html
├── vite.config.ts
└── package.json
```

---

## Why I built this

I have ADHD. Interview prep is hard when retention is unreliable, sitting down to practice takes activation energy you don't always have, and rambling is your default mode under pressure.

Existing tools were too generic, too expensive, or required too much setup to actually use consistently. So I built something purpose-built for my specific stories, my specific weaknesses, and the way my brain works.

Full writeup: [I Have ADHD and Interviews Are Hard. So I Built a Tool That Works With My Brain.](https://yoursubstack.substack.com/your-post)

---

## License

MIT — fork it, adapt it, make it yours.

---

*Built by [Robin Letim](https://github.com/dawonderboy) · [Substack](https://dawonderboy.substack.com)*
