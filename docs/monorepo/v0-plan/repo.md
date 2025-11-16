# Repo-level (spatial-ui-kit)

Goal: scaffold the monorepo, tooling, and workspace plumbing.

- Initialize repo
  - git init
  - Add .gitignore (node_modules, dist, etc.)
  - Add basic README.md (outline exists)
- Set up workspace tooling
  - Choose package manager (pnpm / yarn) and enable workspaces
  - Configure package.json with `"workspaces": ["packages/*", "apps/*"]`
  - Add TypeScript config at root (tsconfig.base.json)
  - Add linting/prettier config (optional but good)
- Add build/test tooling
  - Pick builder (e.g. tsup or rollup) for packages
  - Pick test runner (Vitest / Jest)
  - Optionally add Turborepo / Nx for task orchestration
