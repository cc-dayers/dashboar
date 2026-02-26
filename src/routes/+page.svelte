<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	type WidgetKind = 'note' | 'links' | 'metrics';

	type WidgetTemplate = {
		kind: WidgetKind;
		title: string;
		content: string;
	};

	type Widget = WidgetTemplate & {
		id: string;
	};

	const STORAGE_KEY = 'dashboar.widgets.v1';

	const templates: WidgetTemplate[] = [
		{
			kind: 'note',
			title: 'Quick Notes',
			content: 'Capture a thought, task, or reminder.'
		},
		{
			kind: 'links',
			title: 'Useful Links',
			content: '- docs\n- repo\n- issue board'
		},
		{
			kind: 'metrics',
			title: 'Daily Numbers',
			content: 'Visitors: 0\nSignups: 0\nErrors: 0'
		}
	];

	let widgets = $state<Widget[]>([]);
	let selectedKind = $state<WidgetKind>('note');
	let customTitle = $state('');
	let customContent = $state('');

	function createId() {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID();
		}

		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function templateFor(kind: WidgetKind) {
		return templates.find((template) => template.kind === kind) ?? templates[0];
	}

	function addWidget() {
		const template = templateFor(selectedKind);

		widgets = [
			...widgets,
			{
				id: createId(),
				kind: selectedKind,
				title: customTitle.trim() || template.title,
				content: customContent.trim() || template.content
			}
		];

		customTitle = '';
		customContent = '';
		persist();
	}

	function addTemplate(kind: WidgetKind) {
		const template = templateFor(kind);

		widgets = [
			...widgets,
			{
				id: createId(),
				...template
			}
		];

		persist();
	}

	function removeWidget(id: string) {
		widgets = widgets.filter((widget) => widget.id !== id);
		persist();
	}

	function moveWidget(index: number, direction: -1 | 1) {
		const target = index + direction;

		if (target < 0 || target >= widgets.length) {
			return;
		}

		const next = [...widgets];
		[next[index], next[target]] = [next[target], next[index]];
		widgets = next;
		persist();
	}

	function clearBoard() {
		widgets = [];
		persist();
	}

	function isWidget(value: unknown): value is Widget {
		if (typeof value !== 'object' || value === null) {
			return false;
		}

		const item = value as Partial<Widget>;
		return (
			typeof item.id === 'string' &&
			typeof item.title === 'string' &&
			typeof item.content === 'string' &&
			(item.kind === 'note' || item.kind === 'links' || item.kind === 'metrics')
		);
	}

	function persist() {
		if (!browser) {
			return;
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
	}

	onMount(() => {
		if (!browser) {
			return;
		}

		const saved = localStorage.getItem(STORAGE_KEY);

		if (saved) {
			try {
				const parsed = JSON.parse(saved) as unknown;

				if (Array.isArray(parsed)) {
					widgets = parsed.filter(isWidget);
					return;
				}
			} catch {
				// Ignore invalid local data and regenerate defaults.
			}
		}

		widgets = templates.map((template) => ({
			id: createId(),
			...template
		}));

		persist();
	});
</script>

<svelte:head>
	<title>dashboar</title>
	<meta name="description" content="A lightweight dashboard composition app built with SvelteKit." />
</svelte:head>

<main class="page">
	<header>
		<h1>dashboar</h1>
		<p>Build a lightweight dashboard by composing small text-based widgets. All data stays in your browser.</p>
	</header>

	<section class="composer">
		<h2>Add Widget</h2>
		<div class="fields">
			<label>
				Type
				<select bind:value={selectedKind}>
					<option value="note">Note</option>
					<option value="links">Links</option>
					<option value="metrics">Metrics</option>
				</select>
			</label>

			<label>
				Title
				<input bind:value={customTitle} placeholder="Optional custom title" maxlength="60" />
			</label>

			<label>
				Content
				<textarea
					bind:value={customContent}
					placeholder="Optional custom content"
					rows="4"
					maxlength="400"
				></textarea>
			</label>
		</div>

		<div class="actions">
			<button type="button" onclick={addWidget}>Add Widget</button>
			<button type="button" class="ghost" onclick={() => addTemplate('note')}>Quick Note</button>
			<button type="button" class="ghost" onclick={() => addTemplate('links')}>Quick Links</button>
			<button type="button" class="ghost" onclick={() => addTemplate('metrics')}>Quick Metrics</button>
			<button type="button" class="danger" onclick={clearBoard}>Clear Board</button>
		</div>
	</section>

	<section class="grid">
		{#if widgets.length === 0}
			<p class="empty">No widgets yet. Add one from the panel above.</p>
		{/if}

		{#each widgets as widget, index (widget.id)}
			<article class="card">
				<div class="card-top">
					<span>{widget.kind}</span>
					<div>
						<button
							type="button"
							class="ghost"
							onclick={() => moveWidget(index, -1)}
							disabled={index === 0}>Up</button>
						<button
							type="button"
							class="ghost"
							onclick={() => moveWidget(index, 1)}
							disabled={index === widgets.length - 1}>Down</button>
						<button type="button" class="danger" onclick={() => removeWidget(widget.id)}>Remove</button>
					</div>
				</div>

				<input bind:value={widget.title} oninput={persist} maxlength="60" />
				<textarea bind:value={widget.content} oninput={persist} rows="6" maxlength="400"></textarea>
			</article>
		{/each}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
		background: linear-gradient(180deg, #f4f8ff 0%, #edf3f8 100%);
		color: #162033;
	}

	.page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1.5rem 1rem 2.5rem;
		display: grid;
		gap: 1rem;
	}

	header h1 {
		margin: 0;
		font-size: clamp(2rem, 3vw, 2.6rem);
		letter-spacing: -0.02em;
	}

	header p {
		margin: 0.5rem 0 0;
		max-width: 70ch;
		color: #3b4864;
	}

	.composer,
	.card {
		background: #ffffff;
		border: 1px solid #d9e2ee;
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(12, 22, 40, 0.06);
	}

	.composer {
		padding: 1rem;
	}

	.composer h2 {
		margin: 0 0 0.8rem;
		font-size: 1.1rem;
	}

	.fields {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.92rem;
		color: #33435e;
	}

	select,
	input,
	textarea,
	button {
		font: inherit;
	}

	select,
	input,
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.65rem;
		border: 1px solid #c9d5e6;
		border-radius: 10px;
		background: #fbfdff;
		color: #1d2940;
	}

	textarea {
		resize: vertical;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.8rem;
	}

	button {
		border: 1px solid transparent;
		background: #0f62fe;
		color: #ffffff;
		padding: 0.45rem 0.7rem;
		border-radius: 10px;
		cursor: pointer;
	}

	button.ghost {
		background: #eef3fb;
		color: #20345a;
		border-color: #d4dff0;
	}

	button.danger {
		background: #d33f49;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.8rem;
	}

	.empty {
		grid-column: 1 / -1;
		color: #3b4864;
	}

	.card {
		padding: 0.75rem;
		display: grid;
		gap: 0.45rem;
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		text-transform: capitalize;
		color: #526482;
		font-size: 0.9rem;
	}

	.card-top > div {
		display: flex;
		gap: 0.35rem;
	}
</style>
