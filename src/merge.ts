import type { ContentDraft, ContentSnapshot } from './editor.ts';
import { contentDraft, sameContent } from './editor.ts';
import type { Project } from './content.ts';
import { projectPosition } from './content.ts';

export interface ContentConflict { path: string; local: unknown; remote: unknown }
export type ConflictChoices = Record<string, 'local' | 'remote'>;
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function identity(value: unknown): string | undefined {
  if (!object(value)) return undefined;
  return typeof value.id === 'string' ? value.id
    : object(value.project) && typeof value.project.id === 'string' ? value.project.id : undefined;
}

/** Three-way merge: independent fields combine; conflicting values require a choice. */
export function mergeContent(base: ContentSnapshot, local: ContentDraft, remote: ContentSnapshot, choices: ConflictChoices = {}) {
  const conflicts: ContentConflict[] = [];
  const mapped = (input: ContentDraft) => ({ site: input.site, projects: Object.fromEntries([
    ...input.posts.posts.map((project, index) => [project.id, { state: 'active', project, index: projectPosition(input.posts, index) }]),
    ...(input.posts.trash || []).map((item) => [item.project.id, { state: 'trash', ...item }]),
  ]) });
  function merge(before: unknown, mine: unknown, theirs: unknown, path: string): unknown {
    if (path.endsWith('/project/updatedAt')) return structuredClone(theirs);
    if (sameContent(mine, before)) return structuredClone(theirs);
    if (sameContent(theirs, before) || sameContent(mine, theirs)) return structuredClone(mine);
    const movedAndEdited = object(before) && object(mine) && object(theirs) && before.state
      && ((mine.state !== before.state && !sameContent(theirs.project, before.project))
        || (theirs.state !== before.state && !sameContent(mine.project, before.project)));
    if (!movedAndEdited && object(mine) && object(theirs) && (object(before) || before === undefined)) {
      const original = object(before) ? before : {};
      const result: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(original), ...Object.keys(mine), ...Object.keys(theirs)])) {
        const value = merge(original[key], mine[key], theirs[key], `${path}/${key}`);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (Array.isArray(before) && Array.isArray(mine) && Array.isArray(theirs)
      && [...before, ...mine, ...theirs].every((item) => identity(item))) {
      const original = new Map(before.map((item) => [identity(item), item]));
      const left = new Map(mine.map((item) => [identity(item), item]));
      const right = new Map(theirs.map((item) => [identity(item), item]));
      return [...new Set([...right.keys(), ...left.keys(), ...original.keys()])].flatMap((id) => {
        const value = merge(original.get(id), left.get(id), right.get(id), `${path}/${id}`);
        return value === undefined ? [] : [value];
      });
    }
    if (choices[path]) return structuredClone(choices[path] === 'local' ? mine : theirs);
    conflicts.push({ path, local: structuredClone(mine), remote: structuredClone(theirs) });
    return structuredClone(mine);
  }
  const combined = merge(mapped(contentDraft(base)), mapped(local), mapped(contentDraft(remote)), '') as {
    site: ContentDraft['site']; projects: Record<string, { state: string; project: Project; index: number; deletedAt?: string }>;
  };
  const entries = Object.values(combined.projects).sort((a, b) => a.index - b.index).map((item, index) => ({ ...item, index }));
  const trash = entries.filter((item) => item.state === 'trash').map((item) => ({ project: item.project, index: item.index, deletedAt: item.deletedAt! }));
  const draft: ContentDraft = { site: combined.site, posts: {
    ...remote.posts.data, posts: entries.filter((item) => item.state === 'active').map((item) => item.project),
    ...(trash.length || local.posts.trash || remote.posts.data.trash ? { trash } : {}),
  } };
  return { draft, conflicts };
}
