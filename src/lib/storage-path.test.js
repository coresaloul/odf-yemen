import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStorageObjectKey } from './storage-path.ts';

test('buildStorageObjectKey sanitizes Arabic names and preserves extension', () => {
  const key = buildStorageObjectKey('4ccddbbd-7722-439c-9475-891330f44671', 'توصيف نظام الموارد البشرية ODF.docx');

  assert.equal(key.startsWith('4ccddbbd-7722-439c-9475-891330f44671/'), true);
  assert.match(key, /\.docx$/i);
  assert.doesNotMatch(key, /[\u0600-\u06FF\s]/u);
});
