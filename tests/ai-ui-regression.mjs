import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'app.js'), 'utf8');
const start = source.indexOf('function clearAiDraftPreview');
const end = source.indexOf('\nfunction fillFromAiDraft', start);
assert.notEqual(start, -1, 'clearAiDraftPreview must exist');
assert.notEqual(end, -1, 'clearAiDraftPreview boundary must remain discoverable');

const elements = {
  aiDraftPanel: { hidden: false, innerHTML: '<static-draft-controls />' },
  analysisResult: { hidden: false },
  aiAccountingStatus: { textContent: '', className: '' },
};
const context = {
  aiDraft: { data: { intent: 'order' } },
  byId: id => elements[id] || null,
  clearPendingAction: () => {},
};
vm.runInNewContext(`${source.slice(start, end)};clearAiDraftPreview`, context);

context.clearAiDraftPreview('已填入表单，请核对后保存。');
assert.equal(elements.aiDraftPanel.hidden, true, 'draft panel should be hidden after filling');
assert.equal(elements.aiDraftPanel.innerHTML, '<static-draft-controls />', 'draft controls must remain mounted for the next AI draft');
assert.equal(elements.analysisResult.hidden, true, 'analysis result should be hidden');
assert.equal(elements.aiAccountingStatus.className, 'ai-status success', 'status should report a successful fill');

console.log('AI UI regression tests passed');
