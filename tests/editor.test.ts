import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { contentDraft, persistDraft, readEditorSnapshot, moveToTrash, restoreProject, purgeProject, UncertainSaveError, RejectedSaveError } from '../src/editor.ts';
import type { PendingImage, SavePlan } from '../src/editor.ts';
import { clearContentCache, GitHubError, readSite } from '../src/github.ts';
import { GitFixture, fixturePosts } from './gitFixture.ts';
import type { PostsData } from '../src/content.ts';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; clearContentCache(); });
function setup() {
  const github = new GitFixture(); globalThis.fetch = github.fetch;
  const snapshot = github.snapshot(), draft = contentDraft(snapshot), pending = new Map<string, PendingImage>();
  let plan: SavePlan | undefined;
  const save = () => persistDraft({ snapshot, draft, pending, token: 'fixture', plan,
    checkpoint: async () => {}, planned: async (next) => { plan = next; } });
  return { github, snapshot, draft, pending, save, get plan() { return plan; } };
}
function photo() { return { file: new File(['photo'], 'photo.png', { type: 'image/png' }), url: 'blob:photo' }; }
test('admin snapshot pins both JSON documents to the same immutable head', async () => {
  const state = setup(); assert.deepEqual(await readEditorSnapshot('fixture'), state.snapshot);
  assert.equal(state.github.calls.filter((call) => call.path.startsWith('/contents/')).length, 2);
});
test('Save publishes JSON and images atomically with one non-force update, preserving source', async () => {
  const state = setup(); state.draft.site.company.name = 'Saved company';
  state.pending.set('pending:photo', photo()); state.draft.posts.posts[0].images.push({ path: 'pending:photo', alt: 'photo' });
  const before = state.github.head, originalFiles = structuredClone(state.github.files());
  state.github.beforePatch = () => { assert.equal(state.github.head, before); assert.deepEqual(state.github.files(), originalFiles); assert.ok(state.plan); };
  const result = await state.save();
  assert.equal(result.snapshot.head, state.github.head);
  assert.equal(state.github.calls.filter((call) => call.method === 'PATCH').length, 1);
  assert.equal(state.github.files()['src/unrelated.ts'], state.github.files(before)['src/unrelated.ts']);
  assert.equal(state.github.data<{ company: { name: string } }>('data/site.json').company.name, 'Saved company');
  assert.ok(state.github.files()[result.draft.posts.posts[0].images.at(-1)!.path]);
  assert.equal((await readSite()).company.name, 'Saved company');
});
test('staging failure publishes nothing; retry reuses the same image path and blob', async () => {
  for (const failPath of ['/git/trees', '/git/commits']) {
    const state = setup(), before = state.github.head; state.pending.set('pending:photo', photo());
    state.draft.posts.posts[0].images.push({ path: 'pending:photo', alt: '' }); state.github.failPath = failPath;
    await assert.rejects(state.save(), GitHubError); assert.equal(state.github.head, before);
    const target = state.pending.get('pending:photo')!.target!;
    assert.ok(target); assert.equal(state.github.files()[target], undefined);
    state.github.failPath = ''; const result = await state.save();
    assert.equal(result.draft.posts.posts[0].images.at(-1)!.path, target);
    assert.equal(state.github.calls.filter((call) => call.path === '/git/blobs' && call.body.content === Buffer.from('photo').toString('base64')).length, 1);
    clearContentCache();
  }
});
test('lost branch-update response is verified as success without a second publication', async () => {
  const state = setup(); state.draft.site.company.name = 'Acknowledged after loss'; state.github.losePatch = true;
  const result = await state.save(); assert.equal(result.snapshot.head, state.github.head);
  assert.equal(state.github.calls.filter((call) => call.method === 'PATCH').length, 1);
});
test('offline verification retains the exact commit; retry after reload creates no duplicate', async () => {
  const state = setup(); state.draft.site.company.name = 'Published offline'; state.github.offlineAfterPatch = true;
  await assert.rejects(state.save(), UncertainSaveError); assert.ok(state.plan);
  const plan = structuredClone(state.plan), commits = state.github.commits.size; state.github.offline = false;
  const result = await persistDraft({ snapshot: state.snapshot, draft: state.draft, pending: new Map(), token: 'fixture', plan, checkpoint: async () => {}, planned: async () => { assert.fail('Must reuse plan'); } });
  assert.equal(result.snapshot.head, plan.commit); assert.equal(state.github.commits.size, commits);
  assert.equal(state.github.calls.filter((call) => call.method === 'PATCH').length, 1);
});
test('backup failure before publication leaves the live branch unchanged', async () => {
  const state = setup(), before = state.github.head; state.draft.site.company.name = 'Not published';
  await assert.rejects(persistDraft({ snapshot: state.snapshot, draft: state.draft, pending: state.pending, token: 'fixture', checkpoint: async () => {}, planned: async () => { throw new Error('Disk full'); } }), /Disk full/);
  assert.equal(state.github.head, before); assert.equal(state.github.calls.some((call) => call.method === 'PATCH'), false);
});
test('stale JSON rejects before staging; a racing admin cannot be overwritten', async () => {
  const state = setup(); state.draft.site.company.name = 'Mine';
  const remote = contentDraft(state.snapshot); remote.site.company.name = 'Theirs'; state.github.external(remote.site);
  await assert.rejects(state.save(), (failure: unknown) => failure instanceof GitHubError && failure.status === 409);
  assert.equal(state.github.calls.some((call) => call.method === 'POST'), false);
  const second = setup(); second.draft.site.company.name = 'Mine';
  second.github.beforePatch = () => { second.github.external(remote.site); };
  await assert.rejects(second.save(), (failure: unknown) => failure instanceof RejectedSaveError && failure.status === 409);
  assert.equal(second.github.data<{company:{name:string}}>('data/site.json').company.name, 'Theirs');
});
test('soft delete keeps the published post; restore retains its original position', () => {
  const state = setup(), id = state.draft.posts.posts[1].id;
  state.draft.posts.posts[1].title = 'Unpublished edit';
  const deleted = moveToTrash(state.draft.posts, state.snapshot.posts.data, id);
  assert.equal(deleted.trash![0].project.title, state.snapshot.posts.data.posts[1].title);
  assert.equal(deleted.posts.some((post) => post.id === id), false);
  assert.deepEqual(restoreProject(deleted, id).posts, state.snapshot.posts.data.posts);
  const unsaved = structuredClone(state.draft.posts.posts[0]); unsaved.id = 'new'; unsaved.slug = 'new';
  assert.equal(moveToTrash({ ...fixturePosts, posts: [...fixturePosts.posts, unsaved] }, fixturePosts, 'new').trash?.length || 0, 0);
});
test('purge deletes only unreferenced managed uploads; shared and original images remain', async () => {
  const posts = structuredClone(fixturePosts), removed = 'public/images/projects/deleted/unique.png', shared = 'public/images/projects/deleted/shared.png';
  posts.posts[0].images.push({ path: shared, alt: '' });
  const archived = structuredClone(posts.posts[1]); archived.id = 'archived'; archived.slug = 'archived';
  archived.images.push({ path: removed, alt: '' }, { path: shared, alt: '' });
  posts.trash = [{ project: archived, index: 1, deletedAt: new Date().toISOString() }];
  const github = new GitFixture(undefined, posts); globalThis.fetch = github.fetch;
  const snapshot = github.snapshot(), draft = contentDraft(snapshot); draft.posts.trash = [];
  const original = posts.posts[1].images[0].path;
  await persistDraft({ snapshot, draft, pending: new Map(), token: 'fixture', checkpoint: async () => {}, planned: async () => {} });
  assert.equal(github.files()[removed], undefined); assert.ok(github.files()[shared]); assert.ok(github.files()[original]);
  assert.equal(github.data<PostsData>('data/posts.json').trash!.length, 0);
});
test('missing pending images fail validation before any request', async () => {
  const state = setup(); state.draft.site.media!.logo = 'pending:missing';
  await assert.rejects(state.save(), /không hợp lệ/); assert.equal(state.github.calls.length, 0);
});
test('a prepared but unpublished commit survives restart and publishes the same image once', async () => {
  const state = setup(); state.pending.set('pending:photo', photo());
  state.draft.posts.posts[0].images.push({ path: 'pending:photo', alt: '' });
  let plan: SavePlan | undefined;
  await assert.rejects(persistDraft({ snapshot: state.snapshot, draft: state.draft, pending: state.pending, token: 'fixture', checkpoint: async () => {},
    planned: async (next) => { plan = structuredClone(next); state.github.offline = true; },
  }), GitHubError);
  assert.ok(plan); assert.equal(state.github.head, state.snapshot.head);
  const commits = state.github.commits.size; state.github.offline = false;
  const result = await persistDraft({ snapshot: state.snapshot, draft: state.draft, pending: new Map(), token: 'fixture', plan, checkpoint: async () => {}, planned: async () => assert.fail('Reuse the durable plan') });
  assert.equal(result.snapshot.head, plan.commit); assert.equal(state.github.commits.size, commits);
  assert.ok(state.github.files()[result.draft.posts.posts[0].images.at(-1)!.path]);
});
test('reconciling an acknowledged ancestor shows newer admin changes rather than stale data', async () => {
  const state = setup(); state.draft.site.company.name = 'Earlier save'; await state.save();
  const newer = contentDraft(state.plan!.snapshot); newer.site.company.name = 'Later admin save'; state.github.external(newer.site);
  const result = await state.save();
  assert.equal(result.draft.site.company.name, 'Later admin save');
  assert.equal((await readSite()).company.name, 'Later admin save');
  assert.equal(state.github.calls.filter((call) => call.method === 'PATCH').length, 1);
});
test('separate deletes restore the original order regardless of restore order', () => {
  const original = structuredClone(fixturePosts), [a, b] = original.posts;
  const first = moveToTrash(original, original, a.id);
  const deleted = moveToTrash(first, first, b.id);
  for (const order of [[a.id, b.id], [b.id, a.id]]) {
    const result = order.reduce(restoreProject, deleted);
    assert.deepEqual(result.posts.map((post) => post.id), original.posts.map((post) => post.id));
  }
});
test('all deletion/restoration permutations and permanent purges preserve surviving order', () => {
  const original = structuredClone(fixturePosts), ids = original.posts.map((post) => post.id);
  const permutations = (items: string[]): string[][] => !items.length ? [[]] : items.flatMap((id) => permutations(items.filter((item) => item !== id)).map((tail) => [id, ...tail]));
  for (const deletion of permutations(ids)) for (const restoration of permutations(ids)) {
    const deleted = deletion.reduce((data, id) => moveToTrash(data, data, id), original);
    assert.deepEqual(restoration.reduce(restoreProject, deleted).posts.map((post) => post.id), ids);
    for (const purged of ids) {
      const restored = restoration.filter((id) => id !== purged).reduce(restoreProject, purgeProject(deleted, purged));
      assert.deepEqual(restored.posts.map((post) => post.id), ids.filter((id) => id !== purged));
    }
  }
});
