import snapshot from '$lib/jobs.json';

export function load({ setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=3600' });

  return {
    ...snapshot,
    error: snapshot.errors?.length ? snapshot.errors.join('; ') : null
  };
}
