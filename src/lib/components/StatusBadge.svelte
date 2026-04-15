<script lang="ts">
	import type { SessionStatus } from '$lib/server/types';

	let { status }: { status: SessionStatus } = $props();
</script>

<span class={`badge ${status}`}>{status}</span>

<style>
	.badge {
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		text-transform: capitalize;
		border: 1px solid transparent;
	}
	.pending {
		background: #eef3fb;
		color: #33435e;
	}
	.running {
		background: #e9f6eb;
		color: #1f6b2a;
	}
	.paused {
		background: #fff7e6;
		color: #825b00;
	}
	.completed {
		background: #e7efff;
		color: #0f62fe;
	}
	.failed {
		background: #ffe8ea;
		color: #8e1d2a;
	}
</style>
