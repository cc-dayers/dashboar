<script lang="ts">
	type FormDataShape = {
		name: string;
		task: string;
		branch: string;
		baseBranch: string;
		model: string;
		autoStart: boolean;
	};

	let {
		submitLabel = 'Create Session',
		onSubmit
	}: {
		submitLabel?: string;
		onSubmit: (data: FormDataShape) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let task = $state('');
	let branch = $state('');
	let baseBranch = $state('main');
	let model = $state('default');
	let autoStart = $state(true);
	let loading = $state(false);

	async function submit() {
		loading = true;
		try {
			await onSubmit({ name, task, branch, baseBranch, model, autoStart });
		} finally {
			loading = false;
		}
	}
</script>

<form class="form" onsubmit={(event) => event.preventDefault()}>
	<label>
		Name
		<input bind:value={name} placeholder="Fix auth bug" />
	</label>
	<label>
		Task
		<textarea bind:value={task} rows="5" required></textarea>
	</label>
	<label>
		Branch
		<input bind:value={branch} placeholder="agent/fix-auth" required />
	</label>
	<div class="inline">
		<label>
			Base Branch
			<input bind:value={baseBranch} required />
		</label>
		<label>
			Model
			<input bind:value={model} />
		</label>
	</div>
	<label class="check">
		<input type="checkbox" bind:checked={autoStart} />
		Auto start agent
	</label>
	<button type="submit" onclick={submit} disabled={loading}>{loading ? 'Submitting...' : submitLabel}</button>
</form>

<style>
	.form {
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
		font-size: 0.92rem;
	}
	input,
	textarea,
	button {
		font: inherit;
	}
	input,
	textarea {
		border: 1px solid #c9d5e6;
		border-radius: 10px;
		padding: 0.55rem 0.65rem;
	}
	.inline {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	button {
		width: fit-content;
		padding: 0.45rem 0.8rem;
		border-radius: 10px;
		background: #0f62fe;
		color: #fff;
		border: 0;
		cursor: pointer;
	}
</style>
