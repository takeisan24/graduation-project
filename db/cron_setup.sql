
-- 10. AUTOMATION WITH PG_CRON
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the monthly credit grant job to run every day at midnight (UTC)
-- The function internally checks if 'next_credit_grant_at' has arrived.
-- NOTE: If the job already exists, this might return ID. 
-- You can unschedule first using: SELECT cron.unschedule('process-monthly-credits-daily');
SELECT cron.schedule(
  'process-monthly-credits-daily', -- Job name
  '0 0 * * *',                     -- Cron schedule (Daily at 00:00 UTC)
  'SELECT process_monthly_credit_grants()'
);
