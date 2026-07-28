import { env } from '$env/dynamic/private';
import snapshot from '$lib/jobs.json';

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const normalise = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ADZUNA_PAGE_SIZE = 50;

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

function mapAdzunaJob(job) {
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

async function fetchAdzunaJobs(fetcher) {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return { jobs: [], error: null };

  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    what: 'social worker',
    results_per_page: String(ADZUNA_PAGE_SIZE),
    sort_by: 'date',
    'content-type': 'application/json'
  });

  try {
    const response = await fetcher(
      `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      }
    );
    if (!response.ok) {
      if (response.status === 429) {
        return { jobs: [], error: null };
      }
      throw new Error(`Adzuna returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    const jobs = (payload.results || [])
      .map(mapAdzunaJob)
      .filter((job) => job.title && job.url);

    return {
      jobs: [...new Map(jobs.map((job) => [job.id, job])).values()],
      error: null
    };
  } catch (error) {
    return { jobs: [], error: error instanceof Error ? error.message : 'Adzuna refresh failed' };
  }
}

function dedupeKey(job) {
  return [
    normalise(job.title),
    normalise(job.employer),
    normalise(job.location),
    normalise(job.closing)
  ].join('|');
}

export async function load({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=3600' });
  const adzuna = await fetchAdzunaJobs(fetch);
  const jobs = [...new Map(
    [...snapshot.jobs, ...adzuna.jobs].map((job) => [dedupeKey(job), job])
  ).values()];
  const errors = [...(snapshot.errors || []), ...(adzuna.error ? [adzuna.error] : [])];

  return {
    ...snapshot,
    jobs,
    error: errors.length ? errors.join('; ') : null
  };
}
