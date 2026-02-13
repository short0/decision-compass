
ALTER TABLE public.decisions 
ADD COLUMN actual_outcome text,
ADD COLUMN outcome_date timestamp with time zone;
