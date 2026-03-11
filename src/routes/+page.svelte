<script>
  const business = {
    name: "Demo Plumbing Services",
    tagline: "Reliable local plumbing in Derbyshire",
    phone: "07700 123456",
    location: "Derbyshire",
    services: [
      "Boiler installs",
      "Plumbing repairs",
      "Radiator fitting",
      "Emergency callouts"
    ],
    description: "Professional local plumbing service with over 10 years experience.",
    image: "/demo-work.jpg"
  };
</script>

<svelte:head>
  <title>{business.name}</title>
</svelte:head>

<div class="min-h-screen bg-white text-slate-800 font-['Avenir_Next','Segoe_UI',sans-serif]">
  <header class="bg-white">
    <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-3">
          <p class="text-sm font-semibold uppercase tracking-widest text-[#caa35c]">
            {business.location}
          </p>
          <h1 class="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl font-['Playfair_Display','Georgia',serif]">
            {business.name}
          </h1>
          <p class="text-base text-slate-600 sm:text-lg">
            {business.tagline}
          </p>
        </div>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            class="inline-flex w-full items-center justify-center rounded-md bg-[#caa35c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b48f50] sm:w-auto"
          >
            Request a Quote
          </button>
          <a
            class="text-sm font-semibold text-slate-700 hover:text-[#caa35c]"
            href={`tel:${business.phone.replace(/\s+/g, "")}`}
          >
            Call {business.phone}
          </a>
        </div>
      </div>
    </div>
  </header>

  <section class="bg-slate-50">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-2xl font-semibold tracking-tight font-['Playfair_Display','Georgia',serif]">Services</h2>
        <span class="text-sm font-semibold text-[#caa35c]">Trusted locally</span>
      </div>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {#each business.services as service}
          <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-base font-semibold">{service}</p>
            <p class="mt-2 text-sm text-slate-600">
              High-quality service delivered by our experienced team.
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="bg-white">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <div class="grid gap-8 md:grid-cols-2 md:items-center">
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold tracking-tight font-['Playfair_Display','Georgia',serif]">About {business.name}</h2>
          <p class="text-sm text-slate-600 sm:text-base">
            {business.description}
          </p>
          <div class="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span class="inline-flex h-2 w-2 rounded-full bg-[#caa35c]"></span>
            Fully insured, local, and responsive.
          </div>
        </div>
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img
            class="h-64 w-full object-cover"
            src={business.image}
            alt="{business.name} team at work"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="bg-slate-50">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <h2 class="text-2xl font-semibold tracking-tight font-['Playfair_Display','Georgia',serif]">Recent Work</h2>
      <div class="mt-8">
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <img
            class="h-56 w-full object-cover sm:h-64"
            src={business.image}
            alt="Recent project"
          />
          <div class="border-t border-slate-200 px-5 py-4">
            <p class="text-sm font-semibold text-slate-700">Recent project</p>
            <p class="mt-1 text-sm text-slate-600">
              A snapshot of our latest completed job for a local customer.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="bg-white">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <div class="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight font-['Playfair_Display','Georgia',serif]">Contact</h2>
          <p class="mt-2 text-sm text-slate-600">
            Call us directly or send a quick message and we will get back to you.
          </p>
          <a
            class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#caa35c]"
            href={`tel:${business.phone.replace(/\s+/g, "")}`}
          >
            {business.phone}
          </a>

          <form class="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600" for="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                class="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-[#caa35c] focus:ring-2"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600" for="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@email.com"
                class="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-[#caa35c] focus:ring-2"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600" for="message">
                Message
              </label>
              <textarea
                id="message"
                rows="4"
                placeholder="Tell us about the job"
                class="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-[#caa35c] focus:ring-2"
              ></textarea>
            </div>
            <button
              type="button"
              class="inline-flex w-full items-center justify-center rounded-md bg-[#caa35c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b48f50]"
            >
              Send Message
            </button>
          </form>
        </div>

        <div class="flex flex-col gap-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-600 font-['Playfair_Display','Georgia',serif]">
              Service Area
            </h3>
            <p class="mt-2 text-base font-semibold">{business.location}</p>
          </div>
          <div class="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-600 font-['Playfair_Display','Georgia',serif]">
              Google Maps
            </h3>
            <div class="mt-3 flex h-52 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Google Maps placeholder
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <footer class="border-t border-slate-200 bg-white">
    <div class="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
      © {new Date().getFullYear()} {business.name}. All rights reserved.
    </div>
  </footer>
</div>
