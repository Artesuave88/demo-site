const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const ADZUNA_PAGE_SIZE = 50;
const ADZUNA_MAX_PAGES = 80;
const ADZUNA_REQUEST_INTERVAL_MS = 2500;
const ADZUNA_MAX_RETRIES = 3;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchPage(url, page) {
  for (let attempt = 1; attempt <= ADZUNA_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) return response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === ADZUNA_MAX_RETRIES) {
        throw new Error(`Adzuna page ${page} returned HTTP ${response.status}`);
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      await wait(Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : attempt * 3000);
    } catch (error) {
      if (attempt === ADZUNA_MAX_RETRIES) throw error;
      await wait(attempt * 3000);
    }
  }
}

function dateLabel(value) {
  if (!value) return 'Not listed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not listed';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London'
  }).format(date);
}

function salaryLabel(job) {
  const minimum = Number(job.salary_min);
  const maximum = Number(job.salary_max);
  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(value);

  if (minimum && maximum && minimum !== maximum) return `${money(minimum)} to ${money(maximum)}`;
  if (minimum || maximum) return money(minimum || maximum);
  return 'Salary not listed';
}

function teamFrom(job) {
  const value = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  if (value.includes('mental health')) return 'Mental Health';
  if (value.includes('child') || value.includes('family')) return 'Children & Families';
  if (value.includes('foster')) return 'Fostering';
  if (value.includes('learning disabil')) return 'Learning Disabilities';
  if (value.includes('adult')) return 'Adult Social Care';
  return 'Social Work';
}

function mapJob(job) {
  const location = clean(job.location?.display_name) || 'United Kingdom';
  const description = clean(job.description);
  const contract = clean(job.contract_type);
  const pattern = job.contract_time === 'part_time'
    ? 'Part time'
    : job.contract_time === 'full_time'
      ? 'Full time'
      : 'Not specified';

  return {
    id: `adzuna-${job.id}`,
    title: clean(job.title),
    employer: clean(job.company?.display_name) || 'Employer not listed',
    location,
    region: location,
    type: /contract|temporary|fixed/i.test(`${contract} ${description}`) ? 'Contract' : 'Permanent',
    mode: /remote|home[- ]?based/i.test(description)
      ? 'Remote'
      : /hybrid/i.test(description)
        ? 'Hybrid'
        : 'On-site',
    pattern,
    salary: salaryLabel(job),
    posted: dateLabel(job.created),
    closing: dateLabel(job.expires_at),
    team: teamFrom(job),
    source: 'Adzuna',
    url: job.redirect_url,
    featured: false
  };
}

export async function fetchAdzuna() {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY are not configured');

  const rawJobs = [];
  let warning = null;
  for (let page = 1; page <= ADZUNA_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what: 'social worker',
      results_per_page: String(ADZUNA_PAGE_SIZE),
      sort_by: 'date',
      'content-type': 'application/json'
    });

    let payload;
    try {
      payload = await fetchPage(
        `https://api.adzuna.com/v1/api/jobs/gb/search/${page}?${params}`,
        page
      );
    } catch (error) {
      if (!rawJobs.length) throw error;
      warning = error instanceof Error ? error.message : String(error);
      break;
    }

    const pageJobs = payload.results || [];
    rawJobs.push(...pageJobs);

    if (pageJobs.length < ADZUNA_PAGE_SIZE) break;
    if (page < ADZUNA_MAX_PAGES) await wait(ADZUNA_REQUEST_INTERVAL_MS);
  }

  const jobs = rawJobs
    .filter((job) => /\bsocial\s+work(?:er|ers|ing)?\b/i.test(clean(job.title)))
    .map(mapJob)
    .filter((job) => job.title && job.url);

  return {
    source: 'Adzuna',
    url: 'https://www.adzuna.co.uk/',
    fetchedAt: new Date().toISOString(),
    ...(warning ? { warning } : {}),
    jobs: [...new Map(jobs.map((job) => [job.id, job])).values()]
  };
}
