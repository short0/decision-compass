
-- Decisions table
CREATE TABLE public.decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decided', 'reviewed')),
  chosen_option_id UUID,
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Options for each decision
CREATE TABLE public.options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outcomes for each option
CREATE TABLE public.outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.options(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  probability NUMERIC NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  impact NUMERIC NOT NULL DEFAULT 0 CHECK (impact >= -10 AND impact <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Premortem items
CREATE TABLE public.premortems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.options(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premortems ENABLE ROW LEVEL SECURITY;

-- Decisions policies
CREATE POLICY "Users manage own decisions" ON public.decisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Options policies (via decision ownership)
CREATE POLICY "Users manage options on own decisions" ON public.options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.decisions WHERE decisions.id = options.decision_id AND decisions.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decisions WHERE decisions.id = options.decision_id AND decisions.user_id = auth.uid()));

-- Outcomes policies
CREATE POLICY "Users manage outcomes on own decisions" ON public.outcomes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.options o JOIN public.decisions d ON d.id = o.decision_id WHERE o.id = outcomes.option_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.options o JOIN public.decisions d ON d.id = o.decision_id WHERE o.id = outcomes.option_id AND d.user_id = auth.uid()));

-- Premortems policies
CREATE POLICY "Users manage premortems on own decisions" ON public.premortems FOR ALL
  USING (EXISTS (SELECT 1 FROM public.decisions WHERE decisions.id = premortems.decision_id AND decisions.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decisions WHERE decisions.id = premortems.decision_id AND decisions.user_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_decisions_updated_at
  BEFORE UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
