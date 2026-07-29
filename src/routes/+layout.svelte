<script>
  import { dev } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import '../app.css';

  injectAnalytics({ mode: dev ? 'development' : 'production' });
</script>

<slot />
