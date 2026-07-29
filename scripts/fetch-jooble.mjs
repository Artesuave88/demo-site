const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const JOOBLE_PAGE_SIZE = 100;
const JOOBLE_PAGES = 10;

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
  const description = clean(job.snippet);
  const type = clean(job.type);
  const location = clean(job.location) || 'United Kingdom';

  return {
    id: `jooble-${job.id}`,
    title: clean(job.title),
    employer: clean(job.company) || 'Employer not listed',
    location,
    region: location,
    type: /contract|temporary|fixed/i.test(`${type} ${description}`) ? 'Contract' : 'Permanent',
    mode: /remote|home[- ]?based/i.test(`${job.title || ''} ${description}`)
      ? 'Remote'
      : /hybrid/i.test(`${job.title || ''} ${description}`)
        ? 'Hybrid'
        : 'On-site',
    pattern: /part[- ]?time/i.test(type)
      ? 'Part time'
      : /full[- ]?time/i.test(type)
        ? 'Full time'
        : 'Not specified',
    salary: clean(job.salary) || 'Salary not listed',
    posted: dateLabel(job.updated),
    closing: 'Not listed',
    team: teamFrom({ title: job.title, description }),
    source: 'Jooble',
    url: job.link,
    featured: false
  };
}

export async function fetchJooble() {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) throw new Error('JOOBLE_API_KEY is not configured');

  const rawJobs = [];
  for (let page = 1; page <= JOOBLE_PAGES; page += 1) {
    const response = await fetch(`https://uk.jooble.org/api/${key}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        keywords: 'social worker',
        location: 'United Kingdom',
        page: String(page),
        ResultOnPage: String(JOOBLE_PAGE_SIZE),
        companysearch: 'false'
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`Jooble page ${page} returned HTTP ${response.status}`);
    const payload = await response.json();
    rawJobs.push(...(payload.jobs || []));
  }

  const jobs = rawJobs
    .filter((job) => /\bsocial\s+work(?:er|ers|ing)?\b/i.test(clean(job.title)))
    .map(mapJob)
    .filter((job) => job.title && job.url);

  return {
    source: 'Jooble',
    url: 'https://uk.jooble.org/',
    fetchedAt: new Date().toISOString(),
    jobs: [...new Map(jobs.map((job) => [job.id, job])).values()]
  };
}
