// These values are public. Tokens must never be read from build-time variables.
const env = import.meta.env ?? {};

export const githubConfig = {
  owner: env.VITE_GITHUB_OWNER || 'BomXanhGZ',
  repo: env.VITE_GITHUB_REPO || 'THIEN-THOI-LAM-DONG',
  branch: env.VITE_GITHUB_BRANCH || 'main',
};
