-- Run as the project owner after the main migration, once per project.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('bns-hourly-cleanup','13 * * * *','select public.bns_cleanup();');
