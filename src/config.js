import { REPO_PATTERN } from './core/submission.js';

const configured = String(import.meta.env?.VITE_GITHUB_REPO ?? '').trim();
export const GITHUB_REPO = REPO_PATTERN.test(configured) ? configured : '';
