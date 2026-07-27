import * as cheerio from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://www.jobs.nhs.uk';
const SEARCH = `${BASE}/candidate/search/results?keyword=social%20worker&language=en`;
const CONCURRENCY = 6;

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function workingMode(pattern) {
  const value = pattern.toLowerCase();
  if (value.includes('home') || value.includes('remote')) return 'Remote';
  if (value.includes('flexible')) return 'Flexible';
  return 'On-site';
}

function teamFrom(title) {
  const value = title.toLowerCase();
  if (value.includes('mental health')) return 'Mental Health';
  if (value.includes('child') || value.includes('family')) return 'Children & Families';
  if (value.includes('foster')) return 'Fostering';
  if (value.includes('learning disabil')) return 'Learning Disabilities';
  if (value.includes('adult')) return 'Adult Social Care';
  return 'Social Work';
}

async function fetchPage(page, attempts = 3) {
  try {
    const response = await fetch(`${SEARCH}&page=${page}`, {
      headers: { 'user-agent': 'SocialWorkUK/1.0 (+UK social-work vacancy index)' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempts <= 1) throw error;
    await delay(700 * (4 - attempts));
    return fetchPage(page, attempts - 1);
  }
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const jobs = [];

  $('[data-test="search-result"]').each((_, element) => {
    const card = $(element);
    const link = card.find('[data-test="search-result-job-title"]').first();
    const title = clean(link.text());
    const href = link.attr('href');
    if (!title || !href || !/\bsocial\s+worker\b/i.test(title)) return;

    const locationBlock = card.find('[data-test="search-result-location"]');
    const location = clean(locationBlock.find('.location-font-size').text());
    locationBlock.find('.location-font-size').remove();
    const field = (name) => clean(card.find(`[data-test="${name}"] strong`).text());
    const contract = field('search-result-jobType');
    const pattern = field('search-result-workingPattern');

    jobs.push({
      id: href.split('/').pop()?.split('?')[0] || href,
      title,
      employer: clean(locationBlock.text()),
      location,
      region: location,
      type: /fixed|temporary|locum/i.test(contract) ? 'Contract' : contract || 'Not specified',
      mode: workingMode(pattern),
      pattern,
      salary: field('search-result-salary') || 'Salary not listed',
      posted: field('search-result-publicationDate'),
      closing: field('search-result-closingDate'),
      team: teamFrom(title),
      source: 'NHS Jobs',
      url: `${BASE}${href.replace(/&amp;/g, '&')}`,
      featured: false
    });
  });

  return jobs;
}

console.log('Reading NHS Jobs pagination…');
const firstHtml = await fetchPage(1);
const $ = cheerio.load(firstHtml);
const pageText = clean($('.nhsuk-pagination__page').last().text());
const totalPages = Number(pageText.match(/of\s+(\d+)/i)?.[1] || 1);
const resultText = clean($('[data-test="search-result-query"]').text());
const keywordMatches = Number(resultText.replace(/\D/g, '')) || 0;
const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
const collected = parsePage(firstHtml);

console.log(`Scanning ${totalPages} pages (${keywordMatches} keyword matches), ${CONCURRENCY} requests at a time…`);
for (let offset = 0; offset < pages.length; offset += CONCURRENCY) {
  const batch = pages.slice(offset, offset + CONCURRENCY);
  const results = await Promise.all(batch.map(async (page) => parsePage(await fetchPage(page))));
  collected.push(...results.flat());
  if ((offset / CONCURRENCY) % 10 === 0) console.log(`Processed ${Math.min(offset + CONCURRENCY + 1, totalPages)}/${totalPages} pages`);
  await delay(120);
}

const jobs = [...new Map(collected.map((job) => [job.id, job])).values()];
const snapshot = {
  jobs,
  fetchedAt: Date.now(),
  keywordMatches,
  pagesScanned: totalPages,
  source: SEARCH
};

await mkdir('src/lib', { recursive: true });
await writeFile('src/lib/jobs.json', `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${jobs.length} exact-title vacancies to src/lib/jobs.json`);
