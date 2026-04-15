<script lang="ts">
	let {
		repoPath,
		worktreePath,
		branch,
		baseBranch
	}: { repoPath: string; worktreePath: string; branch: string; baseBranch: string } = $props();
</script>

<section class="panel">
	<h3>Worktree</h3>
	<dl>
		<div><dt>Repo</dt><dd>{repoPath}</dd></div>
		<div><dt>Worktree</dt><dd>{worktreePath}</dd></div>
		<div><dt>Branch</dt><dd>{branch}</dd></div>
		<div><dt>Base</dt><dd>{baseBranch}</dd></div>
	</dl>
</section>

<style>
	.panel {
		background: #fff;
		border: 1px solid #d9e2ee;
		border-radius: 12px;
		padding: 0.85rem;
	}
	h3 {
		margin: 0 0 0.55rem;
	}
	dl {
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	dt {
		color: #526482;
		font-size: 0.8rem;
	}
	dd {
		margin: 0.2rem 0 0;
		word-break: break-word;
	}
</style>
