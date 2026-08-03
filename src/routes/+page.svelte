<script>
  export let data;
  const jobs = data.jobs;

  let query = '';
  let location = '';
  let jobType = 'All roles';
  let radius = 25;
  let sort = 'Newest';
  let fullTime = false;
  let partTime = false;
  let flexible = false;
  let remote = false;
  let menuOpen = false;
  let userCoords = null;
  let jobCoordinates = new Map();
  let locating = false;
  let locationError = '';

  const postcodePattern = /\b(GIR\s?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?\s?\d[ABD-HJLNP-UW-Z]{2})\b/i;

  const dateValue = (value) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const salaryValue = (value) => {
    const figures = (value || '').match(/£?\s*[\d,]+/g);
    if (!figures) return 0;
    return Math.max(...figures.map((figure) => Number(figure.replace(/\D/g, ''))));
  };

  const salaryHasPeriod = (value) =>
    /\b(?:per\s+)?(?:annum|annual|year|hour|day|week|month)(?:ly)?\b|p\/a|p\.?a\.?/i.test(value || '');

  const matchesWords = (value, search) =>
    search.trim().toLowerCase().split(/\s+/).every((word) => value.toLowerCase().includes(word));

  const isCafcassEmployer = (employer) => /^cafcass$/i.test(employer?.trim() || '');

  const distanceMiles = (from, to) => {
    const radians = (degrees) => degrees * Math.PI / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLon = radians(to.longitude - from.longitude);
    const lat1 = radians(from.latitude);
    const lat2 = radians(to.latitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const jobDistance = (job) => {
    const coordinates = jobCoordinates.get(job.id);
    return userCoords && coordinates ? distanceMiles(userCoords, coordinates) : null;
  };

  $: filtered = jobs
    .filter((job) => matchesWords(`${job.title} ${job.employer} ${job.team} ${job.type} ${job.pattern} ${job.source}`, query))
    .filter((job) => userCoords ? (jobDistance(job) ?? Infinity) <= radius : matchesWords(`${job.location} ${job.region} ${job.mode}`, location))
    .filter((job) => jobType === 'All roles' || job.type === jobType)
    .filter((job) => {
      const selected = [
        fullTime && /full time/i.test(job.pattern),
        partTime && /part time/i.test(job.pattern),
        flexible && /flexible working/i.test(job.pattern),
        remote && /(home|remote|hybrid)/i.test(`${job.pattern} ${job.mode}`)
      ];
      return ![fullTime, partTime, flexible, remote].some(Boolean) || selected.some(Boolean);
    })
    .sort((a, b) => {
      if (sort === 'Salary: high to low') return salaryValue(b.salary) - salaryValue(a.salary);
      if (sort === 'Salary: low to high') return (salaryValue(a.salary) || Infinity) - (salaryValue(b.salary) || Infinity);
      if (sort === 'Closing soon') return (dateValue(a.closing) || Infinity) - (dateValue(b.closing) || Infinity);
      if (sort === 'Nearest') return (jobDistance(a) ?? Infinity) - (jobDistance(b) ?? Infinity);
      return dateValue(b.posted) - dateValue(a.posted);
    });

  const patternCount = (pattern) => jobs.filter((job) => pattern.test(job.pattern)).length;
  const remoteCount = () => jobs.filter((job) => /(home|remote|hybrid)/i.test(`${job.pattern} ${job.mode}`)).length;
  const jobTypes = [...new Set(jobs.map((job) => job.type).filter(Boolean))].sort();
  async function loadJobCoordinates() {
    if (jobCoordinates.size) return;
    const records = jobs
      .map((job) => ({ id: job.id, postcode: `${job.location} ${job.region}`.match(postcodePattern)?.[0] }))
      .filter((record) => record.postcode);
    const coordinates = new Map();

    for (let index = 0; index < records.length; index += 100) {
      const batch = records.slice(index, index + 100);
      const response = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch.map((record) => record.postcode) })
      });
      if (!response.ok) throw new Error('Postcode lookup failed');
      const payload = await response.json();
      payload.result.forEach((item, itemIndex) => {
        if (item.result) coordinates.set(batch[itemIndex].id, {
          latitude: item.result.latitude,
          longitude: item.result.longitude
        });
      });
    }
    jobCoordinates = coordinates;
  }

  function useCurrentLocation() {
    locationError = '';
    if (!navigator.geolocation) {
      locationError = 'Your browser does not support location search.';
      return;
    }
    locating = true;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        await loadJobCoordinates();
        userCoords = { latitude: coords.latitude, longitude: coords.longitude };
        location = '';
        sort = 'Nearest';
      } catch {
        locationError = 'We could not calculate distances right now. Please try again.';
      } finally {
        locating = false;
      }
    }, () => {
      locating = false;
      locationError = 'Location access was not granted. You can still search by town or postcode.';
    }, { enableHighAccuracy: false, timeout: 10000 });
  }

  function useTypedLocation() {
    userCoords = null;
    if (sort === 'Nearest') sort = 'Newest';
    locationError = '';
  }

  function clearLocation() {
    location = '';
    userCoords = null;
    locationError = '';
    if (sort === 'Nearest') sort = 'Newest';
  }

  function clearFilters() {
    query = '';
    location = '';
    jobType = 'All roles';
    radius = 25;
    userCoords = null;
    locationError = '';
    if (sort === 'Nearest') sort = 'Newest';
    fullTime = false;
    partTime = false;
    flexible = false;
    remote = false;
  }

</script>

<svelte:head>
  <title>socialworkjobs.uk — Find UK social work jobs</title>
  <meta name="description" content="Search current social work vacancies from the NHS and UK public-sector employers, then apply directly with the employer." />
</svelte:head>

<header class="site-header">
  <div class="nav-wrap">
    <a class="brand" href="#top" aria-label="socialworkjobs.uk home">
      <span class="brand-mark">SW</span>
      <span>socialworkjobs<b>.uk</b></span>
    </a>
    <nav class:open={menuOpen}>
      <a class="active" href="#jobs">Find jobs</a>
    </nav>
    <div class="nav-actions">
      <button class="menu" on:click={() => menuOpen = !menuOpen} aria-label="Toggle menu">☰</button>
    </div>
  </div>
</header>

<main id="top">
  <section class="hero">
    <div class="hero-inner">
      <div class="eyebrow"><span></span> The UK’s social work job search</div>
      <h1>Find your role<br /><em>in changing lives.</em></h1>
      <p class="hero-copy">Every Social Work opportunity in the UK - In one place</p>

      <div class="search-panel">
        <label>
          <span>⌕</span>
          <div>
            <small>What</small>
            <div class="field-control">
              <input bind:value={query} aria-label="Search by job title, skill or employer" placeholder="Job title, skill or employer" />
              {#if query}<button type="button" class="clear-field" on:click={() => query = ''} aria-label="Clear job search" title="Clear search">×</button>{/if}
            </div>
          </div>
        </label>
        <div class="divider"></div>
        <label>
          <button
            type="button"
            class="geo-icon"
            class:active={userCoords}
            class:locating
            on:click={useCurrentLocation}
            disabled={locating}
            aria-label={locating ? 'Finding your location' : userCoords ? 'Refresh current location' : 'Use my current location'}
            title={userCoords ? 'Refresh current location' : 'Use my current location'}
          >⌖</button>
          <div>
            <small>Where</small>
            <div class="location-control">
              <input bind:value={location} on:input={useTypedLocation} aria-label="Search by town, city or postcode" placeholder={userCoords ? 'Current location' : 'Town, city or postcode'} />
              {#if location || userCoords}<button type="button" class="clear-field" on:click={clearLocation} aria-label="Clear location search" title="Clear location">×</button>{/if}
            </div>
          </div>
        </label>
        {#if userCoords}
          <label class="radius-select">
            <small>Within</small>
            <select bind:value={radius} aria-label="Search radius">
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
            </select>
          </label>
        {/if}
        <button class="primary search-button" on:click={() => document.querySelector('#jobs')?.scrollIntoView({ behavior: 'smooth' })}>Search jobs <span>→</span></button>
      </div>
      {#if locationError}<p class="location-error" role="alert">{locationError}</p>{/if}
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
        <h2>Care to take a look...</h2>
      </div>
      <p>We organise listings from across the UK, so you can spend less time searching and more time choosing.</p>
    </div>

    <div class="jobs-layout">
      <aside>
        <div class="filter-title"><b>Filter jobs</b><button on:click={clearFilters}>Clear all</button></div>
        <label class="select-label">Job type
          <select bind:value={jobType}><option>All roles</option>{#each jobTypes as type}<option>{type}</option>{/each}</select>
        </label>
        <div class="filter-group">
          <span>Working pattern</span>
          <label><input type="checkbox" bind:checked={fullTime} /> Full time <i>{patternCount(/full time/i)}</i></label>
          <label><input type="checkbox" bind:checked={partTime} /> Part time <i>{patternCount(/part time/i)}</i></label>
          <label><input type="checkbox" bind:checked={flexible} /> Flexible working <i>{patternCount(/flexible working/i)}</i></label>
          <label><input type="checkbox" bind:checked={remote} /> Home, hybrid or remote <i>{remoteCount()}</i></label>
        </div>
      </aside>

      <div class="results">
        <div class="results-top">
          <div>
            <p aria-live="polite"><strong>{filtered.length} {filtered.length === 1 ? 'role' : 'roles'}</strong> matching your search</p>
            {#if query || location || userCoords || jobType !== 'All roles' || fullTime || partTime || flexible || remote}
              <div class="active-filters">
                {#if query}<button on:click={() => query = ''}>“{query}” ×</button>{/if}
                {#if userCoords}<button on:click={clearLocation}>Within {radius} miles ×</button>
                {:else if location}<button on:click={clearLocation}>{location} ×</button>{/if}
                {#if jobType !== 'All roles'}<button on:click={() => jobType = 'All roles'}>{jobType} ×</button>{/if}
                {#if fullTime}<button on:click={() => fullTime = false}>Full time ×</button>{/if}
                {#if partTime}<button on:click={() => partTime = false}>Part time ×</button>{/if}
                {#if flexible}<button on:click={() => flexible = false}>Flexible ×</button>{/if}
                {#if remote}<button on:click={() => remote = false}>Remote / hybrid ×</button>{/if}
              </div>
            {/if}
          </div>
          <label>Sort by <select bind:value={sort}>{#if userCoords}<option>Nearest</option>{/if}<option>Newest</option><option>Closing soon</option><option>Salary: high to low</option><option>Salary: low to high</option></select></label>
        </div>
        <div class="job-list">
          {#each filtered as job}
            <article class:featured={job.featured}>
              {#if job.featured}<span class="featured-label">FEATURED</span>{/if}
              <div class="job-head">
                <div class:has-logo={isCafcassEmployer(job.employer)} class="employer-logo">
                  {#if isCafcassEmployer(job.employer)}
                    <img src="/logos/cafcass.svg" alt="Cafcass" />
                  {:else}
                    {job.employer.split(' ').slice(0,2).map(w => w[0]).join('')}
                  {/if}
                </div>
                <div>
                  <h3>{job.title}</h3>
                  <p class="employer">{job.employer}</p>
                </div>
              </div>
              <div class="job-meta"><span>⌖ {job.location}{#if userCoords && jobDistance(job) !== null} · {jobDistance(job).toFixed(1)} miles{/if}</span><span>◷ {job.type}</span><span>⌂ {job.mode}</span></div>
              <div class="salary">
                {job.salary}
                {#if job.salary !== 'Salary not listed' && job.salaryPeriod !== null && !salaryHasPeriod(job.salary)}
                  <small>per {job.salaryPeriod || 'year'}</small>
                {/if}
              </div>
              <div class="job-foot">
                <span>{job.team}</span>
                <p>Posted {job.posted} · closes {job.closing} · via {job.source}</p>
                <a href={job.url} target="_blank" rel="noopener noreferrer">View role →</a>
              </div>
              {#if job.source === 'Adzuna'}
                <a class="adzuna-credit" href="https://www.adzuna.co.uk/" target="_blank" rel="noopener noreferrer">Jobs by Adzuna</a>
              {/if}
            </article>
          {:else}
            <div class="empty"><b>No exact matches yet.</b><p>Try clearing a filter or searching a nearby city.</p></div>
          {/each}
        </div>
        <div class="all-loaded">✓ All matching vacancies from our current sources loaded</div>
      </div>
    </div>
  </section>

</main>

<footer>
  <a class="brand" href="#top"><span class="brand-mark">SW</span><span>socialworkjobs<b>.uk</b></span></a>
  <p>Helping social workers find current UK opportunities.</p>
  <div><a href="#jobs">Find jobs</a></div>
  <small>© 2026 socialworkjobs.uk. Listings link to original employers. Always verify details before applying.</small>
</footer>
