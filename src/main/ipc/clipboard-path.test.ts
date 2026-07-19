import { describe, it, expect } from 'vitest';
import { toShellPath } from './clipboard';

describe('toShellPath', () => {
  it('translates a Windows path to a WSL mount path', () => {
    expect(toShellPath('C:\\Projetos\\mekan\\x.png', 'wsl')).toBe('/mnt/c/Projetos/mekan/x.png');
  });

  it('lowercases the drive letter for WSL', () => {
    expect(toShellPath('D:\\a\\b.png', 'wsl')).toBe('/mnt/d/a/b.png');
  });

  it('leaves the path unchanged for pwsh', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'pwsh')).toBe('C:\\Projetos\\x.png');
  });

  it('leaves the path unchanged for cmd', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'cmd')).toBe('C:\\Projetos\\x.png');
  });

  it('quotes a Windows path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'pwsh')).toBe('"C:\\My Projects\\x.png"');
  });

  it('quotes a WSL path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'wsl')).toBe('"/mnt/c/My Projects/x.png"');
  });
});
