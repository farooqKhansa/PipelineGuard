/**
 * Minimal GitHub client, server-side only.
 *
 * Reads workflow files and resolves action tags to commit SHAs. Unauthenticated
 * requests work for public repositories at 60 requests/hour; set GITHUB_TOKEN
 * to raise that and to reach private repositories.
 *
 * The token is read from the environment and never returned to the client.
 */

const API = 'https://api.github.com';

export interface RepoRef {
  owner: string;
  repo: string;
}

export class GitHubError extends Error {
  constructor(public status: number, message: string, public hint?: string) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** Accepts `owner/repo`, a full URL, or a `.git` clone URL. */
export function parseRepoRef(input: string): RepoRef | null {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const url = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (url) return { owner: url[1], repo: url[2] };
  const short = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'PipelineGuard',
  };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function gh<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers(token), cache: 'no-store' });

  if (res.status === 404) {
    throw new GitHubError(404, `Not found: ${path}`,
      'The repository may be private. Set GITHUB_TOKEN in .env.local, or pass a token.');
  }
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    throw new GitHubError(403,
      remaining === '0' ? 'GitHub rate limit exhausted' : 'Forbidden',
      remaining === '0'
        ? 'Unauthenticated requests are limited to 60/hour. Set GITHUB_TOKEN in .env.local.'
        : 'The token may lack the repo scope.');
  }
  if (!res.ok) {
    throw new GitHubError(res.status, `GitHub returned ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export interface RepoMeta {
  full_name: string;
  private: boolean;
  language: string | null;
  default_branch: string;
  pushed_at: string;
  html_url: string;
}

export const getRepo = (r: RepoRef, token?: string) =>
  gh<RepoMeta>(`/repos/${r.owner}/${r.repo}`, token);

interface ContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

export interface WorkflowFile {
  path: string;
  name: string;
  content: string;
}

/** Fetch every workflow definition under .github/workflows. */
export async function getWorkflows(r: RepoRef, token?: string): Promise<WorkflowFile[]> {
  let entries: ContentEntry[];
  try {
    entries = await gh<ContentEntry[]>(`/repos/${r.owner}/${r.repo}/contents/.github/workflows`, token);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }

  const yamlFiles = entries.filter(
    (e) => e.type === 'file' && /\.ya?ml$/i.test(e.name) && e.download_url,
  );

  return Promise.all(
    yamlFiles.map(async (f) => {
      const res = await fetch(f.download_url!, { headers: headers(token), cache: 'no-store' });
      return { path: f.path, name: f.name, content: await res.text() };
    }),
  );
}

/**
 * Resolve `owner/repo@ref` to the commit SHA that ref currently points at.
 *
 * This is what makes the auto-fix a lookup rather than a judgement: the SHA we
 * pin to is the code that is running today, so the change is behaviour-
 * preserving by construction.
 */
export async function resolveActionSha(
  actionRef: string,
  token?: string,
): Promise<{ sha: string; resolvedFrom: string } | null> {
  const m = actionRef.match(/^([\w.-]+)\/([\w.-]+)@(.+)$/);
  if (!m) return null;
  const [, owner, repo, ref] = m;

  for (const path of [`/repos/${owner}/${repo}/commits/${ref}`]) {
    try {
      const data = await gh<{ sha: string }>(path, token);
      if (data?.sha) return { sha: data.sha, resolvedFrom: ref };
    } catch {
      /* fall through — an unresolvable action is reported, not fatal */
    }
  }
  return null;
}

export interface RunSummary {
  conclusion: string | null;
  created_at: string;
  head_sha: string;
  name: string | null;
}

/**
 * Recent workflow runs. Used as historical evidence; when unavailable the
 * analyser lowers confidence rather than assuming a clean history.
 */
export async function getRecentRuns(
  r: RepoRef,
  token?: string,
): Promise<RunSummary[] | null> {
  try {
    const data = await gh<{ workflow_runs: RunSummary[] }>(
      `/repos/${r.owner}/${r.repo}/actions/runs?per_page=50`, token,
    );
    return data.workflow_runs ?? [];
  } catch {
    return null;
  }
}
