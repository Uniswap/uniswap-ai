import type { HackathonProject } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function assertHackathonProject(data: unknown): HackathonProject {
  if (!isRecord(data)) {
    throw new Error('Expected project data to be an object');
  }

  if (typeof data.id !== 'number') {
    throw new Error('Expected project.id to be a number');
  }
  if (typeof data.slug !== 'string') {
    throw new Error('Expected project.slug to be a string');
  }
  if (typeof data.title !== 'string') {
    throw new Error('Expected project.title to be a string');
  }
  if (typeof data.description !== 'string') {
    throw new Error('Expected project.description to be a string');
  }
  if (typeof data.category !== 'string') {
    throw new Error('Expected project.category to be a string');
  }
  if (!isStringArray(data.teamMembers)) {
    throw new Error('Expected project.teamMembers to be a string array');
  }
  if (typeof data.repoUrl !== 'string') {
    throw new Error('Expected project.repoUrl to be a string');
  }
  if (data.demoUrl !== null && typeof data.demoUrl !== 'string') {
    throw new Error('Expected project.demoUrl to be a string or null');
  }
  if (!isStringArray(data.techStack)) {
    throw new Error('Expected project.techStack to be a string array');
  }
  if (typeof data.createdAt !== 'string') {
    throw new Error('Expected project.createdAt to be a string');
  }
  if (typeof data.updatedAt !== 'string') {
    throw new Error('Expected project.updatedAt to be a string');
  }
  if (typeof data.authorLogin !== 'string') {
    throw new Error('Expected project.authorLogin to be a string');
  }
  if (typeof data.authorAvatarUrl !== 'string') {
    throw new Error('Expected project.authorAvatarUrl to be a string');
  }
  if (typeof data.issueNumber !== 'number') {
    throw new Error('Expected project.issueNumber to be a number');
  }
  if (typeof data.issueUrl !== 'string') {
    throw new Error('Expected project.issueUrl to be a string');
  }
  if (typeof data.bodyRaw !== 'string') {
    throw new Error('Expected project.bodyRaw to be a string');
  }

  // All fields validated above; construct typed object from validated data
  return {
    id: data.id as number,
    slug: data.slug as string,
    title: data.title as string,
    description: data.description as string,
    category: data.category as string,
    teamMembers: data.teamMembers as string[],
    repoUrl: data.repoUrl as string,
    demoUrl: data.demoUrl as string | null,
    techStack: data.techStack as string[],
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
    authorLogin: data.authorLogin as string,
    authorAvatarUrl: data.authorAvatarUrl as string,
    issueNumber: data.issueNumber as number,
    issueUrl: data.issueUrl as string,
    bodyRaw: data.bodyRaw as string,
  };
}

export function assertHackathonProjectArray(data: unknown): HackathonProject[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected loader data to be an array of projects');
  }
  return data.map((item, index) => {
    try {
      return assertHackathonProject(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Invalid project at index ${index}: ${message}`);
    }
  });
}
