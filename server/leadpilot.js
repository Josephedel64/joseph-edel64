import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, 'data.json');

export const PLAN_LIMITS = {
  free: { leadCap: 10, aiGenerations: 10 },
  starter: { leadCap: 250, aiGenerations: 300 },
  pro: { leadCap: 1000, aiGenerations: 2000 }
};

export const demoTemplates = [
  {
    id: 'template-checkin',
    name: 'Quick check-in',
    timingHours: 48,
    subject: 'Quick follow-up for {company}',
    body: 'Hi {name},\n\nI hope your team is well. I wanted to follow up on the website project we discussed for {company}. I can send a tailored proposal and suggested launch plan if helpful.\n\nWould it be worth scheduling a 15-minute call this week?\n\nBest,\n{owner}'
  },
  {
    id: 'template-value',
    name: 'Value add',
    timingHours: 72,
    subject: 'A simple idea for {company}',
    body: 'Hi {name},\n\nI reviewed your current digital presence and noticed a few opportunities to strengthen conversion and trust signals for {company}. I would be happy to share a few ideas and a suggested roadmap for the next 30 days.\n\nIf this would be helpful, I can send a short overview for review.\n\nBest,\n{owner}'
  },
  {
    id: 'template-close',
    name: 'Conversion close',
    timingHours: 120,
    subject: 'Would a quick proposal help?',
    body: 'Hi {name},\n\nI know your team is busy, so I wanted to keep this simple: I can prepare a focused proposal for {company} that outlines the strategy, timeline, and pricing for a high-converting web refresh.\n\nIf useful, I can share a no-pressure draft by the end of the week.\n\nBest,\n{owner}'
  }
];

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password ?? '')).digest('hex');
}

export function sanitizeLeadInput(lead) {
  return {
    name: String(lead?.name ?? '').trim(),
    company: String(lead?.company ?? '').trim(),
    email: normalizeEmail(lead?.email),
    source: String(lead?.source ?? 'Website').trim(),
    status: String(lead?.status ?? 'New lead').trim(),
    notes: String(lead?.notes ?? '').trim(),
    lastContact: String(lead?.lastContact ?? '').trim(),
    nextFollowUp: String(lead?.nextFollowUp ?? '').trim(),
    owner: String(lead?.owner ?? 'Demo owner').trim(),
    optedOut: Boolean(lead?.optedOut),
    conversationCount: Number(lead?.conversationCount ?? 0),
    lastReply: String(lead?.lastReply ?? '').trim()
  };
}

export function validateLeadInput(lead) {
  const cleaned = sanitizeLeadInput(lead);
  const errors = [];

  if (!cleaned.name) errors.push('Name is required.');
  if (!cleaned.company) errors.push('Company is required.');
  if (!cleaned.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
    errors.push('A valid email is required.');
  }
  if (!cleaned.owner) errors.push('Owner is required.');

  return { valid: errors.length === 0, errors, cleaned };
}

export function parseCsvImport(csvText) {
  const text = String(csvText ?? '').trim();
  if (!text) return [];

  const rows = text.split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];

  const headers = rows[0].split(',').map((header) => header.trim().toLowerCase());
  const records = rows.slice(1).map((row) => {
    const values = row.split(',').map((cell) => cell.trim());
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return {
      name: record.name || 'Imported lead',
      company: record.company || 'Unknown company',
      email: normalizeEmail(record.email),
      source: record.source || 'Imported CSV',
      status: record.status || 'New lead',
      notes: record.notes || '',
      lastContact: record.lastcontact || '',
      nextFollowUp: record.nextfollowup || '',
      owner: record.owner || 'Demo owner',
      optedOut: /true|yes|opted out/i.test(String(record.optedout || ''))
    };
  });

  return records.filter((record) => record.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email));
}

export function generateMockEmailDraft(lead, tone = 'professional') {
  const name = lead?.name || 'there';
  const company = lead?.company || 'your business';
  const owner = lead?.owner || 'Your team';
  const greeting = tone === 'friendly' ? 'Hi' : 'Hello';

  return `${greeting} ${name},\n\nI hope you're doing well. I wanted to follow up on our earlier conversation about ${company}. We can help create a clearer, more conversion-focused digital experience that supports lead generation and keeps your pipeline moving.\n\nIf it's helpful, I can share a brief recommendation and a proposed next-step plan tailored to your goals.\n\nBest,\n${owner}`;
}

export function createTaskFromTemplate(lead, template) {
  const fromDate = new Date();
  const dueAt = new Date(fromDate.getTime() + Number(template?.timingHours || 48) * 60 * 60 * 1000);

  return {
    id: `task-${crypto.randomUUID()}`,
    leadId: lead.id,
    leadName: lead.name,
    templateId: template?.id || 'default',
    templateName: template?.name || 'Follow-up',
    dueAt: dueAt.toISOString(),
    status: 'pending',
    attempts: 0,
    retriesRemaining: 2,
    approvalState: 'pending',
    message: template?.body || 'Follow up with the contact.'
  };
}

export function calculateLeadMetrics(leads = []) {
  return {
    total: leads.length,
    newLeads: leads.filter((lead) => lead.status === 'New lead').length,
    qualified: leads.filter((lead) => lead.status === 'Qualified').length,
    inProgress: leads.filter((lead) => lead.status === 'Contacted' || lead.status === 'Proposal').length,
    optedOut: leads.filter((lead) => lead.optedOut).length
  };
}

export function getPlanLimit(plan = 'free') {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export function validatePlanUsage(plan, usage = {}) {
  const limit = getPlanLimit(plan);
  const current = Number(usage.aiGenerations ?? 0);
  const nextCount = current + 1;

  if (nextCount > limit.aiGenerations) {
    return {
      ok: false,
      error: `Your ${plan} plan limit has been reached. Upgrade to continue generating AI follow-ups.`
    };
  }

  return { ok: true, nextCount };
}

export function defaultDemoUser() {
  return {
    id: 'user-demo',
    name: 'Demo Agency',
    email: 'demo@leadpilot.ai',
    passwordHash: hashPassword('password123'),
    plan: 'free',
    usage: { aiGenerations: 4, month: new Date().toISOString().slice(0, 7) },
    createdAt: new Date().toISOString()
  };
}

export function defaultDemoLeads() {
  return [
    {
      id: 'lead-1',
      name: 'Maya Chen',
      company: 'Northstar Studio',
      email: 'maya@northstarstudio.co',
      source: 'Website',
      status: 'New lead',
      notes: 'Interested in a full site refresh and integrated booking funnel.',
      lastContact: '2026-10-12',
      nextFollowUp: '2026-10-26',
      owner: 'Ava',
      optedOut: false,
      conversationCount: 2,
      lastReply: '2026-10-17',
      ownerId: 'user-demo'
    },
    {
      id: 'lead-2',
      name: 'Chris Price',
      company: 'Horizon Labs',
      email: 'chris@horizonlabs.io',
      source: 'LinkedIn',
      status: 'Contacted',
      notes: 'Requested a proposal for brand refresh and lead capture pages.',
      lastContact: '2026-10-15',
      nextFollowUp: '2026-10-24',
      owner: 'Ava',
      optedOut: false,
      conversationCount: 3,
      lastReply: '2026-10-18',
      ownerId: 'user-demo'
    },
    {
      id: 'lead-3',
      name: 'Olivia Grant',
      company: 'Sage & Pine',
      email: 'olivia@sagepine.com',
      source: 'Referral',
      status: 'Qualified',
      notes: 'Budget approved, wants a landing page plus CRM workflow.',
      lastContact: '2026-10-20',
      nextFollowUp: '2026-10-28',
      owner: 'Leo',
      optedOut: false,
      conversationCount: 5,
      lastReply: '2026-10-21',
      ownerId: 'user-demo'
    },
    {
      id: 'lead-4',
      name: 'Alicia Moore',
      company: 'Folio & Co.',
      email: 'alicia@folioandco.dev',
      source: 'Outbound',
      status: 'Proposal',
      notes: 'Waiting on proposal review and approval.',
      lastContact: '2026-10-19',
      nextFollowUp: '2026-10-30',
      owner: 'Leo',
      optedOut: false,
      conversationCount: 3,
      lastReply: '2026-10-21',
      ownerId: 'user-demo'
    },
    {
      id: 'lead-5',
      name: 'Daniel Woods',
      company: 'Futureframe',
      email: 'daniel@futureframe.ai',
      source: 'Campaign',
      status: 'Lost',
      notes: 'Opted out after a previous sequence; keep on suppression list.',
      lastContact: '2026-09-06',
      nextFollowUp: '',
      owner: 'Ava',
      optedOut: true,
      conversationCount: 1,
      lastReply: '2026-09-06',
      ownerId: 'user-demo'
    }
  ];
}

export function defaultDemoTasks() {
  return [
    {
      id: 'task-1',
      leadId: 'lead-2',
      leadName: 'Chris Price',
      templateId: 'template-checkin',
      templateName: 'Quick check-in',
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      attempts: 0,
      retriesRemaining: 2,
      approvalState: 'pending',
      message: 'Follow up with Chris about the website project budget and timeline.'
    },
    {
      id: 'task-2',
      leadId: 'lead-1',
      leadName: 'Maya Chen',
      templateId: 'template-value',
      templateName: 'Value add',
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      status: 'sent',
      attempts: 1,
      retriesRemaining: 2,
      approvalState: 'approved',
      message: 'Share a shortlist of conversion ideas and pricing options.'
    }
  ];
}

export function defaultDemoMessages() {
  return [
    { id: 'msg-1', leadId: 'lead-2', type: 'email', content: 'I wanted to follow up on the new site direction for Horizon Labs.', sentAt: '2026-10-19T14:00:00.000Z' },
    { id: 'msg-2', leadId: 'lead-1', type: 'note', content: 'Client asked for a mobile-first landing page with stronger trust indicators.', sentAt: '2026-10-18T08:30:00.000Z' }
  ];
}

export function defaultDemoActivity() {
  return [
    { id: 'activity-1', type: 'lead', description: 'New lead created for Northstar Studio', at: '2026-10-22T08:15:00.000Z' },
    { id: 'activity-2', type: 'ai', description: 'AI draft created for Chris Price using Quick check-in template', at: '2026-10-22T09:10:00.000Z' },
    { id: 'activity-3', type: 'task', description: 'Follow-up task scheduled for Maya Chen', at: '2026-10-22T11:00:00.000Z' }
  ];
}

export function createDefaultStore() {
  const user = defaultDemoUser();
  return {
    users: [user],
    sessions: [],
    leads: defaultDemoLeads(),
    tasks: defaultDemoTasks(),
    messages: defaultDemoMessages(),
    activity: defaultDemoActivity(),
    templates: demoTemplates
  };
}

export async function readStore(filePath = DATA_PATH) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    const store = createDefaultStore();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
    return store;
  }
}

export async function writeStore(store, filePath = DATA_PATH) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
}
