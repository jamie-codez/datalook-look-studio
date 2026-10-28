# [1.0.0-dev.2](https://github.com/jamie-codez/datalook-look-studio/compare/v1.0.0-dev.1...v1.0.0-dev.2) (2026-10-28)


### Bug Fixes

* **ci:** set up buildx before cache-backed image build ([cd07439](https://github.com/jamie-codez/datalook-look-studio/commit/cd07439e8a6122acbbc36095a53695d2aff1317b))

# 1.0.0-dev.1 (2026-10-28)


### Bug Fixes

* add --ignore-scripts to Dockerfile pnpm install for msw build script ([dbb75aa](https://github.com/jamie-codez/datalook-look-studio/commit/dbb75aa92ada4f4dc214162721c5f644e792c5e2))
* add password field to connections, make database optional, fix Dockerfile ENV for NEXT_PUBLIC build args ([ac230df](https://github.com/jamie-codez/datalook-look-studio/commit/ac230df4d2f64117bef33ee8f91239ed30349837))
* move pnpm overrides to pnpm-workspace.yaml for Docker compatibility ([2eac41f](https://github.com/jamie-codez/datalook-look-studio/commit/2eac41ff6c9363ef16dfe4c57593b84d200987cb))
* pin pnpm version so CI matches the lockfile it's supposed to install from ([2fec918](https://github.com/jamie-codez/datalook-look-studio/commit/2fec918b27f4ae7d55ff3e8f79d397c60992db11))
* resolve GitHub Actions failures in Production and Deploy Docs workflows ([345a9e6](https://github.com/jamie-codez/datalook-look-studio/commit/345a9e6c27e7d2cf3733bbfbf0d1ee5a19d7c6f3))
* use env-configured DB driver/credentials for system store, zero out fake data in production, add admin user pre-init check ([77855a5](https://github.com/jamie-codez/datalook-look-studio/commit/77855a51e8af64ba14d23a4ff429dfdbe054f060))


### Features

* add onboarding screen, system store setup, and configurable Docker environment variables ([28862b2](https://github.com/jamie-codez/datalook-look-studio/commit/28862b2032d763d6ece997d0f1cb9294a762bf9d))
* add settings sidebar, theme customization, datasource picker, tabbed connection dialog, Docker deployment, docs, and branding ([189ec20](https://github.com/jamie-codez/datalook-look-studio/commit/189ec2005ab1605176e2b074d5e90e2aacefcbef))
* centralized system initialization in init-system.ts — creates DB, schema, admin user, system connection, and first audit log in sequence before app renders ([031e23c](https://github.com/jamie-codez/datalook-look-studio/commit/031e23c480a2d31c946ad3857909fa737f982ade))
* implement multi-database adapter framework and connection manager ([0d25319](https://github.com/jamie-codez/datalook-look-studio/commit/0d25319d6a851d63adef3ee54ee0c43fea63cd6e))
* live database connections, server-side access control, dev/prod release flow ([d2af595](https://github.com/jamie-codez/datalook-look-studio/commit/d2af59511b413bb4d892211c54e483f3fd752bd0))
* real live server metrics for every adapter, wire query history, fix two live-data bugs ([78503ec](https://github.com/jamie-codez/datalook-look-studio/commit/78503ecd5641e49fe3b7dca68ed64ad62df9dd1b))
* wire real Postgres-backed auth and system store, fix audit findings ([595ba6a](https://github.com/jamie-codez/datalook-look-studio/commit/595ba6a0647ffd49620c6b787e29d87e3708144f))
