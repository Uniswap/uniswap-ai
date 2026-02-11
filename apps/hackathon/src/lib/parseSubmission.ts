import type { GitHubIssue, HackathonProject } from './types';
import { slugify } from './formatters';

function extractSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = body.split(/^### /m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const newlineIndex = trimmed.indexOf('\n');
    if (newlineIndex === -1) {
      sections.set(trimmed.trim(), '');
      continue;
    }

    const heading = trimmed.slice(0, newlineIndex).trim();
    const content = trimmed.slice(newlineIndex + 1).trim();
    sections.set(heading, content);
  }

  return sections;
}

function parseTeamMembers(raw: string): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);
}

function parseTechStack(raw: string): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((tech) => tech.trim())
    .filter(Boolean);
}

function stripSubmissionPrefix(title: string): string {
  return title.replace(/^\[SUBMISSION]\s*/i, '');
}

export function parseSubmission(issue: GitHubIssue): HackathonProject {
  const title = stripSubmissionPrefix(issue.title);
  const body = issue.body ?? '';
  const sections = extractSections(body);

  const projectName = sections.get('Project Name') ?? title;
  const description = sections.get('Description') ?? body;
  const category = sections.get('Category') ?? 'DeFi Automation';
  const teamMembersRaw = sections.get('Team Members') ?? '';
  const repoUrl = sections.get('GitHub Repository') ?? '';
  const demoUrlRaw = sections.get('Demo URL') ?? '';
  const techStackRaw = sections.get('Technical Stack') ?? '';

  const demoUrl = demoUrlRaw && demoUrlRaw !== '_No response_' ? demoUrlRaw : null;

  return {
    id: issue.id,
    slug: `${slugify(projectName)}-${issue.number}`,
    title: projectName,
    description,
    category,
    teamMembers: parseTeamMembers(teamMembersRaw),
    repoUrl,
    demoUrl,
    techStack: parseTechStack(techStackRaw),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    authorLogin: issue.user?.login ?? 'unknown',
    authorAvatarUrl: issue.user?.avatar_url ?? '',
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    bodyRaw: body,
  };
}
