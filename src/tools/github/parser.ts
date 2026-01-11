import { ParsedIssueUrl } from '../../types';

export function parseIssueUrl(url: string): ParsedIssueUrl {
  const regex = /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid GitHub issue URL');
  }

  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10),
  };
}
