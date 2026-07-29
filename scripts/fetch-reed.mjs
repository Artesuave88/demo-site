const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const REED_PAGE_SIZE = 100;
const REED_MAX_PAGES = 100;

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
  const minimum = Number(job.minimumSalary);
  const maximum = Number(job.maximumSalary);
  const currency = clean(job.currency) || 'GBP';
  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);

  if (minimum && maximum && minimum !== maximum) return `${money(minimum)} to ${money(maximum)}`;
  if (minimum || maximum) return money(minimum || maximum);
  return 'Salary not listed';
}

function teamFrom(job) {
  const value = `${job.jobTitle || ''} ${job.jobDescription || ''}`.toLowerCase();
  if (value.includes('mental health')) return 'Mental Health';
  if (value.includes('child') || value.includes('family')) return 'Children & Families';
  if (value.includes('foster')) return 'Fostering';
  if (value.includes('learning disabil')) return 'Learning Disabilities';
  if (value.includes('adult')) return 'Adult Social Care';
  return 'Social Work';
}

function mapJob(job) {
  const title = clean(job.jobTitle);
  const description = clean(job.jobDescription);
  const location = clean(job.locationName) || 'United Kingdom';

  return {
    id: `reed-${job.jobId}`,
    title,
    employer: clean(job.employerName) || 'Employer not listed',
    location,
    region: location,
    type: /contract|temporary|fixed[- ]?term/i.test(`${title} ${description}`)
      ? 'Contract'
      : 'Permanent',
    mode: /remote|home[- ]?based|work from home/i.test(`${title} ${description}`)
      ? 'Remote'
      : /hybrid/i.test(`${title} ${description}`)
        ? 'Hybrid'
        : 'On-site',
    pattern: /part[- ]?time/i.test(`${title} ${description}`)
      ? 'Part time'
      : /full[- ]?time/i.test(`${title} ${description}`)
        ? 'Full time'
        : 'Not specified',
    salary: salaryLabel(job),
    posted: dateLabel(job.date),
    closing: dateLabel(job.expirationDate),
    team: teamFrom(job),
    source: 'Reed',
    url: job.jobUrl,
    featured: false
  };
}

export async function fetchReed() {
  const key = process.env.REED_API_KEY;
  if (!key) throw new Error('REED_API_KEY is not configured');

  const authorization = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  const rawJobs = [];

  for (let page = 0; page < REED_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      keywords: 'social worker',
      resultsToTake: String(REED_PAGE_SIZE),
      resultsToSkip: String(page * REED_PAGE_SIZE)
    });
    const response = await fetch(`https://www.reed.co.uk/api/1.0/search?${params}`, {
      headers: { accept: 'application/json', authorization },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`Reed page ${page + 1} returned HTTP ${response.status}`);
    const payload = await response.json();
    const pageJobs = payload.results || [];
    rawJobs.push(...pageJobs);

    if (pageJobs.length < REED_PAGE_SIZE || rawJobs.length >= Number(payload.totalResults || 0)) break;
  }

  const jobs = rawJobs
    .filter((job) => /\bsocial\s+work(?:er|ers|ing)?\b/i.test(clean(job.jobTitle)))
    .map(mapJob)
    .filter((job) => job.title && job.url);

  return {
    source: 'Reed',
    url: 'https://www.reed.co.uk/',
    fetchedAt: new Date().toISOString(),
    jobs: [...new Map(jobs.map((job) => [job.id, job])).values()]
  };
}
