CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  usage JSONB NOT NULL DEFAULT '{"aiGenerations": 0, "month": "2026-01"}'::jsonb
);

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'New lead',
  notes TEXT,
  last_contact DATE,
  next_follow_up DATE,
  owner TEXT,
  opted_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  timing_hours INTEGER NOT NULL DEFAULT 72,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.follow_up_templates(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  approval_state TEXT NOT NULL DEFAULT 'pending',
  retries_remaining INTEGER NOT NULL DEFAULT 2,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  message_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leads" ON public.leads
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own leads" ON public.leads
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view their own templates" ON public.follow_up_templates
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can manage their own tasks" ON public.follow_up_tasks
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Users can manage their own message history" ON public.message_history
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Users can view their own activity" ON public.activity_log
  FOR SELECT USING (owner_id = auth.uid());

CREATE INDEX leads_owner_idx ON public.leads(owner_id);
CREATE INDEX tasks_owner_idx ON public.follow_up_tasks(owner_id);
CREATE INDEX tasks_due_at_idx ON public.follow_up_tasks(due_at);
