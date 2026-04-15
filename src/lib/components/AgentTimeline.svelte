<script lang="ts">
	import type { SessionLog } from '$lib/server/types';

	let { logs }: { logs: SessionLog[] } = $props();
	const timeline = $derived(logs.filter((log) => log.level === 'system'));
</script>

<ul>
	{#if timeline.length === 0}
		<li>No system events yet.</li>
	{:else}
		{#each timeline as event (event.id)}
			<li>
				<time>{new Date(event.timestamp).toLocaleString()}</time>
				<span>{event.message}</span>
			</li>
		{/each}
	{/if}
</ul>

<style>
	ul {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.4rem;
	}
	li {
		display: grid;
		gap: 0.1rem;
	}
	time {
		font-size: 0.76rem;
		color: #526482;
	}
</style>
