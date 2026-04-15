<script lang="ts">
	import type { SessionLog } from '$lib/server/types';

	let { logs }: { logs: SessionLog[] } = $props();
</script>

<div class="logs">
	{#if logs.length === 0}
		<p class="empty">No logs yet.</p>
	{:else}
		{#each logs as log (log.id)}
			<div class={`line ${log.level}`}>
				<time>{new Date(log.timestamp).toLocaleTimeString()}</time>
				<strong>{log.level}</strong>
				<span>{log.message}</span>
			</div>
		{/each}
	{/if}
</div>

<style>
	.logs {
		background: #0f1726;
		color: #dbe6fa;
		border-radius: 10px;
		padding: 0.65rem;
		max-height: 320px;
		overflow: auto;
		display: grid;
		gap: 0.35rem;
	}
	.line {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 0.5rem;
		font-size: 0.8rem;
	}
	time {
		color: #9db2d8;
	}
	strong {
		text-transform: uppercase;
		font-size: 0.72rem;
		color: #c3d2ec;
	}
	.stderr span {
		color: #ffc7cd;
	}
	.system span {
		color: #b6ffd4;
	}
	.empty {
		margin: 0;
		color: #c3d2ec;
	}
</style>
