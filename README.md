# Daily Tech Digest — Free Personal AI Newsletter

A 100% free, automated, and serverless daily technology newsletter built with **Google Apps Script**, **Google News RSS**, the **Google Gemini API**, and **Gmail**.

Every morning between **08:00 AM and 09:00 AM IST (Asia/Kolkata)**, the script:
1. Concurrently fetches breaking technology news across **11 core topics** from both **Global** and **India** editions.
2. Deduplicates repeated stories against recent history stored in Script Properties.
3. Asks the **Gemini API** (`gemini-3.8-flash` with automatic fallback to `gemini-3.5-flash`) to curate 15–20 high-value stories.
4. Generates an executive summary, "Why it matters", and practical "Try / explore" actions for each story.
5. Sends a polished, mobile-responsive briefing directly to your Gmail inbox.

---

## Architecture (Why It's 100% Free)

```
[ Google News RSS ] ──(Parallel XML Fetch)──┐
                                            ▼
[ Google Apps Script (V8) ] ──(Lock & Quota Check)──► [ Gemini API (Free Tier) ]
        │                                                    │
        │                                             (Structured JSON)
        ▼                                                    │
   [ Gmail ] ◄───────────────────────────────────────────────┘
  (Daily 8–9 AM IST)
```

* **No server required**: Runs on Google's cloud infrastructure via Google Apps Script.
* **No paid database**: Story fingerprints are stored using Google Apps Script's built-in `PropertiesService`.
* **No paid APIs**: Google News RSS is public and free; Google AI Studio provides a free Gemini API tier with no credit card required.
* **No email service fees**: Uses your existing Gmail account quota (free personal accounts get 100 emails/day; this digest uses only 1).

---

## Covered Topics

The digest collects stories across both **Global** and **India** editions for:
1. **AI & Large Language Models (LLMs)**
2. **New AI Tools & Product Launches**
3. **Coding Agents & Developer Tools** (e.g., Cursor, GitHub Copilot, dev tooling)
4. **Product Updates & New Features** (OpenAI, Google, Anthropic, Microsoft, Meta)
5. **Project Ideas & Workflow Automation** (n8n, LangChain, agent pipelines)
6. **Open-Source Projects & Trending GitHub Repositories**
7. **Research Papers & Breakthroughs** (arXiv, benchmark advances)
8. **Cybersecurity** (vulnerabilities, zero-days, breaches, security patches)
9. **Big Tech & Startups** (funding, acquisitions, strategic shifts, hardware)
10. **Data Science, Analytics & Machine Learning** (PyTorch, vector databases, embeddings)
11. **Cloud, Databases & Web Development** (AWS, GCP, Azure, PostgreSQL, Next.js, Kubernetes)

---

## Setup Guide (Step-by-Step for Beginners)

### Step 1: Get a Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your standard Google account.
3. Click **Get API key** (or **Create API key**).
4. Copy the generated key. (Keep it private; do not share or commit this key).

---

### Step 2: Create a New Google Apps Script Project
1. Open your browser and navigate to [script.google.com](https://script.google.com/).
2. Click **New project** (top-left).
3. In the top-left corner, rename the project from *Untitled project* to **Daily Tech Digest**.

---

### Step 3: Paste the Script Code
1. In the Apps Script editor, open the existing file `Code.gs` (or create a file named `DailyTechDigest.gs`).
2. Delete any boilerplate code inside the editor.
3. Open `DailyTechDigest.gs` from this workspace, copy the entire contents, and paste them into the Apps Script editor.
4. At the top of the script, set your email address in `CONFIG.RECIPIENT_EMAIL`:
   ```javascript
   RECIPIENT_EMAIL: 'yourname@gmail.com',
   ```
5. Click the **Save** icon (floppy disk) or press `Ctrl + S` (`Cmd + S` on Mac).

---

### Step 4: Add Your Gemini API Key to Script Properties
Script Properties store secrets securely in your private Apps Script account so they never appear in plain code:
1. In the left sidebar of the Google Apps Script editor, click the **Gear icon (Project Settings)**.
2. Scroll down to the **Script Properties** section.
3. Click **Add script property**.
4. Set:
   * **Property**: `GEMINI_API_KEY`
   * **Value**: *(Paste your Gemini API key from Step 1)*
5. Click **Save script properties**.

*(Optional)*: If you prefer not to hardcode your email in the script, you can also add a script property named `RECIPIENT_EMAIL` with your email address as the value.

---

### Step 5: Test Your Setup (One-Click Functions)

Back in the Apps Script editor (`< > Editor` tab in the left sidebar), select and run these functions from the dropdown menu at the top:

#### 1. Verify Gemini API Connection
* Select `testGeminiConnection` from the function dropdown.
* Click **Run**.
* *First-time permission popup*: Google will display an **"Authorization required"** window. Click **Review permissions**, select your Google account, click **Advanced**, and click **Go to Daily Tech Digest (unsafe)**. (This is standard for your own personal Apps Script code).
* Check the **Execution log** at the bottom. You should see:
  `SUCCESS: Gemini API is connected and responding properly.`

#### 2. Verify Google News RSS Feeds
* Select `testRssFetch` from the function dropdown.
* Click **Run**.
* Inspect the log. It should show 22/22 feeds read, total unique articles collected (~80–120), and sample headlines.

#### 3. Send a Test Digest Immediately
* Select `testDigestNow` from the function dropdown.
* Click **Run**.
* Open your Gmail inbox. Within 15–30 seconds, you will receive an email titled:
  `[TEST] Daily Tech Digest — <Today's Date>`
* Check both your **Inbox** and **Promotions / Updates** tabs.

---

### Step 6: Install the Daily Morning Schedule
1. In the function dropdown at the top, select `installDailyTrigger`.
2. Click **Run**.
3. The execution log will confirm:
   `SUCCESS: Daily trigger installed. The newsletter will run every day between 08:00–09:00 AM (Asia/Kolkata).`

That's it! Your personal daily tech newsletter is now completely automated. It will run every single morning, including weekends.

---

## How to Pause or Stop Delivery

If you ever go on vacation or want to pause the daily emails:
1. Open your Apps Script project.
2. Select `removeDailyTrigger` from the function dropdown.
3. Click **Run**.
4. To restart later, simply run `installDailyTrigger` again.

---

## Project Functions Reference

| Function Name | Purpose | Saves History? |
| :--- | :--- | :--- |
| `sendDailyDigest()` | **Main Scheduled Runner**: Triggered automatically daily between 8–9 AM IST. Fetches news, curates with Gemini, sends email, and updates duplicate history. | Yes |
| `testDigestNow()` | **Instant Preview**: Runs the full workflow and delivers a test email immediately. | No (preview only) |
| `testGeminiConnection()` | **API Health Check**: Sends a small ping to verify the Gemini API key and model connectivity. | No |
| `testRssFetch()` | **Feed Health Check**: Concurrently fetches all 22 RSS feeds and logs article counts. | No |
| `installDailyTrigger()` | **Scheduler**: Cleans up older triggers and sets a daily 08:00–09:00 AM Asia/Kolkata trigger. | N/A |
| `removeDailyTrigger()` | **Uninstaller**: Deletes all automated daily triggers. | N/A |

---

## Free Tier Quotas & Limits

| Service | Free Tier Limit | Daily Tech Digest Usage |
| :--- | :--- | :--- |
| **Gmail Daily Sends** | 100 emails / day (consumer Gmail) | 1 email / day (~1%) |
| **Gemini API (Flash)** | 15 Requests / min, 1,500 Requests / day | 1–2 requests / day (~0.1%) |
| **Apps Script Execution Time** | 6 minutes (360 seconds) / run | ~8–15 seconds / run (uses parallel fetch) |
| **Apps Script UrlFetch** | 20,000 calls / day | ~22 calls / day (~0.1%) |
| **Script Properties Storage** | 9 KB per property | ~3.5 KB rolling history (~38%) |

---

## Troubleshooting Guide

### 1. "Authorization required" or "Google hasn't verified this app"
* **Why**: Google Apps Script prompts for permission whenever a script accesses external services (`UrlFetchApp` for RSS/Gemini and `MailApp` for Gmail).
* **Fix**: Click **Advanced** &rarr; **Go to Daily Tech Digest (unsafe)** &rarr; **Allow**. Since you own the script and account, this is completely safe.

### 2. Email arrives in "Promotions" or "Updates" tab
* **Fix**: In Gmail, open the email, drag it into the **Primary** tab, and click **"Yes"** when Gmail asks if you want future emails to go to Primary.

### 3. "Missing GEMINI_API_KEY" Error
* **Fix**: Open **Project Settings (Gear icon)** in Apps Script &rarr; **Script Properties** &rarr; verify the property name is exactly `GEMINI_API_KEY` (case-sensitive) with no leading or trailing whitespace.

### 4. "Daily trigger created, but email did not arrive"
* Check **Executions** in the left sidebar of the Apps Script editor. Any failed runs and their exact error messages will be displayed there.
* If a scheduled run ever fails, the script will attempt to email you a failure notice describing the error.

---

## Workspace Files

* `DailyTechDigest.gs`: Complete Google Apps Script file for copy-pasting into Google Apps Script.
* `README.md`: Setup, configuration, architecture, and troubleshooting documentation.
#   D a i l y - T e c h - D i g e s t  
 