import type { ShellType } from '@shared/types';

export function toShellPath(winPath: string, shellType: ShellType): string {
  let result = winPath;
  if (shellType === 'wsl') {
    const match = winPath.match(/^([A-Za-z]):[\\/](.*)$/);
    if (match) {
      result = `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
    }
  }
  return result.includes(' ') ? `"${result}"` : result;
}
