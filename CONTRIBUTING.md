# Contributing to Datalook Studio

Thank you for your interest in contributing! This document covers the development workflow, code style, and review process.

## Getting started

1. **Fork & clone** the repository
2. **Install dependencies**: `pnpm install`
3. **Start dev server**: `pnpm dev`
4. **Optional — start local databases**: `pnpm db:up`

## Development workflow

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes. Keep commits focused and write clear commit messages.
3. **Type-check**: `npx tsc --noEmit`
4. **Build**: `pnpm build` — ensure the production build passes
5. Open a pull request targeting `main`

### Branch naming

- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation changes
- `chore/` — tooling, dependencies, refactors

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Cassandra keyspace support in navigator
fix: prevent duplicate tabs when opening same table
docs: update deployment guide with Docker instructions
```

Pull requests are checked by the **Commit lint** workflow. Squash merges keep
only the PR title, so write the title in the same form.

### Branches and releases

`main` is the source of truth. Changes flow one way:

```
feature branch --PR--> main --> dev --> prod
                       (source)  (pre-releases)  (stable releases)
```

- Open feature PRs against `main`.
- Promote `main` into `dev` (`dev` is created from `main`).
- Promote `dev` into `prod` (`prod` is created from `dev`).
- Pushing to `dev` publishes a pre-release such as `1.4.0-dev.2`.
- Pushing to `prod` publishes a stable release such as `1.4.0`.
- Releases don't commit back to `dev` or `prod`. The version lives in the git
  tag and the GitHub release, so promotions are the only changes to those
  branches.

Releases are automatic. Every push to `dev` or `prod` runs
[semantic-release](https://github.com/semantic-release/semantic-release)
(`.releaserc.json`), which reads the commits since the last tag:

| Commit | Version bump |
| --- | --- |
| `fix:` | patch (1.2.3 → 1.2.4) |
| `feat:` | minor (1.2.3 → 1.3.0) |
| `feat!:` or a `BREAKING CHANGE:` footer | major (1.2.3 → 2.0.0) |
| `docs:`, `chore:`, `refactor:`, `test:`, … | no release |

When a release is published, the release workflow (`.github/workflows/release.yml`)
tags `vX.Y.Z`, creates the GitHub release with generated notes, attaches a standalone server tarball with its SHA-256 checksum, and
pushes the container image, named per channel so the two are easy to tell apart:

- `ghcr.io/<owner>/<repo>-dev:v<version>` for pre-releases from `dev`
- `ghcr.io/<owner>/<repo>-prod:v<version>` for stable releases from `prod`

Only stable releases move `latest` (on the `-prod` image).
Do not create version tags or releases by hand.

## Code style

- **TypeScript**: Strict mode. No `any` types without justification.
- **Components**: Functional React with hooks. No class components.
- **Styling**: Tailwind CSS utility classes. Use `cn()` from `lib/utils` for conditional classes.
- **State**: React Context for global state. `useState`/`useReducer` for local state.
- **Persistence**: All IndexedDB operations go through `lib/persistence.ts`.
- **Encryption**: All credential handling goes through `lib/crypto.ts`.
- **Imports**: Use `@/` path alias. Group: external → internal → relative.
- **No comments** unless explaining non-obvious logic. Code should be self-documenting.

## Project structure

| Area | Location | Notes |
|---|---|---|
| Pages | `app/` | Next.js App Router |
| UI components | `components/ui/` | shadcn/ui primitives |
| Workspace | `components/workspace/` | Navigator, editor, tabs, dialogs |
| Providers | `components/providers/` | Auth, workspace, theme contexts |
| Core logic | `lib/` | Types, drivers, RBAC, persistence, crypto |
| Docker | `docker/` | Dockerfile and compose files |
| Docs | `docs/` | MkDocs source files |

## Testing

Before submitting a PR:

```bash
npx tsc --noEmit    # type check
pnpm build          # production build
```

If your change affects Docker:

```bash
docker compose -f docker/docker-compose.yaml build app
```

## Pull request process

1. Ensure your branch is up to date with `main`
2. Link any related issues in the PR description
3. Include screenshots for UI changes
4. A maintainer will review and merge

## Reporting bugs

Open a GitHub Issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS
- Console errors (if any)

## Feature requests

Open a GitHub Issue with the `enhancement` label. Describe the use case and proposed solution.

## Code of Conduct

All contributors must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
