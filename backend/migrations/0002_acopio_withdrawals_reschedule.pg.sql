-- Acopio withdrawals: soporte para reprogramación de entregas
ALTER TABLE acopio_withdrawals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE acopio_withdrawals ADD COLUMN IF NOT EXISTS rescheduled_date TEXT;
