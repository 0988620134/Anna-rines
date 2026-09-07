import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const isUserPage = repoName.endsWith('.github.io');
const githubBase = repoName ? (isUserPage ? '/' : `/${repoName}/`) : '/';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? githubBase : '/',
});
