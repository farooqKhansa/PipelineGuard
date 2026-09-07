/**
 * Workflow source, as the agent reads it.
 *
 * `flagged` line numbers are the lines an investigation anchored to, so the
 * config viewer can highlight exactly what the reasoning chain cited rather
 * than re-deriving it in the UI.
 */
export interface WorkflowSource {
  path: string;
  lines: string[];
  flagged: Record<number, { findingId: string; note: string }>;
}

const deployProd = `name: Deploy (production)

on:
  push:
    tags: ['v*']
  workflow_dispatch:

concurrency: deploy-production

permissions: write-all

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t ghcr.io/northwind/checkout:\${{ github.sha }} .
      - name: Push image
        run: docker push ghcr.io/northwind/checkout:\${{ github.sha }}

  smoke-test:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - name: Probe health endpoint
        run: ./scripts/smoke.sh
      - name: Assert version
        run: ./scripts/assert-version.sh

  deploy:
    needs: [build, smoke-test]
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        env:
          AWS_ROLE_ARN: \${{ secrets.AWS_ROLE_ARN }}
        run: ./scripts/assume-role.sh
      - name: Debug environment
        if: runner.debug == '1'
        run: env
      - name: Apply deployment
        env:
          PROD_DEPLOY_KEY: \${{ secrets.PROD_DEPLOY_KEY }}
        run: ./scripts/deploy.sh
      - name: Publish release notes
        run: gh api "repos/\${{ github.repository }}/\${{ env.RELEASE_MODE }}" -f body="\${{ github.event.head_commit.message }}"

  notify:
    needs: [deploy]
    runs-on: ubuntu-latest
    steps:
      - name: Post to Slack
        run: curl -X POST -d "deployed \${{ github.sha }}" "\${{ secrets.SLACK_WEBHOOK }}"

  rollback-guard:
    needs: [deploy]
    runs-on: ubuntu-latest
    steps:
      - name: Watch error rate
        run: ./scripts/watch-errors.sh --window 10m
`;

const ci = `name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v3
        with:
          path: ~/.npm
          key: npm-\${{ hashFiles('**/package-lock.json') }}
      - run: npm ci
      - run: npm test -- --coverage

      - name: Detect changed files
        id: changed
        uses: tj-actions/changed-files@v41
        with:
          files: src/**

      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    needs: [lint, test]
    permissions:
      contents: read
      packages: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: coverage-report
      - run: npm ci && npm run build
`;

const release = `name: Release

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  tag:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Tag release
        run: ./scripts/tag.sh

  notify:
    needs: [tag]
    runs-on: ubuntu-latest
    steps:
      - name: Notify downstream
        run: |
          curl -X POST "\${{ vars.WEBHOOK_URL }}" -d "\${{ toJSON(github.event) }}" || true
`;

export const workflowSources: Record<string, WorkflowSource> = {
  pl_deploy_prod: {
    path: '.github/workflows/deploy-prod.yml',
    lines: deployProd.split('\n'),
    flagged: {
      9: { findingId: 'PG-1043', note: 'write-all applies to all five jobs, including two that previously held none.' },
      50: { findingId: 'PG-1047', note: 'Debug step prints the full environment, including the role ARN set above.' },
      57: { findingId: 'PG-1043', note: 'gh api subcommand assembled at runtime — required scope cannot be derived statically.' },
    },
  },
  pl_ci_checkout: {
    path: '.github/workflows/ci.yml',
    lines: ci.split('\n'),
    flagged: {
      22: { findingId: 'PG-1042', note: 'Mutable tag: upstream can repoint v3 at any time.' },
      31: { findingId: 'PG-1042', note: 'Mutable tag from a publisher with a prior tag-hijack advisory.' },
      43: { findingId: 'PG-1051', note: 'packages: write held for 60 days with no publish call in any run.' },
    },
  },
  pl_release: {
    path: '.github/workflows/release.yml',
    lines: release.split('\n'),
    flagged: {
      24: { findingId: 'PG-1044', note: 'Full event payload posted to a host the agent cannot resolve. Failure silently swallowed by || true.' },
    },
  },
};
