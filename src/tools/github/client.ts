import { Octokit } from 'octokit';
import { execa } from 'execa';
import { GitHubIssue, PullRequest } from '../../types';
import { logger } from '../../utils/logger';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const { data } = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      labels: data.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
      author: data.user?.login || 'unknown',
    };
  }

  async cloneRepo(owner: string, repo: string, targetPath: string): Promise<void> {
    await execa('git', [
      'clone',
      `https://github.com/${owner}/${repo}.git`,
      targetPath,
      '--depth',
      '1',
    ]);
    logger.success(`Cloned to ${targetPath}`);
  }

  async createPR(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<PullRequest> {
    const { data } = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    return { url: data.html_url, number: data.number };
  }
}
