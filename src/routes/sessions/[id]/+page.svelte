<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import WorktreeInfo from '$lib/components/WorktreeInfo.svelte';
	import LogViewer from '$lib/components/LogViewer.svelte';
	import DiffViewer from '$lib/components/DiffViewer.svelte';
	import AgentTimeline from '$lib/components/AgentTimeline.svelte';
	import type { PageData } from './$types';
	import type { SessionLog, SessionArtifact } from '$lib/server/types';

	let { data }: { data: PageData } = $props();
	const getInitialData = () => data;

	let session = $state(getInitialData().session);
	let logs = $state<SessionLog[]>(getInitialData().logs);
	let artifacts = $state<SessionArtifact[]>(getInitialData().artifacts);
	let diff = $state('');
	let tab = $state<'logs' | 'diff' | 'artifacts'>('logs');
	let error = $state('');

	async function action(endpoint: 'start' | 'stop') {
		error = '';
		const response = await fetch(`/api/sessions/${session.id}/${endpoint}`, { method: 'POST' });
		const payload = (await response.json()) as { session?: typeof session; error?: string };
		if (!response.ok) {
			error = payload.error ?? `Failed to ${endpoint}`;
			return;
		}
		if (payload.session) session = payload.session;
	}

	async function refreshDiff() {
		error = '';
		const response = await fetch(`/api/sessions/${session.id}/diff`);
		const payload = (await response.json()) as { diff?: string; error?: string };
		if (!response.ok) {
			error = payload.error ?? 'Failed to load diff';
			return;
		}
		diff = payload.diff ?? '';
	}

	async function removeSession() {
		if (!confirm('Delete this session and its worktree?')) return;
		const response = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' });
		if (response.ok) window.location.href = '/sessions';
	}

	$effect(() => {
		const id = session.id;
		const source = new EventSource(`/api/sessions/${id}/logs/stream`);
		source.onmessage = (event) => {
			try {
				const log = JSON.parse(event.data) as SessionLog;
				logs = [...logs, log];
			} catch {
				// ignore malformed events
			}
		};
		return () => {
			source.close();
		};
	});
</script>

<main class="page">
	<header>
		<div>
			<h1>{session.name}</h1>
			<p>{session.task}</p>
		</div>
		<StatusBadge status={session.status} />
	</header>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<div class="actions">
		<button type="button" onclick={() => action('start')}>Start</button>
		<button type="button" class="ghost" onclick={() => action('stop')}>Stop</button>
		<button type="button" class="danger" onclick={removeSession}>Delete</button>
	</div>

	<WorktreeInfo
		repoPath={session.repo_path}
		worktreePath={session.worktree_path}
		branch={session.branch}
		baseBranch={session.base_branch}
	/>

	<div class="tabs">
		<button type="button" class:active={tab === 'logs'} onclick={() => (tab = 'logs')}>Logs</button>
		<button type="button" class:active={tab === 'diff'} onclick={() => (tab = 'diff')}>Diff</button>
		<button type="button" class:active={tab === 'artifacts'} onclick={() => (tab = 'artifacts')}>Artifacts</button>
	</div>

	{#if tab === 'logs'}
		<LogViewer {logs} />
		<section class="panel">
			<h3>Timeline</h3>
			<AgentTimeline {logs} />
		</section>
	{:else if tab === 'diff'}
		<section class="panel">
			<button type="button" onclick={refreshDiff}>Refresh Diff</button>
			<DiffViewer {diff} />
		</section>
	{:else}
		<section class="panel">
			<h3>Artifacts</h3>
			{#if artifacts.length === 0}
				<p>No artifacts yet.</p>
			{:else}
				<ul>
					{#each artifacts as artifact (artifact.id)}
						<li>
							<strong>{artifact.kind}</strong>
							<time>{new Date(artifact.created_at).toLocaleString()}</time>
						</li>
					{/each}
				</ul>
			{/if}
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
		gap: 1rem;
	}
	h1,
	p {
		margin: 0;
	}
	p {
		color: #3b4864;
		margin-top: 0.3rem;
	}
	.actions,
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	button {
		border: 1px solid transparent;
		background: #0f62fe;
		color: #fff;
		padding: 0.4rem 0.7rem;
		border-radius: 10px;
		cursor: pointer;
	}
	.ghost {
		background: #eef3fb;
		color: #20345a;
		border-color: #d4dff0;
	}
	.danger {
		background: #d33f49;
	}
	.tabs button {
		background: #eef3fb;
		color: #20345a;
		border-color: #d4dff0;
	}
	.tabs button.active {
		background: #0f62fe;
		color: #fff;
	}
	.panel {
		background: #fff;
		border: 1px solid #d9e2ee;
		border-radius: 12px;
		padding: 0.85rem;
		display: grid;
		gap: 0.6rem;
	}
	.error {
		color: #8e1d2a;
	}
	ul {
		margin: 0;
		padding-left: 1rem;
	}
	time {
		color: #526482;
		margin-left: 0.5rem;
		font-size: 0.86rem;
	}
</style>
