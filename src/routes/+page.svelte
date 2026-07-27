<script>
  import { onMount } from 'svelte';

  export let data;
  const jobs = data.jobs;

  let query = '';
  let location = '';
  let jobType = 'All roles';
  let sort = 'Newest';
  let fullTime = false;
  let partTime = false;
  let flexible = false;
  let remote = false;
  let saved = [];
  let menuOpen = false;
  let alertOpen = false;
  let alertEmail = '';
  let alertCreated = false;

  onMount(() => {
    try { saved = JSON.parse(localStorage.getItem('swuk-saved') || '[]'); } catch { saved = []; }
  });

  $: filtered = jobs
    .filter((job) => `${job.title} ${job.employer} ${job.team}`.toLowerCase().includes(query.toLowerCase()))
    .filter((job) => `${job.location} ${job.region}`.toLowerCase().includes(location.toLowerCase()))
    .filter((job) => jobType === 'All roles' || job.type === jobType)
    .filter((job) => {
      const selected = [
        fullTime && /full time/i.test(job.pattern),
        partTime && /part time/i.test(job.pattern),
        flexible && /flexible working/i.test(job.pattern),
        remote && /(home|remote)/i.test(job.pattern)
      ];
      return ![fullTime, partTime, flexible, remote].some(Boolean) || selected.some(Boolean);
    })
    .sort((a, b) => sort === 'Salary: high to low' ? (parseInt(b.salary.replace(/\D/g, '')) || 0) - (parseInt(a.salary.replace(/\D/g, '')) || 0) : 0);

  const patternCount = (pattern) => jobs.filter((job) => pattern.test(job.pattern)).length;

  function clearFilters() {
    query = '';
    location = '';
    jobType = 'All roles';
    fullTime = false;
    partTime = false;
    flexible = false;
    remote = false;
  }

  function toggleSaved(id) {
    saved = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    localStorage.setItem('swuk-saved', JSON.stringify(saved));
  }

  function submitAlert(event) {
    event.preventDefault();
    if (alertEmail) alertCreated = true;
  }
</script>

<svelte:head>
  <title>SocialWork UK — Social work jobs, all in one place</title>
  <meta name="description" content="Search social work vacancies from councils, the NHS and charities across the UK." />
</svelte:head>

<header class="site-header">
  <div class="nav-wrap">
    <a class="brand" href="#top" aria-label="SocialWork UK home">
      <span class="brand-mark">SW</span>
      <span>SocialWork <b>UK</b></span>
    </a>
    <nav class:open={menuOpen}>
      <a class="active" href="#jobs">Find jobs</a>
      <a href="#how">How it works</a>
      <a href="#employers">For employers</a>
    </nav>
    <div class="nav-actions">
      <button class="saved-link" on:click={() => { clearFilters(); document.querySelector('#jobs')?.scrollIntoView(); }}>
        <span>♡</span> Saved jobs <i>{saved.length}</i>
      </button>
      <button class="primary small" on:click={() => { alertOpen = true; alertCreated = false; }}>Create job alert</button>
      <button class="menu" on:click={() => menuOpen = !menuOpen} aria-label="Toggle menu">☰</button>
    </div>
  </div>
</header>

<main id="top">
  <section class="hero">
    <div class="hero-inner">
      <div class="eyebrow"><span></span> The UK’s social work job search</div>
      <h1>Make your next move<br /><em>matter.</em></h1>
      <p class="hero-copy">Every social work vacancy, gathered in one place. Search councils, the NHS and leading charities without the endless tabs.</p>

      <div class="search-panel">
        <label>
          <span>⌕</span>
          <div>
            <small>What</small>
            <input bind:value={query} placeholder="Job title, skill or employer" />
          </div>
        </label>
        <div class="divider"></div>
        <label>
          <span>⌖</span>
          <div>
            <small>Where</small>
            <input bind:value={location} placeholder="Town, city or postcode" />
          </div>
        </label>
        <button class="primary search-button" on:click={() => document.querySelector('#jobs')?.scrollIntoView({ behavior: 'smooth' })}>Search jobs <span>→</span></button>
      </div>
      <div class="popular"><strong>Popular:</strong> <button on:click={() => query = 'Children'}>Children’s services</button><button on:click={() => query = 'Mental Health'}>Mental health</button><button on:click={() => query = 'ASYE'}>ASYE</button><button on:click={() => jobType = 'Contract'}>Locum</button></div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="sun"></div>
      <div class="arch arch-one"></div>
      <div class="arch arch-two"></div>
      <div class="figure">✦</div>
    </div>
  </section>

  <section class="jobs-section" id="jobs">
    <div class="section-heading">
      <div>
        <div class="eyebrow"><span></span> Fresh opportunities</div>
        <h2>Roles worth showing up for</h2>
      </div>
      <p>We collect and clean listings from trusted UK sources, so you can spend less time searching and more time choosing.</p>
    </div>

    <div class="jobs-layout">
      <aside>
        <div class="filter-title"><b>Filter jobs</b><button on:click={clearFilters}>Clear all</button></div>
        <label class="select-label">Job type
          <select bind:value={jobType}><option>All roles</option><option>Permanent</option><option>Contract</option></select>
        </label>
        <div class="filter-group">
          <span>Working pattern</span>
          <label><input type="checkbox" bind:checked={fullTime} /> Full time <i>{patternCount(/full time/i)}</i></label>
          <label><input type="checkbox" bind:checked={partTime} /> Part time <i>{patternCount(/part time/i)}</i></label>
          <label><input type="checkbox" bind:checked={flexible} /> Flexible working <i>{patternCount(/flexible working/i)}</i></label>
          <label><input type="checkbox" bind:checked={remote} /> Home or remote <i>{patternCount(/home|remote/i)}</i></label>
        </div>
        <div class="alert-card">
          <div>✦</div><h3>Let the right role find you</h3><p>Get new jobs matching your search sent straight to your inbox.</p>
          <button on:click={() => { alertOpen = true; alertCreated = false; }}>Create an alert →</button>
        </div>
      </aside>

      <div class="results">
        {#if data.error}<div class="source-warning">Live refresh issue: {data.error}. Showing the most recently cached results.</div>{/if}
        <div class="results-top">
          <p><strong>{filtered.length} roles</strong> matching your search</p>
          <label>Sort by <select bind:value={sort}><option>Newest</option><option>Salary: high to low</option></select></label>
        </div>
        <div class="job-list">
          {#each filtered as job}
            <article class:featured={job.featured}>
              {#if job.featured}<span class="featured-label">FEATURED</span>{/if}
              <div class="job-head">
                <div class="employer-logo">{job.employer.split(' ').slice(0,2).map(w => w[0]).join('')}</div>
                <div>
                  <h3>{job.title}</h3>
                  <p class="employer">{job.employer}</p>
                </div>
                <button class:saved={saved.includes(job.id)} class="heart" on:click={() => toggleSaved(job.id)} aria-label="Save job">{saved.includes(job.id) ? '♥' : '♡'}</button>
              </div>
              <div class="job-meta"><span>⌖ {job.location}</span><span>◷ {job.type}</span><span>⌂ {job.mode}</span></div>
              <div class="salary">{job.salary} <small>per year</small></div>
              <div class="job-foot"><span>{job.team}</span><p>Posted {job.posted} · closes {job.closing} · via {job.source}</p><a href={job.url} target="_blank" rel="noopener noreferrer">View role →</a></div>
            </article>
          {:else}
            <div class="empty"><b>No exact matches yet.</b><p>Try clearing a filter or searching a nearby city.</p></div>
          {/each}
        </div>
        <div class="all-loaded">✓ All matching NHS Jobs vacancies loaded</div>
      </div>
    </div>
  </section>

  <section class="how" id="how">
    <div class="eyebrow light"><span></span> One search, the whole sector</div>
    <h2>Your next chapter starts here.</h2>
    <div class="steps">
      <div><b>01</b><h3>We gather</h3><p>Roles from public-sector feeds, council career pages and trusted charity partners.</p></div>
      <div><b>02</b><h3>You discover</h3><p>Useful filters, clear salary data and no duplicate listings cluttering your search.</p></div>
      <div><b>03</b><h3>You apply</h3><p>Go directly to the original employer to apply securely and with confidence.</p></div>
    </div>
  </section>

  <section class="employers" id="employers">
    <div><div class="eyebrow"><span></span> Hiring social workers?</div><h2>Put your role in front of people who care.</h2><p>Reach qualified professionals searching across the UK social care sector.</p></div>
    <button class="primary">Post a vacancy →</button>
  </section>
</main>

<footer>
  <a class="brand" href="#top"><span class="brand-mark">SW</span><span>SocialWork <b>UK</b></span></a>
  <p>Bringing every UK social work opportunity together.</p>
  <div><a href="#jobs">Find jobs</a><a href="#how">About</a><a href="#employers">Employers</a><a href="#top">Privacy</a></div>
  <small>© 2026 SocialWork UK. Listings link to original employers. Always verify details before applying.</small>
</footer>

{#if alertOpen}
  <div class="modal-backdrop" role="presentation" on:click|self={() => alertOpen = false}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
      <button class="modal-close" on:click={() => alertOpen = false}>×</button>
      {#if alertCreated}
        <div class="success-icon">✓</div><h2>You’re all set.</h2><p>We’ll send relevant social work roles to <b>{alertEmail}</b>.</p><button class="primary modal-button" on:click={() => alertOpen = false}>Done</button>
      {:else}
        <div class="eyebrow"><span></span> Stay in the loop</div><h2>Never miss the right role.</h2><p>Create a free alert for new UK social work opportunities.</p>
        <form on:submit={submitAlert}><input type="email" bind:value={alertEmail} required placeholder="you@example.com" /><button class="primary">Create my alert →</button></form>
      {/if}
    </div>
  </div>
{/if}
