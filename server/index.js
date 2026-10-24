import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { readStore, writeStore, hashPassword, validateLeadInput, parseCsvImport, generateMockEmailDraft, createTaskFromTemplate, validatePlanUsage, demoTemplates, calculateLeadMetrics, PLAN_LIMITS } from './leadpilot.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getStore() {
  return readStore();
}

async function saveStore(store) {
  await writeStore(store);
}

function getUserFromToken(store, token) {
  if (!token) return null;
  const session = store.sessions.find((entry) => entry.token === token);
  return store.users.find((user) => user.id === session?.userId) || null;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  getStore().then((store) => {
    const user = getUserFromToken(store, token);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.user = user;
    next();
  }).catch((error) => {
    res.status(500).json({ error: error.message });
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'LeadPilot AI API is running in demo mode.' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, plan = 'free' } = req.body || {};
    const store = await getStore();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cleanedName = String(name || '').trim();

    if (!cleanedName || !normalizedEmail || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Name, email, and password (6+ chars) are required.' });
    }

    if (store.users.some((user) => user.email === normalizedEmail)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const user = {
      id: crypto.randomUUID(),
      name: cleanedName,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      plan,
      usage: { aiGenerations: 0, month: new Date().toISOString().slice(0, 7) },
      createdAt: new Date().toISOString()
    };

    const token = makeToken();
    store.users.push(user);
    store.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    await saveStore(store);
    res.status(201).json({ token, user: { ...user, passwordHash: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const store = await getStore();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = store.users.find((entry) => entry.email === normalizedEmail && entry.passwordHash === hashPassword(password || ''));

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = makeToken();
    store.sessions = store.sessions.filter((session) => session.userId !== user.id);
    store.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    await saveStore(store);

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan, usage: user.usage } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to sign in.' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, plan: req.user.plan, usage: req.user.usage } });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const store = await getStore();
    const userLeads = store.leads.filter((lead) => lead.ownerId === req.user.id);
    const userTasks = store.tasks.filter((task) => userLeads.some((lead) => lead.id === task.leadId));
    const plans = Object.keys(PLAN_LIMITS);

    res.json({
      user: { id: req.user.id, name: req.user.name, email: req.user.email, plan: req.user.plan, usage: req.user.usage },
      leads: userLeads,
      tasks: userTasks,
      templates: store.templates,
      metrics: calculateLeadMetrics(userLeads),
      planOptions: plans,
      quota: PLAN_LIMITS[req.user.plan || 'free']
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load dashboard.' });
  }
});

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const store = await getStore();
    const userLeads = store.leads.filter((lead) => lead.ownerId === req.user.id);
    res.json({ leads: userLeads });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load leads.' });
  }
});

app.post('/api/leads', requireAuth, async (req, res) => {
  try {
    const store = await getStore();
    const payload = req.body || {};
    const { valid, errors, cleaned } = validateLeadInput(payload);
    if (!valid) return res.status(400).json({ error: errors[0] || 'Invalid lead.' });

    const lead = {
      id: payload.id || crypto.randomUUID(),
      ...cleaned,
      ownerId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingIndex = store.leads.findIndex((item) => item.id === lead.id);
    if (existingIndex >= 0) {
      store.leads[existingIndex] = { ...store.leads[existingIndex], ...lead, updatedAt: new Date().toISOString() };
    } else {
      const planLimit = PLAN_LIMITS[req.user.plan || 'free'];
      if (store.leads.filter((item) => item.ownerId === req.user.id).length >= planLimit.leadCap) {
        return res.status(403).json({ error: `The ${req.user.plan} plan limit of ${planLimit.leadCap} leads has been reached.` });
      }
      store.leads.push(lead);
    }

    store.activity.unshift({
      id: crypto.randomUUID(),
      type: 'lead',
      description: `Lead ${lead.name} was ${existingIndex >= 0 ? 'updated' : 'created'} for ${lead.company}.`,
      at: new Date().toISOString()
    });

    await saveStore(store);
    res.status(existingIndex >= 0 ? 200 : 201).json({ lead });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to save lead.' });
  }
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const store = await getStore();
    const leadIndex = store.leads.findIndex((lead) => lead.id === req.params.id && lead.ownerId === req.user.id);
    if (leadIndex < 0) return res.status(404).json({ error: 'Lead not found.' });
    const [removed] = store.leads.splice(leadIndex, 1);
    store.tasks = store.tasks.filter((task) => task.leadId !== removed.id);
    store.activity.unshift({
      id: crypto.randomUUID(),
      type: 'lead',
      description: `Lead ${removed.name} was removed.`,
      at: new Date().toISOString()
    });
    await saveStore(store);
    res.json({ ok: true, removedId: removed.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to delete lead.' });
  }
});

app.post('/api/leads/import', requireAuth, async (req, res) => {
  try {
    const { csv } = req.body || {};
    const records = parseCsvImport(csv);
    if (!records.length) return res.status(400).json({ error: 'No valid CSV contacts were found.' });

    const store = await getStore();
    const imported = [];
    for (const record of records) {
      const simple = { ...record, ownerId: req.user.id, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const planLimit = PLAN_LIMITS[req.user.plan || 'free'];
      if (store.leads.filter((lead) => lead.ownerId === req.user.id).length + imported.length >= planLimit.leadCap) {
        break;
      }
      const { valid } = validateLeadInput(simple);
      if (!valid) continue;
      imported.push(simple);
    }

    store.leads.push(...imported);
    await saveStore(store);
    res.status(201).json({ imported, count: imported.length });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to import leads.' });
  }
});

app.get('/api/templates', requireAuth, async (req, res) => {
  const store = await getStore();
  res.json({ templates: store.templates || demoTemplates });
});

app.get('/api/tasks', requireAuth, async (req, res) => {
  const store = await getStore();
  const userLeads = new Set(store.leads.filter((lead) => lead.ownerId === req.user.id).map((lead) => lead.id));
  const tasks = store.tasks.filter((task) => userLeads.has(task.leadId));
  res.json({ tasks });
});

app.post('/api/tasks/:id/approve', requireAuth, async (req, res) => {
  const store = await getStore();
  const task = store.tasks.find((entry) => entry.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  task.approvalState = 'approved';
  task.status = 'approved';
  store.activity.unshift({
    id: crypto.randomUUID(),
    type: 'task',
    description: `Follow-up task for ${task.leadName} was approved for send.`,
    at: new Date().toISOString()
  });

  await saveStore(store);
  res.json({ task });
});

app.post('/api/tasks/:id/retry', requireAuth, async (req, res) => {
  const store = await getStore();
  const task = store.tasks.find((entry) => entry.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  task.attempts += 1;
  task.retriesRemaining = Math.max(0, task.retriesRemaining - 1);
  task.status = task.retriesRemaining > 0 ? 'retrying' : 'failed';
  task.approvalState = 'pending';

  if (task.status === 'failed') {
    task.error = 'No retries remaining for this task.';
  }

  await saveStore(store);
  res.json({ task });
});

app.post('/api/ai/generate', requireAuth, async (req, res) => {
  try {
    const { leadId, tone = 'professional' } = req.body || {};
    const store = await getStore();
    const lead = store.leads.find((entry) => entry.id === leadId && entry.ownerId === req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    if (lead.optedOut) return res.status(400).json({ error: 'This contact has opted out and cannot receive messages.' });

    const currentPlan = req.user.plan || 'free';
    const usage = req.user.usage || { aiGenerations: 0, month: new Date().toISOString().slice(0, 7) };
    const quota = validatePlanUsage(currentPlan, usage);
    if (!quota.ok) return res.status(403).json({ error: quota.error });

    const draft = generateMockEmailDraft(lead, tone);
    const task = createTaskFromTemplate(lead, store.templates[0]);

    req.user.usage = { ...usage, aiGenerations: quota.nextCount, month: new Date().toISOString().slice(0, 7) };
    const storedUser = store.users.find((user) => user.id === req.user.id);
    if (storedUser) storedUser.usage = req.user.usage;

    store.tasks.unshift(task);
    store.messages.unshift({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: 'draft',
      content: draft,
      sentAt: new Date().toISOString()
    });
    store.activity.unshift({
      id: crypto.randomUUID(),
      type: 'ai',
      description: `AI follow-up draft created for ${lead.name}.`,
      at: new Date().toISOString()
    });

    await saveStore(store);
    res.json({ draft, task, usage: req.user.usage });
  } catch (error) {
    res.status(500).json({ error: error.message || 'AI generation failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`LeadPilot AI API listening on http://localhost:${PORT}`);
});
