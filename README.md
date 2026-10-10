# BD Exam Arena — বিডি এক্সাম অ্যারেনা

A free, fully offline, bilingual (Bangla/English) competitive exam preparation app for Bangladesh — built for BCS, bank, primary teacher, and other government job exams. 800 curated multiple-choice questions across 8 subjects, three practice modes including a full BCS-style mock exam with negative marking, and an analytics dashboard that finds your weak topics.

**Live demo:** _URL goes here after deployment_
**Author:** Ishan Ahmed Fahad ([fahad3235](https://github.com/fahad3235))

## Problem

BCS and job-exam aspirants in Bangladesh juggle scattered PDF question banks, ad-heavy apps that need constant internet, and English-only interfaces. BD Exam Arena puts 800 verified, bilingual MCQs in one offline app with real exam simulation and data-driven study guidance.

## Features

- **800 curated bilingual MCQs** — 100 per subject: বাংলা ব্যাকরণ ও সাহিত্য, English Grammar & Vocabulary, গণিত, বাংলাদেশ বিষয়াবলি, আন্তর্জাতিক বিষয়াবলি, সাধারণ বিজ্ঞান, ICT ও কম্পিউটার, মানসিক দক্ষতা
- **3 modes:**
  - ⚡ Quick Practice — 20 random questions, instant feedback + explanations
  - 🎯 Topic Drill — pick a subject and topic, drill up to 20 questions
  - 📝 Full Mock Exam — 100 questions, 120-minute timer, −0.25 negative marking (BCS style), question palette + flagging
- **Review screen** — every answer with explanations, filter by correct/wrong/skipped
- **Analytics dashboard** — accuracy by subject, average time per question, weak-topic detection (≥5 attempts, <50% accuracy) with study recommendations
- **XP & levels** — +10 XP per correct answer, 12 levels
- **Session history** — saved locally, deletable, export/import as JSON
- **EN/বাংলা UI toggle** with Bengali digits throughout
- **100% offline** — zero network requests after load; all data in local JSON files + localStorage
- **Mobile responsive** (≤640px)

## Tech stack

- Plain HTML, CSS, JavaScript (ES6) — no frameworks, no build step, no dependencies
- Question bank: local JSON files (`questions/<subject>.json`)
- Persistence: `localStorage` (`bd_exam_arena_v1`); JSON export/import
- Deployment: any static host (GitHub Pages)

## Prerequisites

Any modern browser (Chrome, Firefox, Edge, Safari). For local development, any static file server (Python 3 is enough).

## Install & run locally

```bash
git clone https://github.com/fahad3235/bd-exam-arena.git
cd bd-exam-arena
python3 -m http.server 8000
# open http://localhost:8000
```

> A static server is required (not `file://`) because the app loads question JSON via `fetch`.

## Testing

Two suites, both run against a real headless Chromium:

```bash
# 1. Question-data validation — checks EVERY question in all 8 files:
#    valid JSON, schema, exactly 4 distinct non-empty options, answer 0–3,
#    unique IDs, no duplicate question text (within + across files),
#    answer distribution ≤40% per index, time-sensitive-word scan.
python3 /tmp/bdea-validate.py

# 2. App behavior — ~55 checks in headless Chrome (playwright-core):
#    all 3 modes, instant feedback, palette + flagging, 120-min timer,
#    auto-submit, negative-marking math (3−0.25=2.75), analytics,
#    weak-topic detection, persistence across reload, export/import,
#    history delete, BN/EN toggle with Bengali digits, 390px mobile,
#    zero console/page errors.
node /tmp/bdea-test.js
```

## Environment variables

None. There is no backend, no API key, no build step.

## Deployment (GitHub Pages)

1. Push this repo to GitHub (text files only).
2. Repository → Settings → Pages → Deploy from a branch → `main` / `/ (root)` → Save.
3. The site goes live at `https://<user>.github.io/bd-exam-arena/`.

## Honest limitations

- Question bank is curated for practice, not an official BCS syllabus; some topics may be under-covered.
- Explanations are short by design (1–2 sentences).
- Only settled, verifiable facts are included — **no current-affairs questions** (those change too fast); pair with a current-affairs source for full prep.
- Negative marking (−0.25) follows the general BCS MCQ convention; confirm the marking scheme of your specific exam circular.
- All data lives in the browser's localStorage — use Export to back up; clearing browser data erases history.
- Mock-exam timer requires the tab to stay open.
- Math/mental-ability answers were hand-verified during authoring, but if you spot an error, please open an issue.

## Status

Built and tested. Awaiting deployment.
