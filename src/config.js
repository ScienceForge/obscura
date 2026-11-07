import { REPO_PATTERN } from './core/submission.js';

/**
 * The GitHub repository that receives submissions, as "owner/name". It is set
 * at build time with VITE_GITHUB_REPO (the Pages workflow sets it
 * automatically). When it is missing or malformed the site says so honestly
 * instead of pretending submissions can be sent.
 */
const configured = String(import.meta.env?.VITE_GITHUB_REPO ?? '').trim();
export const GITHUB_REPO = REPO_PATTERN.test(configured) ? configured : '';
