import { mkdir, writeFile } from 'node:fs/promises';
import { scrapeNhs } from './scrape-nhs.mjs';
import { scrapeJobsGoPublic } from './scrape-jobsgopublic.mjs';
import { scrapeCafcass } from './scrape-cafcass.mjs';
import { fetchJooble } from './fetch-jooble.mjs';
import { fetchAdzuna } from './fetch-adzuna.mjs';
import { fetchReed } from './fetch-reed.mjs';

function normalise(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dedupeKey(job) {
  return [
    normalise(job.title),
    normalise(job.employer),
    normalise(job.location),
    normalise(job.closing)
  ].join('|');
}

function exactSocialWorker(job) {
  return /\bsocial\s+worker\b/i.test(job.title || '');
}

const results = await Promise.allSettled([
  scrapeNhs(),
  scrapeJobsGoPublic(),
  scrapeCafcass(),
  fetchJooble(),
  fetchAdzuna(),
  fetchReed()
]);
const sources = results
  .filter((result) => result.status === 'fulfilled')
  .map((result) => result.value);
const failures = results
  .filter((result) => result.status === 'rejected')
  .map((result) => result.reason?.message || String(result.reason));

if (!sources.length) throw new Error(`Every job source failed: ${failures.join('; ')}`);

const jobs = [...new Map(
  sources
    .flatMap((source) => source.jobs)
    .filter(exactSocialWorker)
    .map((job) => [dedupeKey(job), job])
).values()];

const snapshot = {
  jobs,
  fetchedAt: Date.now(),
  sources: sources.map(({ jobs: sourceJobs, ...source }) => ({
    ...source,
    jobsImported: sourceJobs.length
  })),
  errors: failures
};

await mkdir('src/lib', { recursive: true });
await writeFile('src/lib/jobs.json', `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${jobs.length} deduplicated vacancies from ${sources.length} sources to src/lib/jobs.json`);
if (failures.length) console.warn(`Source failures: ${failures.join('; ')}`);
