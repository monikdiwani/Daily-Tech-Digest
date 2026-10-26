# Daily Tech Digest

An automated personal technology briefing built with **Google Apps Script**, Google News RSS, direct RSS/Atom feeds, the Gemini API, and Gmail.

The script collects recent technology stories, removes duplicates, optionally uses Gemini to curate and summarize them, and sends a responsive HTML/plain-text email. A scheduled run is targeted for **08:00–09:00 Asia/Kolkata**.

> **Status:** This repository contains the source and setup instructions. It has not been run in your Google Apps Script account. You must test your own API key, account permissions, feed availability, quotas, and email delivery.

## What it includes

- Coverage across 17 areas, including AI models and products, developer tools, open source/GitHub, research, prompt/context engineering, agent evaluations, cybersecurity, startups, data/ML, cloud/databases/APIs, web/mobile, hardware/robotics, policy, India technology, automation, and consumer devices.
- Google News RSS editions for the US, UK, and India, supplemented by direct feeds from primary sources and specialist technology sites.
- A target of 15–20 distinct stories. The script does not add filler when there is not enough fresh, useful news.
- Per-story summaries, why-it-matters context, and practical actions.
- A rotating **Prompt Engineering Lab** lesson with no additional Gemini request.
- A conservative **Prompt Engineering Radar** that appears only when a qualifying recent development is found and has not already been reported.
- Recent-story and near-duplicate history, short-lived RSS caching, batched fetches, bounded Gemini retries, and an RSS-only fallback when Gemini is unavailable.
- Multiple recipients: the first address is placed in `To` and additional addresses are placed in `Bcc`.
- A daily trigger with bounded retry and watchdog handling for transient failures.

## Architecture

```text
Google News RSS + direct RSS/Atom feeds
                    |
                    v
        Google Apps Script (V8)
          |                 |
          |                 +--> Gemini API (optional curation)
          v
       Gmail / MailApp
```

The workflow is serverless and uses no database or paid news service. RSS entries generally contain headlines and excerpts rather than complete articles; verify important claims at the linked source.

## Quick setup

### 1. Create the Apps Script project

1. Open [Google Apps Script](https://script.google.com/) and create or open a project.
2. Copy the complete contents of [`DailyTechDigest.gs`](./DailyTechDigest.gs) into `Code.gs` (or keep the file name `DailyTechDigest.gs`).
3. In **Project Settings**, set the time zone to `Asia/Kolkata`.

### 2. Add Script Properties

In **Project Settings → Script Properties**, add:

| Property | Required | Value |
|---|---:|---|
| `GEMINI_API_KEY` | No | A Gemini API key from [Google AI Studio](https://aistudio.google.com/). |
| `RECIPIENT_EMAILS` | Recommended | One or more addresses separated by commas or semicolons. |
| `RECIPIENT_EMAIL` | Legacy fallback | A single address, used only when `RECIPIENT_EMAILS` is absent. |

The code repository intentionally does not contain recipient addresses or API keys. Keep both in Script Properties and never paste them into source code, issues, or logs. If Gemini is not configured or is temporarily unavailable, the script can send an RSS-only digest.

### 3. Test in this order

Run these functions from the Apps Script editor:

1. `testPromptEngineeringLab()` — local lesson and rendering checks; no network call or email.
2. `testPromptEngineeringRadarRules()` — local freshness, repetition, and evergreen-content checks.
3. `testGeminiConnection()` — checks the configured model and fallback model; uses Gemini quota.
4. `testRssFetch()` — fetches a bounded feed preview; does not send email.
5. `testDigestNow()` — sends one test email with `[TEST]` in the subject; does not save story history or advance the lesson.
6. Confirm the email, source links, lesson, Builder’s Corner, and any Radar section.
7. Run `installDailyTrigger()` once after testing. It removes this script’s existing daily digest triggers before creating one, so rerunning it resets rather than duplicates the schedule.

To pause delivery, run `removeDailyTrigger()`. The scheduled entry point is `sendDailyDigest()`.

## Function reference

| Function | Purpose |
|---|---|
| `sendDailyDigest()` | Scheduled entry point for the daily digest. |
| `retryDailyDigest()` | Internal retry entry point created after a transient scheduled failure. |
| `testDigestNow()` | Full test run that sends an email without advancing history. |
| `testGeminiConnection()` | Verifies Gemini access and fallback behavior. |
| `testRssFetch()` | Checks a bounded set of RSS/Atom feeds without sending email. |
| `testPromptEngineeringLab()` | Runs local Prompt Engineering Lab checks. |
| `testPromptEngineeringRadarRules()` | Runs local Radar rule checks. |
| `installDailyTrigger()` | Removes this script’s old daily triggers and installs a new one. |
| `removeDailyTrigger()` | Removes this script’s daily digest triggers. |

## Important limitations

- The digest summarizes RSS headlines and excerpts; it does not read or verify every full article.
- Gemini selection and Prompt Engineering Radar matching are heuristic. Radar can miss a development or include an imperfect match.
- Google controls model availability, free-tier limits, quotas, and pricing. Check the current [model documentation](https://ai.google.dev/gemini-api/docs/models) and [pricing information](https://ai.google.dev/gemini-api/docs/pricing).
- The script does not use Google Search grounding or a paid search service.
- The scheduled trigger runs approximately within the Apps Script one-hour window, not at an exact minute.
- Apps Script permissions, RSS availability, API access, quota behavior, and Gmail delivery must be validated in the account where the script is installed.

## Troubleshooting

### Gemini errors

Check the API key, selected Google Cloud/AI Studio project, model availability, quota, and the Apps Script **Executions** page. A `503` can indicate temporary capacity; a `429` commonly indicates a quota or rate limit. The script uses bounded retries and then falls back to RSS-only output where possible.

### RSS errors

Individual feed failures are skipped. Run `testRssFetch()` and inspect the execution log. If all feeds fail, retry later and check the feed URLs and Apps Script network access.

### Email errors

Verify `RECIPIENT_EMAILS`, check spam and Promotions/Updates folders, and review the latest execution. If a scheduled run fails, the script attempts a failure notice when the recipient configuration is available.

## Repository files

- [`DailyTechDigest.gs`](./DailyTechDigest.gs) — complete Google Apps Script source.
- [`SETUP_DailyTechDigest.txt`](./SETUP_DailyTechDigest.txt) — detailed setup and operational checklist.
- [`README.md`](./README.md) — project overview and quick setup.

## References

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
