<script lang="ts">
	import SessionCard from '$lib/components/SessionCard.svelte';
	import type { AgentSession, SessionStatus } from '$lib/server/types';

	const filters: Array<'all' | SessionStatus> = ['all', 'running', 'completed', 'failed', 'pending', 'paused'];
	let status = $state<'all' | SessionStatus>('all');
	let sessions = $state<AgentSession[]>([]);
	let loading = $state(false);
	let error = $state('');

	async function loadSessions() {
		loading = true;
		error = '';
		try {
			const query = status === 'all' ? '' : `?status=${status}`;
			const response = await fetch(`/api/sessions${query}`);
			const payload = (await response.json()) as { sessions?: AgentSession[]; error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'Failed to load sessions');
			sessions = payload.sessions ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load sessions';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		status;
		loadSessions();
	});
</script>

<main class="page">
	<header>
		<h1>Agent Sessions</h1>
		<a class="button" href="/sessions/new">New Session</a>
	</header>

	<div class="filters">
		{#each filters as filter}
			<button type="button" class:active={status === filter} onclick={() => (status = filter)}>
				{filter}
			</button>
		{/each}
	</div>

	{#if loading}
		<p>Loading sessions…</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if sessions.length === 0}
		<p>No sessions found.</p>
	{:else}
		<section class="grid">
			{#each sessions as session (session.id)}
				<SessionCard {session} />
			{/each}
		</section>
	{/if}
</main>

<style>
	.page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1rem;
		display: grid;
		gap: 0.8rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	.button,
	button {
		text-transform: capitalize;
		border: 1px solid #d4dff0;
		background: #eef3fb;
		color: #20345a;
		padding: 0.35rem 0.7rem;
		border-radius: 10px;
		text-decoration: none;
		cursor: pointer;
	}
	button.active {
		background: #0f62fe;
		color: #fff;
		border-color: #0f62fe;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.error {
		color: #8e1d2a;
	}
</style>
