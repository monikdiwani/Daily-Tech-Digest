/**
 * Daily Tech Digest — Google Apps Script (V8 Runtime)
 * Completely free, personal daily AI tech newsletter powered by:
 * 1. Google News RSS (Concurrent multi-topic headlines across Global & India)
 * 2. Google Gemini API (Structured curation, summarization, and practical insights)
 * 3. Gmail / MailApp (Mobile-responsive HTML + plain text delivery)
 *
 * Owner Setup:
 * 1. Update CONFIG.RECIPIENT_EMAIL below (or set Script Property 'RECIPIENT_EMAIL').
 * 2. Add your free Gemini API key under Project Settings > Script Properties as 'GEMINI_API_KEY'.
 * 3. Run testGeminiConnection() and testRssFetch() to verify your setup.
 * 4. Run testDigestNow() to receive a test email immediately.
 * 5. Run installDailyTrigger() to schedule delivery every morning at 8:00–9:00 AM IST.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // Your receiving email address. Replace this or set 'RECIPIENT_EMAIL' in Script Properties.
  RECIPIENT_EMAIL: 'monikdiwani@gmail.com',

  // Scheduled timezone (Asia/Kolkata = Indian Standard Time, UTC+5:30)
  TIMEZONE: 'Asia/Kolkata',

  // Gemini models available on the Google AI Studio free tier.
  // gemini-3.8-flash is the active primary model; gemini-3.5-flash serves as automatic fallback.
  PRIMARY_MODEL: 'gemini-3.8-flash',
  FALLBACK_MODEL: 'gemini-3.5-flash',

  // Story targets
  MIN_STORIES: 15,
  MAX_STORIES: 20,
  MAX_ITEMS_PER_FEED: 5,
  MAX_CANDIDATES_FOR_AI: 90,

  // Rolling history: store up to 180 compact fingerprints in Script Properties (~3.5 KB, well below 9 KB limit)
  MAX_HISTORY: 180,

  // How many recent headlines to give Gemini for semantic duplicate avoidance
  RECENT_HEADLINES_FOR_AI: 15,

  // Retry settings for API rate limits (HTTP 429 / 503)
  MAX_API_RETRIES: 2,
  RETRY_DELAY_MS: 2500
};

// ============================================================================
// TOPICS & REGIONS
// ============================================================================
const TOPICS = [
  {
    name: 'AI & LLMs',
    query: '("artificial intelligence" OR "large language model" OR LLM OR "generative AI" OR ChatGPT OR Gemini OR Claude)'
  },
  {
    name: 'New AI Tools & Launches',
    query: '("AI tool" OR "AI app" OR "AI launch" OR "AI agent" OR "AI assistant")'
  },
  {
    name: 'Coding Agents & Dev Tools',
    query: '("AI coding" OR "coding agent" OR "GitHub Copilot" OR Cursor OR "developer tools" OR "software development AI")'
  },
  {
    name: 'Product Updates & Features',
    query: '("OpenAI" OR "Google Gemini" OR "Anthropic Claude" OR "Microsoft Copilot" OR "Meta AI") ("new feature" OR "release" OR "product update")'
  },
  {
    name: 'Project Ideas & Automation',
    query: '("AI automation" OR "workflow automation" OR "AI workflow" OR "LangChain" OR "n8n" OR "agent workflow")'
  },
  {
    name: 'Open Source & GitHub',
    query: '("open source AI" OR "open-source model" OR "GitHub" OR "Hugging Face" OR "trending repository")'
  },
  {
    name: 'Research & Breakthroughs',
    query: '("AI research" OR "arXiv" OR "machine learning paper" OR "neural network breakthrough")'
  },
  {
    name: 'Cybersecurity',
    query: '("cybersecurity" OR "vulnerability" OR "zero-day" OR "data breach" OR "security advisory" OR "ransomware")'
  },
  {
    name: 'Big Tech & Startups',
    query: '("tech startup" OR "funding" OR NVIDIA OR OpenAI OR Microsoft OR Google) ("acquisition" OR "strategy" OR "launch" OR "valuation")'
  },
  {
    name: 'Data Science & ML',
    query: '("data science" OR "machine learning" OR "PyTorch" OR "vector database" OR "embeddings" OR "data analytics")'
  },
  {
    name: 'Cloud, DBs & Web Dev',
    query: '("cloud computing" OR "AWS" OR "Google Cloud" OR "Azure" OR "PostgreSQL" OR "web development" OR "Next.js" OR "Kubernetes")'
  }
];

const REGIONS = [
  { name: 'Global', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { name: 'India', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' }
];

// ============================================================================
// PUBLIC ENTRY POINTS & USER FUNCTIONS
// ============================================================================

/**
 * Production scheduled entry point.
 * Runs with a 30-second script lock to prevent accidental overlapping executions.
 */
function sendDailyDigest() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.warn('sendDailyDigest skipped: Another execution is currently running.');
    return;
  }

  try {
    runDigest_(false);
  } catch (error) {
    console.error('Daily digest execution failed: ' + (error && error.stack ? error.stack : error));
    sendFailureNotice_(error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends a one-time preview email to your inbox immediately.
 * Does NOT update duplicate history, so your scheduled run will not be affected.
 */
function testDigestNow() {
  Logger.log('Starting on-demand test digest...');
  runDigest_(true);
}

/**
 * Validates Google News RSS feeds using parallel fetching.
 * Logs success counts, candidate headlines, and sample articles per topic.
 */
function testRssFetch() {
  Logger.log('Fetching Google News RSS feeds across all topics and regions...');
  const result = collectNews_();
  Logger.log('====================================================');
  Logger.log(`RSS Feeds Read: ${result.successfulFeeds} / ${result.totalFeeds}`);
  Logger.log(`Unique Articles Collected: ${result.items.length}`);
  Logger.log('====================================================');

  const sample = result.items.slice(0, 10);
  sample.forEach((item, index) => {
    Logger.log(`${index + 1}. [${item.region}] [${item.topic}] ${item.title}`);
    Logger.log(`   Source: ${item.source} | Date: ${item.publishedMs ? new Date(item.publishedMs).toUTCString() : 'Unknown'}`);
    Logger.log(`   URL: ${item.link}`);
  });

  if (result.successfulFeeds === 0) {
    throw new Error('All RSS feeds failed. Verify network connectivity or Google Apps Script UrlFetch permissions.');
  }
}

/**
 * Tests connection to Google Gemini API using your stored GEMINI_API_KEY.
 * Verifies that the API key is active and the model responds properly.
 */
function testGeminiConnection() {
  const apiKey = getApiKey_();
  Logger.log(`Testing Gemini API connection using model '${CONFIG.PRIMARY_MODEL}'...`);

  const prompt = 'Reply with exactly this phrase and nothing else: Gemini API connection successful.';
  const reply = callGeminiRaw_(prompt, CONFIG.PRIMARY_MODEL, apiKey);
  Logger.log('Gemini Response: ' + reply);
  Logger.log('SUCCESS: Gemini API is connected and responding properly.');
}

/**
 * Installs or refreshes the daily 08:00–09:00 AM Asia/Kolkata trigger.
 * Automatically clears previous daily triggers to avoid duplicate emails.
 */
function installDailyTrigger() {
  removeDailyTrigger();

  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  Logger.log(`SUCCESS: Daily trigger installed. The newsletter will run every day between 08:00–09:00 AM (${CONFIG.TIMEZONE}).`);
}

/**
 * Removes any existing daily triggers for sendDailyDigest.
 * Use this to pause automated daily delivery.
 */
function removeDailyTrigger() {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailyDigest') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  });
  Logger.log(`Daily triggers removed: ${count}`);
}

// ============================================================================
// WORKFLOW PIPELINE
// ============================================================================

/**
 * Main coordinator function.
 * @param {boolean} isTestMode - If true, prefixes email subject with [TEST] and skips history saving.
 */
function runDigest_(isTestMode) {
  const recipient = getRecipientEmail_();
  const apiKey = getApiKey_();

  // Check email quota before doing work
  const remainingQuota = MailApp.getRemainingDailyQuota();
  if (remainingQuota < 1) {
    throw new Error('Gmail daily sending quota has been reached. Cannot send email today.');
  }

  // Step 1: Collect news concurrently from Google News RSS
  const collected = collectNews_();
  if (collected.successfulFeeds === 0) {
    throw new Error('All Google News RSS feeds failed. No articles could be collected.');
  }
  if (!collected.items.length) {
    throw new Error('RSS feeds loaded, but zero articles were parsed. Try again shortly.');
  }

  // Step 2: Prepare candidate pool and check recent history
  const candidates = prepareCandidates_(collected.items, isTestMode);
  if (!candidates.length) {
    throw new Error('No candidate stories available after filtering. Please try again later.');
  }

  // Step 3: Summarize and curate using Gemini (with fallback to RSS if AI fails)
  let digest;
  let aiWarning = '';
  try {
    digest = generateDigestWithGemini_(candidates, apiKey);
  } catch (error) {
    aiWarning = 'AI curation was temporarily unavailable, so headlines and RSS snippets are provided below. Details: ' +
      truncateText_(error && error.message ? error.message : String(error), 240);
    console.error('Gemini curation failed; falling back to RSS summaries: ' + aiWarning);
    digest = buildFallbackDigest_(candidates);
  }

  // Step 4: Ensure target story counts (15–20 stories)
  digest = finalizeDigestStories_(digest, candidates);
  if (!digest.stories.length) {
    throw new Error('Digest has no stories ready to email.');
  }

  // Step 5: Render and send email
  const now = new Date();
  const dateLabel = Utilities.formatDate(now, CONFIG.TIMEZONE, 'EEE, dd MMM yyyy');
  const subject = (isTestMode ? '[TEST] ' : '') + 'Daily Tech Digest — ' + dateLabel;
  const htmlBody = renderHtmlEmail_(digest, dateLabel, aiWarning, isTestMode, collected);
  const plainBody = renderPlainEmail_(digest, dateLabel, aiWarning, isTestMode);

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: 'Daily Tech Digest'
  });

  // Step 6: Record sent fingerprints in Script Properties
  if (!isTestMode) {
    saveHistory_(digest.stories);
  }

  Logger.log(`${isTestMode ? 'Test' : 'Daily'} digest sent to ${recipient} with ${digest.stories.length} stories. ` +
    `Feeds: ${collected.successfulFeeds}/${collected.totalFeeds}.`);
}

// ============================================================================
// RSS COLLECTION (PARALLEL FETCH & RESILIENT PARSING)
// ============================================================================

/**
 * Concurrently fetches RSS feeds for all topics and regions using UrlFetchApp.fetchAll.
 */
function collectNews_() {
  const requests = [];
  const requestMeta = [];

  TOPICS.forEach(topic => {
    REGIONS.forEach(region => {
      // when:2d restricts search to the past 48 hours for fresh daily reporting
      const query = `${topic.query} when:2d`;
      const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) +
        '&hl=' + encodeURIComponent(region.hl) +
        '&gl=' + encodeURIComponent(region.gl) +
        '&ceid=' + encodeURIComponent(region.ceid);

      requests.push({
        url: url,
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DailyTechDigest/2.0; +https://developers.google.com)'
        }
      });
      requestMeta.push({ topic: topic.name, region: region.name });
    });
  });

  let responses = [];
  try {
    responses = UrlFetchApp.fetchAll(requests);
  } catch (error) {
    console.warn('Parallel fetchAll error, attempting individual fetches: ' + error.message);
    responses = requests.map(req => {
      try {
        return UrlFetchApp.fetch(req.url, req);
      } catch (e) {
        return null;
      }
    });
  }

  const rawItems = [];
  let successfulFeeds = 0;
  const nowMs = Date.now();
  const maxAgeMs = 48 * 60 * 60 * 1000; // 48 hours

  responses.forEach((response, index) => {
    if (!response) return;
    const meta = requestMeta[index];
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      console.warn(`RSS feed returned HTTP ${status} for ${meta.topic} [${meta.region}]`);
      return;
    }

    const contentText = response.getContentText();
    let feedItems = parseRssXml_(contentText, meta.topic, meta.region);

    // Fallback to regex parser if XML parser failed to find items
    if (!feedItems.length) {
      feedItems = parseRssRegex_(contentText, meta.topic, meta.region);
    }

    if (feedItems.length > 0) {
      successfulFeeds++;
      feedItems.slice(0, CONFIG.MAX_ITEMS_PER_FEED).forEach(item => {
        // Discard stories older than 48 hours if a date is present
        if (item.publishedMs && (nowMs - item.publishedMs > maxAgeMs)) {
          return;
        }
        rawItems.push(item);
      });
    }
  });

  // Sort by publication time (newest first)
  rawItems.sort((a, b) => b.publishedMs - a.publishedMs);

  // In-memory deduplication of identical or normalized titles across different feeds
  const seenKeys = new Set();
  const uniqueItems = [];

  rawItems.forEach(item => {
    const key = normalizeTitle_(item.title);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    uniqueItems.push(item);
  });

  return {
    items: uniqueItems,
    successfulFeeds: successfulFeeds,
    totalFeeds: requests.length
  };
}

/**
 * Parses RSS XML safely using XmlService with pre-sanitization.
 */
function parseRssXml_(xmlText, topicName, regionName) {
  const items = [];
  try {
    const sanitizedXml = sanitizeXml_(xmlText);
    const document = XmlService.parse(sanitizedXml);
    const root = document.getRootElement();
    const channel = root.getChild('channel');
    if (!channel) return items;

    const xmlItems = channel.getChildren('item');
    xmlItems.forEach(rssItem => {
      const source = stripHtml_(getChildText_(rssItem, 'source')) || 'Source unavailable';
      const rawTitle = getChildText_(rssItem, 'title');
      const title = cleanTitle_(stripHtml_(rawTitle), source);
      const link = String(getChildText_(rssItem, 'link') || '').trim();
      const description = stripHtml_(getChildText_(rssItem, 'description'));
      const dateString = getChildText_(rssItem, 'pubDate');
      const parsedDate = dateString ? new Date(dateString) : new Date(0);
      const publishedMs = isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();

      if (!title || !/^https?:\/\//i.test(link)) return;

      items.push({
        topic: topicName,
        region: regionName,
        title: title,
        source: source,
        link: link,
        snippet: truncateText_(description, 350),
        publishedMs: publishedMs,
        fingerprint: computeFingerprint_(title)
      });
    });
  } catch (error) {
    // XmlService failed due to malformed XML; regex fallback will catch it
    console.warn(`XmlService parse warning for ${topicName} [${regionName}]: ${error.message}`);
  }
  return items;
}

/**
 * Fallback regex extractor for RSS items when XML parsing fails.
 */
function parseRssRegex_(xmlText, topicName, regionName) {
  const items = [];
  if (!xmlText) return items;

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    const rawSource = sourceMatch ? sourceMatch[1] : '';
    const source = stripHtml_(rawSource) || 'Source unavailable';
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanTitle_(stripHtml_(rawTitle), source);
    const link = linkMatch ? stripHtml_(linkMatch[1]).trim() : '';
    const desc = descMatch ? stripHtml_(descMatch[1]) : '';
    const dateStr = pubDateMatch ? pubDateMatch[1] : '';
    const parsedDate = dateStr ? new Date(dateStr) : new Date(0);
    const publishedMs = isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();

    if (title && /^https?:\/\//i.test(link)) {
      items.push({
        topic: topicName,
        region: regionName,
        title: title,
        source: source,
        link: link,
        snippet: truncateText_(desc, 350),
        publishedMs: publishedMs,
        fingerprint: computeFingerprint_(title)
      });
    }
  }
  return items;
}

/**
 * Pre-sanitizes raw RSS XML to prevent XML 1.0 parsing exceptions.
 */
function sanitizeXml_(rawXml) {
  if (!rawXml) return '';
  return rawXml
    // Replace unescaped ampersands that are not already part of an entity
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    // Replace common HTML named entities with XML-compatible entities
    .replace(/&nbsp;/g, '&#160;')
    .replace(/&mdash;/g, '&#8212;')
    .replace(/&ndash;/g, '&#8211;')
    .replace(/&hellip;/g, '&#8230;')
    .replace(/&lsquo;/g, '&#8216;')
    .replace(/&rsquo;/g, '&#8217;')
    .replace(/&ldquo;/g, '&#8220;')
    .replace(/&rdquo;/g, '&#8221;');
}

// ============================================================================
// CANDIDATE PREPARATION & HISTORY MANAGEMENT
// ============================================================================

/**
 * Prepares candidate stories and separates fresh stories from recently featured ones.
 */
function prepareCandidates_(items, isTestMode) {
  const history = isTestMode ? [] : loadHistory_();
  const historySet = new Set(history);

  const fresh = [];
  const repeated = [];

  items.forEach(item => {
    const copy = Object.assign({}, item);
    copy.wasSentRecently = historySet.has(item.fingerprint);
    if (copy.wasSentRecently) {
      repeated.push(copy);
    } else {
      fresh.push(copy);
    }
  });

  // Prioritize fresh stories; add repeated only if needed to reach MIN_STORIES
  let chosen = fresh.slice(0, CONFIG.MAX_CANDIDATES_FOR_AI);
  if (chosen.length < CONFIG.MIN_STORIES) {
    const needed = CONFIG.MIN_STORIES - chosen.length;
    chosen = chosen.concat(repeated.slice(0, needed));
  }

  return chosen.slice(0, CONFIG.MAX_CANDIDATES_FOR_AI).map((item, index) => {
    item.id = 'S' + String(index + 1).padStart(3, '0');
    return item;
  });
}

/**
 * Loads recent story fingerprints from Script Properties.
 */
function loadHistory_() {
  const raw = PropertiesService.getScriptProperties().getProperty('SENT_FINGERPRINTS');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch (e) {
    console.warn('Could not parse SENT_FINGERPRINTS history. Starting with empty history.');
    return [];
  }
}

/**
 * Saves story fingerprints to Script Properties, capping at MAX_HISTORY.
 */
function saveHistory_(stories) {
  const props = PropertiesService.getScriptProperties();
  const existing = loadHistory_();
  const existingSet = new Set(existing);

  stories.forEach(story => {
    if (story.fingerprint) {
      existingSet.add(story.fingerprint);
    }
  });

  const updated = Array.from(existingSet).slice(-CONFIG.MAX_HISTORY);
  props.setProperty('SENT_FINGERPRINTS', JSON.stringify(updated));
}

// ============================================================================
// GEMINI API INTEGRATION (STRUCTURED OUTPUTS & RESILIENCE)
// ============================================================================

/**
 * Calls Gemini with structured output enforcement to curate and summarize stories.
 */
function generateDigestWithGemini_(candidates, apiKey) {
  const compactArticles = candidates.map(item => ({
    id: item.id,
    topic: item.topic,
    region: item.region,
    published: item.publishedMs ? Utilities.formatDate(new Date(item.publishedMs), CONFIG.TIMEZONE, 'dd MMM HH:mm') : 'Recent',
    source: item.source,
    title: item.title,
    snippet: item.snippet,
    wasSentRecently: item.wasSentRecently
  }));

  const systemInstructions = [
    'You are the lead editor of a concise, high-value Daily Tech Digest for software developers, AI practitioners, and tech professionals.',
    'TASK: Review the supplied candidate stories and select 15 to 20 distinct, high-impact stories (or all available if fewer than 15).',
    'COVERAGE REQUIREMENTS: Provide a balanced, diverse selection across AI/LLMs, developer tools, coding agents, research breakthroughs, open-source projects, cybersecurity, big tech, cloud/databases, and India technology developments.',
    'DEDUPLICATION RULES: Many news outlets report the exact same event with different headlines. NEVER select two stories covering the same underlying event or announcement. Pick the best single representation.',
    'ACCURACY RULES: Use ONLY facts directly stated in the title and snippet. Never invent quotes, benchmarks, metrics, or feature claims.',
    'WRITING STYLE:',
    '- summary: 2 to 3 clear, informative sentences strictly grounded in the record.',
    '- whyItMatters: Exactly 1 sentence highlighting the practical significance for engineers, builders, or the tech industry.',
    '- tryIt: 1 actionable takeaway, command, tool to test, GitHub repo to explore, or architectural idea. If no actionable tip is sensible, output an empty string.'
  ].join('\n');

  const prompt = [
    systemInstructions,
    'CANDIDATE ARTICLES JSON:',
    JSON.stringify(compactArticles)
  ].join('\n\n');

  // Official OpenAPI responseSchema for Gemini Structured Outputs
  const responseSchema = {
    type: 'OBJECT',
    properties: {
      intro: {
        type: 'STRING',
        description: 'A crisp 1-2 sentence overview of today’s tech landscape.'
      },
      stories: {
        type: 'ARRAY',
        description: 'Curated list of 15 to 20 selected stories.',
        items: {
          type: 'OBJECT',
          properties: {
            id: {
              type: 'STRING',
              description: 'The exact story ID matching a supplied candidate, e.g., S001'
            },
            summary: {
              type: 'STRING',
              description: 'Accurate 2-3 sentence summary grounded in the record.'
            },
            whyItMatters: {
              type: 'STRING',
              description: '1 concise sentence explaining practical significance.'
            },
            tryIt: {
              type: 'STRING',
              description: '1 actionable idea or tool to try. Empty string if not applicable.'
            }
          },
          required: ['id', 'summary', 'whyItMatters']
        }
      }
    },
    required: ['intro', 'stories']
  };

  const responseText = callGeminiWithFallback_(prompt, responseSchema, apiKey);
  const parsed = parseGeminiJson_(responseText);

  if (!parsed || !Array.isArray(parsed.stories)) {
    throw new Error('Gemini response missing stories array.');
  }

  const byId = new Map();
  candidates.forEach(item => byId.set(item.id, item));

  const seenIds = new Set();
  const selectedStories = [];

  parsed.stories.slice(0, CONFIG.MAX_STORIES).forEach(generated => {
    if (!generated || !generated.id || !byId.has(generated.id) || seenIds.has(generated.id)) {
      return;
    }
    seenIds.add(generated.id);
    const original = byId.get(generated.id);

    selectedStories.push(Object.assign({}, original, {
      summary: truncateText_(String(generated.summary || '').trim(), 600),
      whyItMatters: truncateText_(String(generated.whyItMatters || '').trim(), 300),
      tryIt: truncateText_(String(generated.tryIt || '').trim(), 250),
      aiWritten: true
    }));
  });

  return {
    intro: truncateText_(String(parsed.intro || '').trim(), 300),
    stories: selectedStories
  };
}

/**
 * Calls Gemini using primary model with retry logic; falls back to secondary model if needed.
 */
function callGeminiWithFallback_(prompt, responseSchema, apiKey) {
  // Attempt 1: Primary Model
  try {
    return callGeminiApi_(prompt, responseSchema, CONFIG.PRIMARY_MODEL, apiKey);
  } catch (primaryError) {
    console.warn(`Primary model ${CONFIG.PRIMARY_MODEL} failed: ${primaryError.message}. Trying fallback ${CONFIG.FALLBACK_MODEL}...`);
  }

  // Attempt 2: Fallback Model
  try {
    return callGeminiApi_(prompt, responseSchema, CONFIG.FALLBACK_MODEL, apiKey);
  } catch (fallbackError) {
    throw new Error(`Both ${CONFIG.PRIMARY_MODEL} and ${CONFIG.FALLBACK_MODEL} failed. Last error: ${fallbackError.message}`);
  }
}

/**
 * Performs HTTP POST to Gemini generateContent endpoint with retries on rate limits.
 */
function callGeminiApi_(prompt, responseSchema, modelName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 16384,
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
    thinkingConfig: {
      thinkingLevel: 'low'
    }
  };

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: generationConfig
  };

  let lastError;
  for (let attempt = 0; attempt <= CONFIG.MAX_API_RETRIES; attempt++) {
    if (attempt > 0) {
      Logger.log(`Retrying Gemini API call (${attempt}/${CONFIG.MAX_API_RETRIES}) after delay...`);
      Utilities.sleep(CONFIG.RETRY_DELAY_MS * attempt);
    }

    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      const responseText = response.getContentText();

      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {}

      // If a model rejects thinkingConfig (HTTP 400), remove it and retry immediately
      if (status === 400 && payload.generationConfig && payload.generationConfig.thinkingConfig) {
        console.warn(`Model ${modelName} rejected thinkingConfig; retrying without it.`);
        delete payload.generationConfig.thinkingConfig;
        continue;
      }

      if (status >= 200 && status < 300) {
        const candidates = data && data.candidates ? data.candidates : [];
        if (!candidates.length || !candidates[0].content || !candidates[0].content.parts) {
          throw new Error('Gemini API returned no candidate content.');
        }

        // Filter out internal thought parts returned by reasoning models like gemini-3.8-flash
        const contentParts = candidates[0].content.parts.filter(p => !p.thought);
        const text = (contentParts.length ? contentParts : candidates[0].content.parts)
          .map(p => p.text || '').join('').trim();

        if (!text) {
          throw new Error('Gemini API returned an empty text response.');
        }
        return text;
      }

      // Handle specific error codes
      const errorMsg = data && data.error && data.error.message ? data.error.message : `HTTP ${status}`;
      if (status === 429 || status === 503) {
        lastError = new Error(`Gemini rate limited / busy (${status}): ${errorMsg}`);
        continue; // Retry
      } else {
        throw new Error(`Gemini API HTTP ${status}: ${errorMsg}`);
      }
    } catch (err) {
      lastError = err;
      if (attempt === CONFIG.MAX_API_RETRIES) throw lastError;
    }
  }

  throw lastError || new Error('Gemini API request failed after retries.');
}

/**
 * Raw non-JSON text call used by testGeminiConnection.
 */
function callGeminiRaw_(prompt, modelName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  let data = {};
  try { data = JSON.parse(text); } catch (e) {}

  if (status < 200 || status >= 300) {
    const msg = data && data.error && data.error.message ? data.error.message : text;
    throw new Error(`Gemini API HTTP ${status}: ${msg}`);
  }

  const candidates = data && data.candidates ? data.candidates : [];
  if (!candidates.length || !candidates[0].content || !candidates[0].content.parts) {
    throw new Error('No content returned from Gemini.');
  }
  return candidates[0].content.parts.map(p => p.text || '').join('').trim();
}

/**
 * Fallback digest when Gemini is unavailable.
 */
function buildFallbackDigest_(candidates) {
  return {
    intro: 'Today’s top technology headlines collected from Google News RSS. (AI summaries were unavailable for this issue).',
    stories: candidates.slice(0, CONFIG.MAX_STORIES).map(item => Object.assign({}, item, {
      summary: item.snippet || 'Open the original article link for full coverage.',
      whyItMatters: '',
      tryIt: '',
      aiWritten: false
    }))
  };
}

/**
 * Ensures the digest meets story count targets (15–20 stories).
 */
function finalizeDigestStories_(digest, candidates) {
  const byId = new Map();
  candidates.forEach(item => byId.set(item.id, item));

  const result = [];
  const usedIds = new Set();

  (digest && Array.isArray(digest.stories) ? digest.stories : []).forEach(story => {
    if (!story || !story.id || !byId.has(story.id) || usedIds.has(story.id) || result.length >= CONFIG.MAX_STORIES) {
      return;
    }
    usedIds.add(story.id);
    const original = byId.get(story.id);
    result.push(Object.assign({}, original, story, {
      summary: story.summary || original.snippet || 'Open source for details.',
      whyItMatters: story.whyItMatters || '',
      tryIt: story.tryIt || ''
    }));
  });

  // Top up with remaining candidates if fewer than MIN_STORIES
  candidates.forEach(item => {
    if (result.length >= CONFIG.MIN_STORIES || result.length >= CONFIG.MAX_STORIES || usedIds.has(item.id)) {
      return;
    }
    usedIds.add(item.id);
    result.push(Object.assign({}, item, {
      summary: item.snippet || 'Open source for details.',
      whyItMatters: '',
      tryIt: '',
      aiWritten: false
    }));
  });

  return {
    intro: digest && digest.intro ? digest.intro : 'Your daily briefing on AI and technology.',
    stories: result.slice(0, CONFIG.MAX_STORIES)
  };
}

// ============================================================================
// EMAIL RENDERING (MOBILE-RESPONSIVE HTML & CLEAN PLAIN TEXT)
// ============================================================================

/**
 * Renders a clean, modern, mobile-friendly HTML email template.
 */
function renderHtmlEmail_(digest, dateLabel, aiWarning, isTestMode, collected) {
  const storyCount = digest.stories.length;
  const readTimeMin = Math.max(4, Math.round(storyCount * 0.35));

  let html = '';
  html += '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  html += '<title>Daily Tech Digest</title></head>';
  html += '<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">';

  // Container
  html += '<div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -2px rgba(0,0,0,0.05);">';

  // Header
  html += '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;padding:32px 28px 24px;border-bottom:3px solid #0284c7;">';
  html += '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#38bdf8;margin-bottom:6px;">Personal AI Briefing</div>';
  html += '<h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 10px;color:#ffffff;">Daily Tech Digest</h1>';
  html += '<div style="font-size:13px;color:#cbd5e1;line-height:1.5;">' +
    escapeHtml_(dateLabel) + ' &bull; Global &amp; India &bull; ' + storyCount + ' stories &bull; ~' + readTimeMin + ' min read</div>';
  html += '</div>';

  // Main Content Body
  html += '<div style="padding:24px 28px;">';

  // Test banner
  if (isTestMode) {
    html += '<div style="padding:12px 16px;margin-bottom:20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;font-size:13px;color:#92400e;">';
    html += '<strong>Test Delivery:</strong> This is a preview run. Story fingerprints were not saved to history.';
    html += '</div>';
  }

  // AI warning banner (if fallen back)
  if (aiWarning) {
    html += '<div style="padding:12px 16px;margin-bottom:20px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:6px;font-size:13px;color:#9a3412;">';
    html += escapeHtml_(aiWarning);
    html += '</div>';
  }

  // Intro paragraph
  html += '<div style="font-size:15px;line-height:1.6;color:#334155;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:22px;">';
  html += escapeHtml_(digest.intro || 'Your curated daily briefing on AI, tools, engineering, and tech developments.');
  html += '</div>';

  // Story Cards
  digest.stories.forEach((story, index) => {
    const articleTime = story.publishedMs ?
      Utilities.formatDate(new Date(story.publishedMs), CONFIG.TIMEZONE, 'dd MMM, HH:mm') + ' IST' : 'Recent';

    const isIndia = (story.region || '').toLowerCase() === 'india';
    const regionBg = isIndia ? '#fef3c7' : '#f1f5f9';
    const regionColor = isIndia ? '#92400e' : '#475569';

    html += '<div style="padding:20px 0;border-bottom:1px solid #f1f5f9;">';

    // Metadata Row: Number, Topic Pill, Region Pill, Time
    html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
    html += '<span style="font-size:12px;font-weight:700;color:#64748b;margin-right:4px;">#' + String(index + 1).padStart(2, '0') + '</span>';
    html += '<span style="display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;border-radius:12px;background:#e0f2fe;color:#0369a1;">' + escapeHtml_(story.topic) + '</span>';
    html += '<span style="display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;border-radius:12px;background:' + regionBg + ';color:' + regionColor + ';">' + escapeHtml_(story.region) + '</span>';
    html += '<span style="font-size:12px;color:#94a3b8;margin-left:auto;">' + escapeHtml_(articleTime) + '</span>';
    html += '</div>';

    // Headline
    html += '<h2 style="font-size:17px;font-weight:700;line-height:1.35;margin:0 0 6px;color:#0f172a;">';
    html += escapeHtml_(story.title);
    html += '</h2>';

    // Source
    html += '<div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:10px;">';
    html += 'Source: ' + escapeHtml_(story.source || 'Google News');
    if (story.wasSentRecently) {
      html += ' &bull; <span style="color:#d97706;">Previously featured</span>';
    }
    html += '</div>';

    // Summary
    html += '<p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 10px;">';
    html += escapeHtml_(story.summary || story.snippet);
    html += '</p>';

    // Why It Matters
    if (story.whyItMatters) {
      html += '<div style="margin:8px 0;padding:8px 12px;background:#f8fafc;border-left:3px solid #0284c7;border-radius:0 6px 6px 0;font-size:13px;line-height:1.5;color:#1e293b;">';
      html += '<strong style="color:#0369a1;">Why it matters:</strong> ' + escapeHtml_(story.whyItMatters);
      html += '</div>';
    }

    // Try It / Actionable Idea
    if (story.tryIt) {
      html += '<div style="margin:8px 0;padding:8px 12px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;font-size:13px;line-height:1.5;color:#14532d;">';
      html += '<strong style="color:#15803d;">Try / explore:</strong> ' + escapeHtml_(story.tryIt);
      html += '</div>';
    }

    // Read Source Link
    if (/^https?:\/\//i.test(story.link || '')) {
      html += '<div style="margin-top:10px;">';
      html += '<a href="' + escapeHtml_(story.link) + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;font-size:13px;font-weight:600;color:#0284c7;text-decoration:none;">';
      html += 'Read original story &rarr;</a>';
      html += '</div>';
    }

    html += '</div>';
  });

  // Footer
  html += '<div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">';
  html += '<div>Generated by <strong>Daily Tech Digest</strong> using Google Apps Script &amp; Google Gemini API.</div>';
  html += '<div>Summaries are grounded in Google News RSS snippets. Open original articles for full details.</div>';
  html += '<div style="margin-top:6px;">To pause delivery, run <code>removeDailyTrigger()</code> in Apps Script.</div>';
  html += '</div>';

  html += '</div>'; // End padding
  html += '</div>'; // End container
  html += '</body></html>';

  return html;
}

/**
 * Plain-text fallback email rendering.
 */
function renderPlainEmail_(digest, dateLabel, aiWarning, isTestMode) {
  let body = (isTestMode ? '[TEST] ' : '') + 'DAILY TECH DIGEST\n';
  body += dateLabel + ' · Global & India · ' + digest.stories.length + ' stories\n';
  body += '====================================================\n\n';

  if (aiWarning) {
    body += 'NOTE: ' + aiWarning + '\n\n';
  }

  body += (digest.intro || 'Your curated daily briefing on AI and technology.') + '\n\n';

  digest.stories.forEach((story, index) => {
    body += `----------------------------------------------------\n`;
    body += `${index + 1}. [${story.topic} | ${story.region}] ${story.title}\n`;
    body += `Source: ${story.source || 'Google News'}\n\n`;
    body += (story.summary || story.snippet) + '\n';
    if (story.whyItMatters) {
      body += `Why it matters: ${story.whyItMatters}\n`;
    }
    if (story.tryIt) {
      body += `Try / explore: ${story.tryIt}\n`;
    }
    body += `Link: ${story.link}\n\n`;
  });

  body += '====================================================\n';
  body += 'Summaries are AI-generated from Google News RSS. Open links to read full stories.\n';
  return body;
}

// ============================================================================
// FAILURE NOTICES & UTILITIES
// ============================================================================

/**
 * Sends a sanitized email notification if the scheduled digest fails completely.
 */
function sendFailureNotice_(error) {
  try {
    const recipient = getRecipientEmail_();
    if (!recipient || recipient === 'YOUR_EMAIL@gmail.com') return;
    if (MailApp.getRemainingDailyQuota() < 1) return;

    // Sanitize error message to ensure no keys or tokens leak
    const rawMsg = error && error.message ? error.message : String(error);
    const sanitizedMsg = rawMsg.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');

    const message = 'The scheduled Daily Tech Digest encountered an error and could not complete.\n\n' +
      'Error details: ' + truncateText_(sanitizedMsg, 500) + '\n\n' +
      'Next Steps:\n' +
      '1. Open Google Apps Script > Executions to inspect the failure.\n' +
      '2. Run testGeminiConnection() to confirm your GEMINI_API_KEY is working.\n' +
      '3. Run testRssFetch() to check Google News RSS connectivity.';

    MailApp.sendEmail({
      to: recipient,
      subject: 'Daily Tech Digest — Run Failed',
      body: message,
      name: 'Daily Tech Digest'
    });
  } catch (noticeError) {
    console.error('Could not send failure notification email: ' + noticeError);
  }
}

/**
 * Resolves the recipient email from CONFIG or Script Properties.
 */
function getRecipientEmail_() {
  const propEmail = PropertiesService.getScriptProperties().getProperty('RECIPIENT_EMAIL');
  const email = (propEmail || CONFIG.RECIPIENT_EMAIL || '').trim();

  if (!email || email === 'YOUR_EMAIL@gmail.com' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Valid recipient email not configured. Please set CONFIG.RECIPIENT_EMAIL or Script Property "RECIPIENT_EMAIL".');
  }
  return email;
}

/**
 * Retrieves the Gemini API key from Script Properties.
 */
function getApiKey_() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing GEMINI_API_KEY. Add it under Project Settings > Script Properties in Google Apps Script.');
  }
  return apiKey.trim();
}

function getChildText_(parent, childName) {
  const child = parent.getChild(childName);
  return child ? child.getText() : '';
}

function stripHtml_(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle_(title, source) {
  let clean = String(title || '').trim();
  const suffix = ' - ' + String(source || '').trim();
  if (source && clean.toLowerCase().endsWith(suffix.toLowerCase())) {
    clean = clean.substring(0, clean.length - suffix.length).trim();
  }
  return clean;
}

function normalizeTitle_(title) {
  return String(title || '').toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a compact 16-character SHA-256 fingerprint for deduplication.
 */
function computeFingerprint_(title) {
  const normalized = normalizeTitle_(title);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized);
  return Utilities.base64EncodeWebSafe(digest).substring(0, 16);
}

function truncateText_(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength - 1).trim() + '…' : text;
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripJsonFence_(value) {
  if (!value) return '{}';
  const text = String(value).trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Resilient JSON parser that handles both clean JSON and safely recovers
 * complete stories if an output was clipped.
 */
function parseGeminiJson_(responseText) {
  const cleaned = stripJsonFence_(responseText);
  try {
    return JSON.parse(cleaned);
  } catch (initialError) {
    console.warn(`Direct JSON.parse failed (${initialError.message}). Attempting resilient repair...`);
    const lastStoryEnd = cleaned.lastIndexOf('},');
    const lastObjectEnd = cleaned.lastIndexOf('}');
    const cutPoint = Math.max(lastStoryEnd !== -1 ? lastStoryEnd + 1 : -1, lastObjectEnd);
    if (cutPoint !== -1) {
      const candidateRepair = cleaned.substring(0, cutPoint).trim();
      const repaired = candidateRepair.endsWith(']') ? candidateRepair + '}' : candidateRepair + ']}';
      try {
        const repairedData = JSON.parse(repaired);
        if (repairedData && Array.isArray(repairedData.stories) && repairedData.stories.length > 0) {
          console.log(`Successfully recovered ${repairedData.stories.length} stories from truncated response.`);
          return repairedData;
        }
      } catch (repairError) {}
    }
    throw new Error('Gemini returned text that could not be parsed as JSON: ' + initialError.message);
  }
}
