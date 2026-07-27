import * as cheerio from 'cheerio';

const BASE = 'https://www.jobsgopublic.com';
const SEARCH = `${BASE}/jobs?search=social%20worker`;
const CONCURRENCY = 6;
const PAGE_SIZE = 25;

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function teamFrom(title) {
  const value = title.toLowerCase();
  if (value.includes('mental health')) return 'Mental Health';
  if (value.includes('child') || value.includes('family')) return 'Children & Families';
  if (value.includes('foster')) return 'Fostering';
  if (value.includes('learning disabil')) return 'Learning Disabilities';
  if (value.includes('adult')) return 'Adult Social Care';
  return 'Social Work';
}

async function fetchHtml(url, attempts = 3) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'socialworkjobs.uk/1.0 (+UK social-work vacancy index)' },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempts <= 1) throw error;
    await delay(700 * (4 - attempts));
    return fetchHtml(url, attempts - 1);
  }
}

function nextData(html) {
  const $ = cheerio.load(html);
  const payload = $('#__NEXT_DATA__').text();
  if (!payload) throw new Error('Jobs Go Public page did not contain structured job data');
  return JSON.parse(payload).props.pageProps;
}

function exactSocialWorker(job) {
  return /\bsocial\s+worker\b/i.test(job.title || '');
}

function dateLabel(value) {
  if (!value) return 'Not listed';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London'
  }).format(new Date(value));
}

function salaryLabel(job) {
  const salary = job.salaryRangeFree || job.schemaOrgSalary;
  const min = Number(salary?.minSalary || salary?.minValue?.number);
  const max = Number(salary?.maxSalary || salary?.maxValue?.number);
  const unit = clean(salary?.salaryUnit || salary?.unitText || '').toLowerCase();
  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: salary?.currencyCode || 'GBP',
    maximumFractionDigits: 0
  }).format(value);
  if (min && max && min !== max) return `${money(min)} to ${money(max)}${unit ? ` a ${unit}` : ''}`;
  if (min || max) return `${money(min || max)}${unit ? ` a ${unit}` : ''}`;
  return 'Salary not listed';
}

function mapJob(job) {
  const patterns = (job.employmentType || []).map((item) => clean(item.label)).filter(Boolean);
  const mode = clean(job.remoteOptions?.[0]?.label) || 'On-site';
  const titleAndDescription = `${job.title || ''} ${cheerio.load(job.description || '').text()}`;
  const type = /fixed[\s-]?term|temporary|contract|locum/i.test(titleAndDescription) ? 'Contract' : 'Permanent';
  const location = clean(job.address?.join(', ')) || clean(job.region?.[0]?.label) || 'United Kingdom';
  const path = job.urlNoPrefix || job.url?.path;

  return {
    id: `jgp-${job.id}`,
    title: clean(job.title),
    employer: clean(job.organization || job.organizationProfile?.name) || 'Employer not listed',
    location,
    region: location,
    type,
    mode,
    pattern: patterns.join(', ') || 'Not specified',
    salary: salaryLabel(job),
    posted: dateLabel(job.published),
    closing: dateLabel(job.expiration),
    team: teamFrom(job.title || ''),
    source: 'Jobs Go Public',
    url: `${BASE}${path}`,
    featured: false
  };
}

export async function scrapeJobsGoPublic() {
  console.log('Reading Jobs Go Public pagination…');
  const first = nextData(await fetchHtml(SEARCH));
  const keywordMatches = Number(first.data?.jobs?.result_count || 0);
  const totalPages = Math.max(1, Math.ceil(keywordMatches / PAGE_SIZE));
  const summaries = [...(first.data?.jobs?.pages || [])].filter(exactSocialWorker);
  const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);

  for (let offset = 0; offset < pages.length; offset += CONCURRENCY) {
    const batch = pages.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(batch.map(async (page) => {
      const data = nextData(await fetchHtml(`${SEARCH}&page=${page}`));
      return (data.data?.jobs?.pages || []).filter(exactSocialWorker);
    }));
    summaries.push(...results.flat());
    console.log(`Processed ${Math.min(offset + CONCURRENCY + 1, totalPages)}/${totalPages} Jobs Go Public pages`);
    await delay(120);
  }

  const unique = [...new Map(summaries.map((job) => [job.id, job])).values()];
  console.log(`Reading ${unique.length} matching Jobs Go Public vacancies…`);
  const jobs = [];
  for (let offset = 0; offset < unique.length; offset += CONCURRENCY) {
    const batch = unique.slice(offset, offset + CONCURRENCY);
    const details = await Promise.all(batch.map(async (summary) => {
      const path = summary.urlNoPrefix || summary.url?.path;
      const data = nextData(await fetchHtml(`${BASE}${path}`));
      return data.data?.jobByPath?.content || summary;
    }));
    jobs.push(...details.map(mapJob));
    await delay(120);
  }

  return { jobs, keywordMatches, pagesScanned: totalPages, source: SEARCH };
}
