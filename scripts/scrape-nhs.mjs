import * as cheerio from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://www.jobs.nhs.uk';
const SEARCH = `${BASE}/api/v1/search_xml?keyword=social%20worker&limit=100&sort=publicationDateDesc`;
const CONCURRENCY = 6;

const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

function salaryLabel(value) {
  const salary = clean(value);
  if (!salary) return 'Salary not listed';
  return salary.replace(/£(\d+(?:\.\d+)?)/g, (_, number) => {
    const amount = Number(number);
    if (!Number.isFinite(amount)) return `£${number}`;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: amount % 1 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(amount);
  });
}

function workingMode(value) {
  if (/remote|home[- ]?based|work(?:ing)? from home/i.test(value)) return 'Remote';
  if (/hybrid/i.test(value)) return 'Hybrid';
  if (/flexible/i.test(value)) return 'Flexible';
  return 'On-site';
}

function workingPattern(value) {
  if (/part[- ]?time/i.test(value)) return 'Part time';
  if (/full[- ]?time/i.test(value)) return 'Full time';
  return 'Not specified';
}

function teamFrom(value) {
  const text = value.toLowerCase();
  if (text.includes('mental health')) return 'Mental Health';
  if (text.includes('child') || text.includes('family')) return 'Children & Families';
  if (text.includes('foster')) return 'Fostering';
  if (text.includes('learning disabil')) return 'Learning Disabilities';
  if (text.includes('adult')) return 'Adult Social Care';
  return 'Social Work';
}

async function fetchPage(page, attempts = 3) {
  try {
    const response = await fetch(`${SEARCH}&page=${page}`, {
      headers: {
        accept: 'application/xml',
        'user-agent': 'SocialWorkUK/1.0 (+UK social-work vacancy index)'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`NHS Jobs API page ${page} returned HTTP ${response.status}`);
    return response.text();
  } catch (error) {
    if (attempts <= 1) throw error;
    await delay(1000 * (4 - attempts));
    return fetchPage(page, attempts - 1);
  }
}

function parsePage(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs = [];

  $('vacancyDetails').each((_, element) => {
    const vacancy = $(element);
    const field = (name) => clean(vacancy.children(name).first().text());
    const title = field('title');
    if (!/\bsocial\s+worker\b/i.test(title)) return;

    const description = field('description');
    const locations = vacancy.find('locations > location')
      .map((__, location) => clean($(location).text()))
      .get()
      .filter(Boolean);
    const location = locations.join(' · ') || 'United Kingdom';
    const contract = field('type');

    jobs.push({
      id: `nhs-${field('id') || field('reference')}`,
      title,
      employer: field('employer') || 'Employer not listed',
      location,
      region: location,
      type: /fixed|temporary|locum|secondment|bank/i.test(contract)
        ? 'Contract'
        : contract || 'Not specified',
      mode: workingMode(`${title} ${description} ${location}`),
      pattern: workingPattern(`${title} ${description}`),
      salary: salaryLabel(field('salary')),
      salaryPeriod: null,
      posted: dateLabel(field('postDate')),
      closing: dateLabel(field('closeDate')),
      team: teamFrom(`${title} ${description}`),
      source: 'NHS Jobs',
      url: field('url'),
      featured: false
    });
  });

  return {
    jobs,
    totalPages: Number($('nhsJobs > totalPages').first().text()) || 1,
    totalResults: Number($('nhsJobs > totalResults').first().text()) || 0
  };
}

export async function scrapeNhs() {
  console.log('Reading the official NHS Jobs XML API…');
  const first = parsePage(await fetchPage(1));
  const pages = Array.from({ length: first.totalPages - 1 }, (_, index) => index + 2);
  const collected = [...first.jobs];

  console.log(`Scanning ${first.totalPages} NHS API pages (${first.totalResults} keyword matches)…`);
  for (let offset = 0; offset < pages.length; offset += CONCURRENCY) {
    const batch = pages.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(batch.map(async (page) => parsePage(await fetchPage(page))));
    collected.push(...results.flatMap((result) => result.jobs));
    await delay(120);
  }

  return {
    jobs: [...new Map(collected.map((job) => [job.id, job])).values()],
    keywordMatches: first.totalResults,
    pagesScanned: first.totalPages,
    source: SEARCH
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await scrapeNhs();
  const snapshot = { ...result, fetchedAt: Date.now() };
  await mkdir('src/lib', { recursive: true });
  await writeFile('src/lib/jobs.json', `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${result.jobs.length} exact-title NHS vacancies to src/lib/jobs.json`);
}
