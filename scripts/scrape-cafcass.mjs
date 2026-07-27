import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://cafcass.current-vacancies.com';
const SEARCH = `${BASE}/Careers/Cafcass%20VSP-1663`;
const CLIENT_ID = 1663;
const PAGE_ID = -120895;
const PAGE_SIZE = 25;
const USER_AGENT = 'socialworkjobs.uk/1.0 (+UK social-work vacancy index)';

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dateLabel(value) {
  if (!value) return 'Not listed';
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return clean(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function teamFrom(title) {
  const value = title.toLowerCase();
  if (value.includes('manager')) return 'Children & Families';
  if (value.includes('child') || value.includes('family')) return 'Children & Families';
  if (value.includes('caseworker')) return 'Family Justice';
  return 'Social Work';
}

function exactSocialWorker(job) {
  return /\bsocial\s+worker\b/i.test(job.VacancyTitle || '');
}

function mapJob(job) {
  const description = clean(job.JobDescription);
  const location = clean(job.Location) || 'England';
  const contract = clean(job['12229103_ContractType']) || 'Not specified';

  return {
    id: clean(job.Reference) || `cafcass-${job.VacancyID}`,
    title: clean(job.VacancyTitle),
    employer: 'Cafcass',
    location,
    region: location,
    type: /fixed|temporary|interim|contract/i.test(contract) ? 'Contract' : contract,
    mode: /hybrid|flexibly|remote/i.test(description) ? 'Hybrid' : 'On-site',
    pattern: 'Not specified',
    salary: clean(job['8390452_Salary']) || 'Salary not listed',
    posted: dateLabel(job.StartDate),
    closing: dateLabel(job.ExpiryDate),
    team: teamFrom(job.VacancyTitle || ''),
    source: 'Cafcass',
    url: job.ApplyLink,
    featured: false
  };
}

async function request(url, options = {}, attempts = 3) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'user-agent': USER_AGENT, ...options.headers },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (error) {
    if (attempts <= 1) throw error;
    await delay(700 * (4 - attempts));
    return request(url, options, attempts - 1);
  }
}

async function openSession() {
  const response = await request(SEARCH);
  const html = await response.text();
  const token = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1];
  if (!token) throw new Error('Cafcass page did not contain an anti-forgery token');

  const cookie = response.headers.get('set-cookie')
    ?.split(/,(?=[^;,]+=)/)
    .map((value) => value.split(';')[0])
    .join('; ');

  return { token, cookie };
}

async function fetchPage(page, session) {
  const search = {
    ClientID: CLIENT_ID,
    OnboardingPageID: PAGE_ID,
    DynamicFields: [],
    SearchResultFields: [],
    CurrentPage: page,
    PageSearchResults: true,
    SearchResultPageSize: PAGE_SIZE,
    keywords: '',
    Locations: ['0'],
    Disciplines: ['0']
  };
  const form = new URLSearchParams({
    __RequestVerificationToken: session.token,
    hdnNewWorld: 'True',
    data: JSON.stringify(search)
  });
  const response = await request(`${BASE}/Careers/SearchVacancies`, {
    method: 'POST',
    headers: {
      '__RequestVerificationToken': session.token,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      origin: BASE,
      referer: SEARCH,
      ...(session.cookie ? { cookie: session.cookie } : {})
    },
    body: form
  });
  const payload = await response.json();
  if (!payload.OK) throw new Error('Cafcass vacancy endpoint returned OK=false');
  return payload.Data || [];
}

export async function scrapeCafcass() {
  console.log('Reading Cafcass vacancies…');
  const session = await openSession();
  const vacancies = [];

  for (let page = 1; ; page += 1) {
    const batch = await fetchPage(page, session);
    vacancies.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    await delay(150);
  }

  const jobs = [...new Map(
    vacancies.filter(exactSocialWorker).map(mapJob).map((job) => [job.id, job])
  ).values()];
  return {
    jobs,
    keywordMatches: vacancies.length,
    pagesScanned: Math.max(1, Math.ceil(vacancies.length / PAGE_SIZE)),
    source: SEARCH
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await scrapeCafcass();
  const snapshot = { ...result, fetchedAt: Date.now() };
  await mkdir('src/lib', { recursive: true });
  await writeFile('src/lib/cafcass-jobs.json', `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${result.jobs.length} Cafcass vacancies to src/lib/cafcass-jobs.json`);
}
