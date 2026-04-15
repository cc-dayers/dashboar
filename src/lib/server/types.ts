export type SessionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type LogLevel = 'stdout' | 'stderr' | 'system';

export type ArtifactKind = 'diff' | 'file' | 'note';

export type AgentSession = {
	id: string;
	name: string;
	task: string;
	status: SessionStatus;
	worktree_path: string;
	branch: string;
	base_branch: string;
	repo_path: string;
	created_at: string;
	updated_at: string;
	pid: number | null;
	model: string;
};

export type SessionLog = {
	id: string;
	session_id: string;
	timestamp: string;
	level: LogLevel;
	message: string;
};

export type SessionArtifact = {
	id: string;
	session_id: string;
	kind: ArtifactKind;
	content: string;
	created_at: string;
};

export type AppConfig = {
	repoPath: string;
	worktreeBaseDir: string;
	defaultBaseBranch: string;
	defaultModel: string;
	maxConcurrentSessions: number;
	logRetentionDays: number;
	agentCliCommand: string;
	agentCliArgs: string[];
};

export type CreateSessionInput = {
	name: string;
	task: string;
	branch: string;
	baseBranch?: string;
	model?: string;
	autoStart?: boolean;
	repoPath?: string;
};

export type UpdateSessionInput = Partial<Pick<AgentSession, 'name' | 'task' | 'status' | 'model'>>;
