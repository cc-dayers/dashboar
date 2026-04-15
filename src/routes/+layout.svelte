<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<nav>
		<a href="/" class:active={page.url.pathname === '/'}>Dashboard</a>
		<a href="/sessions" class:active={page.url.pathname.startsWith('/sessions')}>Sessions</a>
		<a href="/config" class:active={page.url.pathname.startsWith('/config')}>Config</a>
	</nav>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.app-shell {
		min-height: 100dvh;
	}

	nav {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #d9e2ee;
		background: #ffffff;
		position: sticky;
		top: 0;
		z-index: 5;
	}

	nav a {
		text-decoration: none;
		color: #1d2940;
		padding: 0.3rem 0.6rem;
		border-radius: 8px;
	}

	nav a.active {
		background: #e7efff;
		color: #0f62fe;
		font-weight: 600;
	}

	.content {
		padding-bottom: 2rem;
	}
</style>
