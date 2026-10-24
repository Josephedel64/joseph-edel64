import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLeadInput, parseCsvImport, generateMockEmailDraft, validatePlanUsage, createTaskFromTemplate, defaultDemoLeads } from './leadpilot.js';

test('validateLeadInput accepts valid lead data', () => {
  const result = validateLeadInput({
    name: 'Ava Thompson',
    company: 'Northstar Studio',
    email: 'ava@northstarstudio.co',
    owner: 'Ops team'
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateLeadInput rejects invalid lead email', () => {
  const result = validateLeadInput({
    name: 'Ava Thompson',
    company: 'Northstar Studio',
    email: 'not-an-email',
    owner: 'Ops team'
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('valid email')));
});

test('parseCsvImport converts CSV rows into lead records', () => {
  const records = parseCsvImport('name,company,email,source\nJohn Doe,Acme,hello@acme.com,Website');

  assert.equal(records.length, 1);
  assert.equal(records[0].company, 'Acme');
  assert.equal(records[0].email, 'hello@acme.com');
});

test('generateMockEmailDraft includes lead context and sender details', () => {
  const draft = generateMockEmailDraft({ name: 'Maya', company: 'Northstar Studio', owner: 'Ava' });

  assert.match(draft, /Maya/);
  assert.match(draft, /Northstar Studio/);
  assert.match(draft, /Ava/);
});

test('validatePlanUsage enforces free tier AI limits', () => {
  const result = validatePlanUsage('free', { aiGenerations: 10 });
  assert.equal(result.ok, false);
  assert.match(result.error, /limit/i);
});

test('createTaskFromTemplate creates due date and template metadata', () => {
  const lead = defaultDemoLeads()[0];
  const task = createTaskFromTemplate(lead, { id: 'template-checkin', name: 'Quick check-in', timingHours: 72 });

  assert.equal(task.leadId, lead.id);
  assert.equal(task.templateName, 'Quick check-in');
  assert.ok(task.dueAt);
});
