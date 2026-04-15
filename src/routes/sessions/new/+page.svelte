<script lang="ts">
	import { goto } from '$app/navigation';
	import SessionForm from '$lib/components/SessionForm.svelte';

	let error = $state('');

	async function handleSubmit(data: {
		name: string;
		task: string;
		branch: string;
		baseBranch: string;
		model: string;
		autoStart: boolean;
	}) {
		error = '';
		const response = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(data)
		});
		const payload = (await response.json()) as { session?: { id: string }; error?: string };
		if (!response.ok) {
			error = payload.error ?? 'Failed to create session';
			return;
		}
		const sessionId = payload.session?.id;
		if (sessionId) {
			await goto(`/sessions/${sessionId}`);
		}
	}
</script>

<main class="page">
	<h1>New Agent Session</h1>
	{#if error}
		<p class="error">{error}</p>
	{/if}
	<SessionForm onSubmit={handleSubmit} />
</main>

<style>
	.page {
		max-width: 860px;
		margin: 0 auto;
		padding: 1rem;
		display: grid;
		gap: 0.8rem;
	}
	h1 {
		margin: 0;
	}
	.error {
		color: #8e1d2a;
	}
</style>
