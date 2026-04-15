<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';
	import type { AgentSession } from '$lib/server/types';

	let { session }: { session: AgentSession } = $props();
</script>

<article class="card">
	<div class="top">
		<h3><a href={`/sessions/${session.id}`}>{session.name}</a></h3>
		<StatusBadge status={session.status} />
	</div>
	<p>{session.task}</p>
	<dl>
		<div><dt>Branch</dt><dd>{session.branch}</dd></div>
		<div><dt>Model</dt><dd>{session.model}</dd></div>
		<div><dt>Updated</dt><dd>{new Date(session.updated_at).toLocaleString()}</dd></div>
	</dl>
</article>

<style>
	.card {
		background: #fff;
		border: 1px solid #d9e2ee;
		border-radius: 12px;
		padding: 0.9rem;
		display: grid;
		gap: 0.55rem;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	a {
		color: #162033;
		text-decoration: none;
	}
	p {
		margin: 0;
		color: #3b4864;
		font-size: 0.92rem;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem 0.75rem;
		margin: 0;
	}
	dt {
		font-size: 0.75rem;
		color: #526482;
	}
	dd {
		margin: 0.1rem 0 0;
		font-size: 0.86rem;
		word-break: break-word;
	}
</style>
