import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface JobResult { text: string; title?: string; company?: string; }

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ').trim()
    .slice(0, 4000);
}

function titleCase(slug: string): string {
  return slug.replace(/[-_]/g, ' ')
    .replace(/\b(inc|llc|co|corp|ltd|labs?|hq|jobs|the)\b/gi, '')
    .split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
}

// ── GREENHOUSE ──────────────────────────────────────────────
async function fetchGreenhouse(url: string): Promise<JobResult> {
  const match = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
  if (!match) throw new Error('Could not parse Greenhouse URL');
  const [, companySlug, jobId] = match;
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Greenhouse API error ${res.status}`);
  const data = await res.json();
  // Try to get the real company name from the board metadata
  let company = titleCase(companySlug);
  try {
    const boardRes = await fetch(`https://boards-api.greenhouse.io/v1/boards/${companySlug}`);
    if (boardRes.ok) {
      const boardData = await boardRes.json();
      if (boardData.name) company = boardData.name;
    }
  } catch {}
  const text = [
    data.departments?.map((d: {name: string}) => d.name).join(', '),
    data.offices?.map((o: {name: string}) => o.name).join(', '),
    stripHtml(data.content || '')
  ].filter(Boolean).join('\n\n');
  return { text, title: data.title, company };
}

// ── LEVER ───────────────────────────────────────────────────
async function fetchLever(url: string): Promise<JobResult> {
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?]+)/);
  if (!match) throw new Error('Could not parse Lever URL');
  const [, companySlug, jobId] = match;
  const res = await fetch(`https://api.lever.co/v0/postings/${companySlug}/${jobId}?mode=json`);
  if (!res.ok) throw new Error(`Lever API error ${res.status}`);
  const data = await res.json();
  const lists = (data.lists || []).map((l: {text: string; content: string}) =>
    `${l.text}:\n${stripHtml(l.content || '')}`).join('\n\n');
  const text = [
    data.categories?.team, data.categories?.location,
    data.descriptionPlain, lists
  ].filter(Boolean).join('\n\n').slice(0, 4000);
  return { text, title: data.text, company: titleCase(companySlug) };
}

// ── WORKDAY ─────────────────────────────────────────────────
// URL: https://TENANT.wdN.myworkdayjobs.com/[locale]/BOARD/job/LOCATION/TITLE_JOBID
async function fetchWorkday(url: string): Promise<JobResult> {
  const parsed = new URL(url);
  const host = parsed.hostname; // keep full hostname with wd1/wd5/etc
  const tenant = host.split('.')[0];
  const company = titleCase(tenant);
  const parts = parsed.pathname.split('/').filter(Boolean);

  // Skip optional locale segment like 'en-US'
  const localeRegex = /^[a-z]{2}-[A-Z]{2}$/;
  const boardIdx = localeRegex.test(parts[0]) ? 1 : 0;
  const board = parts[boardIdx];

  // Find 'job' segment — everything after it is the job path
  const jobIdx = parts.indexOf('job');
  if (jobIdx === -1 || !board) {
    throw new Error('Open a specific job posting and paste that URL (not the job board homepage).');
  }

  const jobPath = parts.slice(jobIdx + 1).join('/');

  // Try Workday's CXS job API
  const apiUrl = `https://${host}/wday/cxs/${tenant}/${board}/job/${jobPath}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { ...HEADERS, 'Accept': 'application/json,application/xml' }
    });
    if (res.ok) {
      const data = await res.json();
      const desc = data.jobPostingInfo;
      if (desc) {
        const text = [
          desc?.location,
          stripHtml(desc?.jobDescription || '')
        ].filter(Boolean).join('\n\n').slice(0, 4000);
        return { text, title: desc?.title, company };
      }
    }
  } catch {}

  // Fallback: scrape the page HTML directly
  const pageRes = await fetch(url, { headers: HEADERS });
  if (!pageRes.ok) throw new Error(`Workday page error ${pageRes.status}`);
  const html = await pageRes.text();
  const titleMatch = html.match(/<title>([^<|]+)/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : undefined;
  return { text: stripHtml(html).slice(0, 4000), title: pageTitle, company };
}

// ── ASHBY ────────────────────────────────────────────────────
async function fetchAshby(url: string): Promise<JobResult> {
  const match = url.match(/jobs\.ashbyhq\.com\/([^/]+)\/([^/?]+)/);
  if (!match) throw new Error('Could not parse Ashby URL');
  const [, companySlug, jobId] = match;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Ashby fetch error ${res.status}`);
  const html = await res.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const job = nextData?.props?.pageProps?.jobPosting
        || nextData?.props?.pageProps?.initialData?.jobPosting;
      const orgName = nextData?.props?.pageProps?.organization?.name
        || nextData?.props?.pageProps?.initialData?.organization?.name;
      if (job) {
        return {
          text: [job.team?.name, job.location, stripHtml(job.descriptionHtml || job.description || '')]
            .filter(Boolean).join('\n\n').slice(0, 4000),
          title: job.title,
          company: orgName || titleCase(companySlug)
        };
      }
    } catch {}
  }
  // API fallback
  const apiRes = await fetch(
    `https://api.ashbyhq.com/posting-public/job-board/v1/${companySlug}/job/${jobId}`,
    { headers: { 'Accept': 'application/json' } }
  );
  if (apiRes.ok) {
    const data = await apiRes.json();
    const j = data.job || data;
    return {
      text: [j.team?.name, j.location, stripHtml(j.descriptionHtml || j.description || '')]
        .filter(Boolean).join('\n\n').slice(0, 4000),
      title: j.title,
      company: data.organization?.name || titleCase(companySlug)
    };
  }
  return { text: stripHtml(html), company: titleCase(companySlug) };
}

// ── GENERIC fallback ─────────────────────────────────────────
async function fetchGeneric(url: string): Promise<JobResult> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Try to grab <title>
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  return { text: stripHtml(html), title };
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL required' });

  const decoded = decodeURIComponent(url);
  try {
    let result: JobResult;
    if (/greenhouse\.io/i.test(decoded))          result = await fetchGreenhouse(decoded);
    else if (/lever\.co/i.test(decoded))          result = await fetchLever(decoded);
    else if (/myworkdayjobs\.com/i.test(decoded)) result = await fetchWorkday(decoded);
    else if (/ashbyhq\.com/i.test(decoded))       result = await fetchAshby(decoded);
    else                                           result = await fetchGeneric(decoded);

    return res.status(200).json(result);
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Fetch failed' });
  }
}
