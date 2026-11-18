-- Bounds optional analytics traffic without storing analytics events or installation IDs here.
create table bns_private.usage_limits (
  owner uuid primary key references bns_private.connections on delete cascade,
  events integer not null, expires timestamptz not null
);
alter table bns_private.usage_limits enable row level security;
revoke all on bns_private.usage_limits from public, anon, authenticated;

create or replace function public.bns_analytics_allow(p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (p_payload->>'owner')::uuid;
  v_count integer := (p_payload->>'count')::integer;
  v_total integer;
begin
  if p_action <> 'analytics_allow' or v_count is null or v_count < 1 or v_count > 25 then
    return jsonb_build_object('code','validation');
  end if;
  if not exists(select 1 from bns_private.connections where id=v_owner and last_seen > now()-interval '90 days') then
    return jsonb_build_object('code','auth');
  end if;
  insert into bns_private.usage_limits(owner,events,expires) values(v_owner,v_count,now()+interval '1 hour')
  on conflict(owner) do update set
    events=case when bns_private.usage_limits.expires<=now() then excluded.events else bns_private.usage_limits.events+excluded.events end,
    expires=case when bns_private.usage_limits.expires<=now() then excluded.expires else bns_private.usage_limits.expires end
  returning events into v_total;
  if v_total>1000 then return jsonb_build_object('code','rate_limit'); end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.bns_analytics_allow(text,jsonb) from public, anon, authenticated;
grant execute on function public.bns_analytics_allow(text,jsonb) to service_role;
