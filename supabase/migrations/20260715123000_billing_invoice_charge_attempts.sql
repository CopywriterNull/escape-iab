alter table billing_invoices
  add column if not exists charge_attempts integer not null default 0;
