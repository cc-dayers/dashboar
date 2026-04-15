<script lang="ts">
	let { diff }: { diff: string } = $props();
</script>

<pre>{diff || 'No diff available yet.'}</pre>

<style>
	pre {
		background: #0f1726;
		color: #e9eef8;
		padding: 0.75rem;
		border-radius: 10px;
		overflow: auto;
		font-size: 0.8rem;
		line-height: 1.4;
	}
</style>
