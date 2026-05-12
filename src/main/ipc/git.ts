import { ipcMain } from 'electron';
import simpleGit from 'simple-git';
import type { GitBranch, GitWorktree, GitCommit } from '@shared/types';

export function register() {
  ipcMain.handle('git:branches', async (_event, projectPath: string): Promise<GitBranch[]> => {
    const git = simpleGit(projectPath);

    try {
      await git.revparse(['--git-dir']);
    } catch {
      return [];
    }

    const summary = await git.branchLocal();
    const branches: GitBranch[] = [];

    for (const [name, info] of Object.entries(summary.branches)) {
      let aheadBehind: { ahead: number; behind: number } | null = null;
      try {
        const status = await git.status(['-b', '--porcelain=v2']);
        const branchStatus = status;
        aheadBehind = { ahead: branchStatus.ahead, behind: branchStatus.behind };
      } catch {
        aheadBehind = null;
      }

      branches.push({
        name,
        current: info.current,
        lastCommitMessage: info.label,
        aheadBehind: name === summary.current ? aheadBehind : null,
        worktreePath: null,
      });
    }

    try {
      const worktrees = await parseWorktrees(git);
      for (const wt of worktrees) {
        const branch = branches.find((b) => b.name === wt.branch);
        if (branch) branch.worktreePath = wt.path;
      }
    } catch {
      // not all repos support worktrees
    }

    return branches;
  });

  ipcMain.handle('git:worktrees', async (_event, projectPath: string): Promise<GitWorktree[]> => {
    const git = simpleGit(projectPath);
    try {
      return await parseWorktrees(git);
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:commits', async (_event, projectPath: string, count: number): Promise<GitCommit[]> => {
    const git = simpleGit(projectPath);
    try {
      const log = await git.log({ maxCount: count, format: { hash: '%h', message: '%s', author: '%an', relativeDate: '%cr' } });
      return log.all.map((entry) => ({
        hash: entry.hash,
        message: entry.message,
        author: (entry as Record<string, string>).author ?? '',
        relativeDate: (entry as Record<string, string>).relativeDate ?? '',
      }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:is-dirty', async (_event, projectPath: string): Promise<boolean> => {
    const git = simpleGit(projectPath);
    try {
      const status = await git.status();
      return !status.isClean();
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'git:worktree-add',
    async (_event, projectPath: string, wtPath: string, branch: string, createBranch: boolean) => {
      const git = simpleGit(projectPath);
      if (createBranch) {
        await git.raw(['worktree', 'add', '-b', branch, wtPath]);
      } else {
        await git.raw(['worktree', 'add', wtPath, branch]);
      }
    }
  );

  ipcMain.handle('git:worktree-remove', async (_event, projectPath: string, wtPath: string) => {
    const git = simpleGit(projectPath);
    await git.raw(['worktree', 'remove', wtPath]);
  });
}

async function parseWorktrees(git: ReturnType<typeof simpleGit>): Promise<GitWorktree[]> {
  const raw = await git.raw(['worktree', 'list', '--porcelain']);
  const worktrees: GitWorktree[] = [];
  let current: Partial<GitWorktree> = {};
  let isFirst = true;

  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as GitWorktree);
      }
      current = { path: line.slice(9), isMain: isFirst };
      isFirst = false;
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path) {
        worktrees.push(current as GitWorktree);
        current = {};
      }
    }
  }

  if (current.path) {
    worktrees.push(current as GitWorktree);
  }

  return worktrees;
}
