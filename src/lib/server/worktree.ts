import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type WorktreeInfo = {
	worktree: string;
	head?: string;
	branch?: string;
	bare?: boolean;
	detached?: boolean;
	locked?: string;
	prunable?: string;
};

function normalizeBranchName(name: string) {
	return name.trim().replace(/[^a-zA-Z0-9/_-]/g, '-');
}

export async function createWorktree(repoPath: string, worktreeBaseDir: string, branch: string, baseBranch: string) {
	const safeBranch = normalizeBranchName(branch);
	const worktreePath = path.join(worktreeBaseDir, `${safeBranch}-${Date.now()}`);
	mkdirSync(worktreeBaseDir, { recursive: true });
	await execFileAsync('git', ['-C', repoPath, 'worktree', 'add', '-b', safeBranch, worktreePath, baseBranch]);
	return worktreePath;
}

export async function listWorktrees(repoPath: string) {
	const { stdout } = await execFileAsync('git', ['-C', repoPath, 'worktree', 'list', '--porcelain']);
	const blocks = stdout
		.trim()
		.split('\n\n')
		.filter((value) => Boolean(value));
	return blocks.map((block): WorktreeInfo => {
		const info: WorktreeInfo = { worktree: '' };
		for (const line of block.split('\n')) {
			const [key, ...rest] = line.split(' ');
			const value = rest.join(' ').trim();
			if (key === 'worktree') info.worktree = value;
			if (key === 'HEAD') info.head = value;
			if (key === 'branch') info.branch = value.replace('refs/heads/', '');
			if (key === 'bare') info.bare = true;
			if (key === 'detached') info.detached = true;
			if (key === 'locked') info.locked = value;
			if (key === 'prunable') info.prunable = value;
		}
		return info;
	});
}

export async function removeWorktree(repoPath: string, worktreePath: string) {
	await execFileAsync('git', ['-C', repoPath, 'worktree', 'remove', '--force', worktreePath]);
}

export async function getWorktreeDiff(worktreePath: string) {
	const { stdout } = await execFileAsync('git', ['-C', worktreePath, 'diff']);
	return stdout;
}
