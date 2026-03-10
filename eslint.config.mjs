/**
 * Root ESLint config for the monorepo.
 * Workspace packages (apps/*, packages/*) define their own configs.
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/reference/**",
      "**/.turbo/**",
    ],
  },
];
