import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeContent } from '../src/merge.ts';
import { contentDraft, moveToTrash, restoreProject } from '../src/editor.ts';
import { GitFixture } from './gitFixture.ts';
import { parsePosts, parseSite } from '../src/content.ts';
function setup() { const base = new GitFixture().snapshot(); return { base, local: contentDraft(base), remote: structuredClone(base) }; }
test('independent company, service and post fields merge without metadata conflicts', () => {
  const { base, local, remote } = setup();
  local.site.company.phone = '0123456789'; remote.site.data.company.address = 'Remote address';
  local.site.services[0].description = 'Local service'; remote.site.data.services[1].description = 'Remote service';
  local.posts.posts[0].title = 'My title'; local.posts.posts[0].updatedAt = '2026-11-28T01:00:00Z';
  remote.posts.data.posts[0].summary = 'Their summary'; remote.posts.data.posts[0].updatedAt = '2026-11-28T02:00:00Z';
  const result = mergeContent(base, local, remote);
  assert.equal(result.conflicts.length, 0); assert.equal(result.draft.posts.posts[0].title, 'My title');
  assert.equal(result.draft.posts.posts[0].summary, 'Their summary'); assert.equal(result.draft.site.company.address, 'Remote address');
  assert.equal(result.draft.site.company.phone, '0123456789'); parsePosts(result.draft.posts); parseSite(result.draft.site);
});
test('same-field conflict blocks until an explicit choice; all other edits survive', () => {
  const { base, local, remote } = setup();
  local.posts.posts[0].title = 'Mine'; remote.posts.data.posts[0].title = 'Theirs'; local.site.company.address = 'My address';
  const result = mergeContent(base, local, remote); assert.equal(result.conflicts.length, 1);
  const path = result.conflicts[0].path;
  for (const choice of ['local', 'remote'] as const) {
    const resolved = mergeContent(base, local, remote, { [path]: choice });
    assert.equal(resolved.conflicts.length, 0); assert.equal(resolved.draft.posts.posts[0].title, choice === 'local' ? 'Mine' : 'Theirs');
    assert.equal(resolved.draft.site.company.address, 'My address');
  }
});
test('delete versus concurrent edit requires a whole-post choice; trash never duplicates a post', () => {
  const { base, local, remote } = setup(), id = local.posts.posts[0].id;
  local.posts = moveToTrash(local.posts, base.posts.data, id); remote.posts.data.posts[0].title = 'Edited remotely';
  const result = mergeContent(base, local, remote); assert.equal(result.conflicts.length, 1);
  const path = result.conflicts[0].path;
  const deleted = mergeContent(base, local, remote, { [path]: 'local' });
  assert.equal(deleted.draft.posts.posts.some((post) => post.id === id), false); assert.equal(deleted.draft.posts.trash![0].project.id, id); parsePosts(deleted.draft.posts);
  const edited = mergeContent(base, local, remote, { [path]: 'remote' });
  assert.equal(edited.draft.posts.posts[0].title, 'Edited remotely'); assert.equal(edited.draft.posts.trash?.length || 0, 0);
});
test('purge versus restoration requires a choice and preserves the chosen state', () => {
  const state = setup(), id = state.base.posts.data.posts[1].id;
  state.base.posts.data = moveToTrash(state.base.posts.data, state.base.posts.data, id);
  const local = contentDraft(state.base), remote = structuredClone(state.base); local.posts.trash = [];
  remote.posts.data = restoreProject(remote.posts.data, id);
  const result = mergeContent(state.base, local, remote); assert.equal(result.conflicts.length, 1);
  const restored = mergeContent(state.base, local, remote, { [result.conflicts[0].path]: 'remote' });
  assert.ok(restored.draft.posts.posts.some((post) => post.id === id)); parsePosts(restored.draft.posts);
});
test('two independent new posts both survive a concurrent save', () => {
  const { base, local, remote } = setup();
  local.posts.posts.push({ ...structuredClone(local.posts.posts[0]), id: 'local-new', slug: 'local-new' });
  remote.posts.data.posts.push({ ...structuredClone(local.posts.posts[0]), id: 'remote-new', slug: 'remote-new' });
  const result = mergeContent(base, local, remote); assert.equal(result.conflicts.length, 0);
  assert.ok(result.draft.posts.posts.some((post) => post.id === 'local-new')); assert.ok(result.draft.posts.posts.some((post) => post.id === 'remote-new')); parsePosts(result.draft.posts);
});
test('restore then remove before Save returns the published trash entry', () => {
  const { base } = setup(), id = base.posts.data.posts[1].id;
  const saved = moveToTrash(base.posts.data, base.posts.data, id);
  assert.deepEqual(moveToTrash(restoreProject(saved, id), saved, id), saved);
});
