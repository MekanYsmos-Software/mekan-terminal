import fs from 'fs';
import path from 'path';
import os from 'os';

const MEKAN_DIR = path.join(os.homedir(), '.mekan');
const PROJECTS_FILE = path.join(MEKAN_DIR, 'projects.json');
const LAYOUTS_DIR = path.join(MEKAN_DIR, 'layouts');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function init() {
  ensureDir(MEKAN_DIR);
  ensureDir(LAYOUTS_DIR);
}

export function readProjects(): unknown[] {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function writeProjects(projects: unknown[]) {
  ensureDir(MEKAN_DIR);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export function readLayout(projectId: string): unknown | null {
  const file = path.join(LAYOUTS_DIR, `${projectId}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw);
}

export function writeLayout(projectId: string, layout: unknown) {
  ensureDir(LAYOUTS_DIR);
  const file = path.join(LAYOUTS_DIR, `${projectId}.json`);
  fs.writeFileSync(file, JSON.stringify(layout, null, 2), 'utf-8');
}
