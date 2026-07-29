<script>
  import { onMount } from 'svelte';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import '../app.css';

  onMount(() => {
    injectAnalytics();
  });
</script>

<slot />
