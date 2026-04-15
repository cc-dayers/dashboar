<script lang="ts">
	import type { AppConfig } from '$lib/server/types';

	let config = $state<AppConfig | null>(null);
	let error = $state('');
	let saved = $state(false);

	async function loadConfig() {
		const response = await fetch('/api/config');
		const payload = (await response.json()) as AppConfig & { error?: string };
		if (!response.ok) {
			error = payload.error ?? 'Failed to load config';
			return;
		}
		config = payload;
	}

	async function saveConfig() {
		if (!config) return;
		saved = false;
		const response = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(config)
		});
		const payload = (await response.json()) as AppConfig & { error?: string };
		if (!response.ok) {
			error = payload.error ?? 'Failed to save config';
			return;
		}
		config = payload;
		saved = true;
	}

	$effect(() => {
		loadConfig();
	});
</script>

<main class="page">
	<h1>Configuration</h1>
	{#if error}
		<p class="error">{error}</p>
	{/if}
	{#if !config}
		<p>Loading config…</p>
	{:else}
		<form onsubmit={(event) => event.preventDefault()}>
			<label>Repo Path <input bind:value={config.repoPath} /></label>
			<label>Worktree Base Directory <input bind:value={config.worktreeBaseDir} /></label>
			<label>Default Base Branch <input bind:value={config.defaultBaseBranch} /></label>
			<label>Default Model <input bind:value={config.defaultModel} /></label>
			<label>
				Max Concurrent Sessions
				<input type="number" min="1" bind:value={config.maxConcurrentSessions} />
			</label>
			<label>Log Retention (Days) <input type="number" min="1" bind:value={config.logRetentionDays} /></label>
			<label>Agent CLI Command <input bind:value={config.agentCliCommand} /></label>
			<label for="agent-cli-args">Agent CLI Args (space-separated)</label>
			<input
				id="agent-cli-args"
				value={config.agentCliArgs.join(' ')}
				oninput={(event) => {
					if (!config) return;
					const target = event.currentTarget as HTMLInputElement;
					config = {
						repoPath: config.repoPath,
						worktreeBaseDir: config.worktreeBaseDir,
						defaultBaseBranch: config.defaultBaseBranch,
						defaultModel: config.defaultModel,
						maxConcurrentSessions: config.maxConcurrentSessions,
						logRetentionDays: config.logRetentionDays,
						agentCliCommand: config.agentCliCommand,
						agentCliArgs: target.value.split(' ').filter(Boolean)
					};
				}}
			/>
			<button type="submit" onclick={saveConfig}>Save</button>
			{#if saved}
				<span class="saved">Saved.</span>
			{/if}
		</form>
	{/if}
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
	form {
		background: #fff;
		border: 1px solid #d9e2ee;
		border-radius: 12px;
		padding: 1rem;
		display: grid;
		gap: 0.7rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
	}
	input,
	button {
		font: inherit;
	}
	input {
		border: 1px solid #c9d5e6;
		border-radius: 10px;
		padding: 0.55rem 0.65rem;
	}
	button {
		width: fit-content;
		border: 0;
		padding: 0.45rem 0.8rem;
		background: #0f62fe;
		color: #fff;
		border-radius: 10px;
		cursor: pointer;
	}
	.saved {
		color: #1f6b2a;
	}
	.error {
		color: #8e1d2a;
	}
</style>
