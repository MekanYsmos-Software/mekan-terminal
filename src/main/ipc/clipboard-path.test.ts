import { describe, it, expect } from 'vitest';
import { toShellPath } from './clipboard-path';

describe('toShellPath', () => {
  it('translates a Windows path to a WSL mount path', () => {
    expect(toShellPath('C:\\Projetos\\mekan\\x.png', 'wsl')).toBe("'/mnt/c/Projetos/mekan/x.png'");
  });

  it('lowercases the drive letter for WSL', () => {
    expect(toShellPath('D:\\a\\b.png', 'wsl')).toBe("'/mnt/d/a/b.png'");
  });

  it('quotes an unremarkable path for pwsh', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'pwsh')).toBe("'C:\\Projetos\\x.png'");
  });

  it('quotes an unremarkable path for cmd', () => {
    expect(toShellPath('C:\\Projetos\\x.png', 'cmd')).toBe('"C:\\Projetos\\x.png"');
  });

  it('quotes a Windows path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'pwsh')).toBe("'C:\\My Projects\\x.png'");
  });

  it('quotes a WSL path containing a space', () => {
    expect(toShellPath('C:\\My Projects\\x.png', 'wsl')).toBe("'/mnt/c/My Projects/x.png'");
  });

  it('quotes a path containing an ampersand for pwsh', () => {
    expect(toShellPath('C:\\Projects\\a&b.png', 'pwsh')).toBe("'C:\\Projects\\a&b.png'");
  });

  it('quotes a path containing an ampersand for wsl', () => {
    expect(toShellPath('C:\\Projects\\a&b.png', 'wsl')).toBe("'/mnt/c/Projects/a&b.png'");
  });

  it('quotes a path containing a dollar sign for pwsh', () => {
    expect(toShellPath('C:\\Projects\\a$b.png', 'pwsh')).toBe("'C:\\Projects\\a$b.png'");
  });

  it('quotes a path containing a dollar sign for wsl', () => {
    expect(toShellPath('C:\\Projects\\a$b.png', 'wsl')).toBe("'/mnt/c/Projects/a$b.png'");
  });

  it('escapes an embedded single quote for wsl', () => {
    expect(toShellPath("C:\\Projects\\a'b.png", 'wsl')).toBe("'/mnt/c/Projects/a'\\''b.png'");
  });

  it('escapes an embedded single quote for pwsh', () => {
    expect(toShellPath("C:\\Projects\\a'b.png", 'pwsh')).toBe("'C:\\Projects\\a''b.png'");
  });
});
