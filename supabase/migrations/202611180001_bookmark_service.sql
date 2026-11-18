-- Service-only data: extension clients never receive a database key or table access.
create schema if not exists bns_private;
revoke all on schema bns_private from public, anon, authenticated;

create table bns_private.connections (
  id uuid primary key default gen_random_uuid(), session_hash text unique,
  encrypted_tokens text not null, workspace_id text not null, workspace_name text not null,
  last_seen timestamptz not null default now(), token_version integer not null default 1,
  refresh_lock uuid, refresh_until timestamptz, next_request_at timestamptz not null default now()
);
create index bns_connections_expiry on bns_private.connections(last_seen);
create table bns_private.flows (
  state_hash text primary key, challenge text not null, expires timestamptz not null,
  phase text not null default 'pending' check (phase in ('pending','exchanging','ready')),
  existing_connection_id uuid references bns_private.connections on delete cascade,
  connection_id uuid references bns_private.connections on delete cascade,
  ticket_hash text unique
);
create index bns_flows_expiry on bns_private.flows(expires);
create table bns_private.operations (
  owner uuid not null references bns_private.connections on delete cascade,
  operation_id uuid not null, resource_key text not null,
  state text not null check (state in ('writing','uncertain','rejected','saved','duplicate')),
  page_id text, page_url text, confirmed boolean not null default false,
  updated_at timestamptz not null default now(), primary key(owner,operation_id)
);
create index bns_operations_resource on bns_private.operations(resource_key);
create table bns_private.save_locks (
  resource_key text primary key, owner uuid not null references bns_private.connections on delete cascade,
  lock_id uuid not null, expires timestamptz not null
);
create table bns_private.auth_limits (
  client_hash text primary key, attempts integer not null, expires timestamptz not null
);
create index bns_auth_limits_expiry on bns_private.auth_limits(expires);

alter table bns_private.connections enable row level security;
alter table bns_private.flows enable row level security;
alter table bns_private.operations enable row level security;
alter table bns_private.save_locks enable row level security;
alter table bns_private.auth_limits enable row level security;
revoke all on all tables in schema bns_private from public, anon, authenticated;

create or replace function public.bns_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from bns_private.flows where expires <= now();
  delete from bns_private.auth_limits where expires <= now();
  delete from bns_private.save_locks where expires <= now();
  delete from bns_private.connections where last_seen <= now() - interval '90 days';
end;
$$;

-- Each call is a database transaction. Claims survive Edge Function/isolate restarts.
create or replace function public.bns_service(p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c bns_private.connections%rowtype;
  f bns_private.flows%rowtype;
  o bns_private.operations%rowtype;
  v_owner uuid := nullif(p_payload->>'owner','')::uuid;
  v_operation uuid := nullif(p_payload->>'operation_id','')::uuid;
  v_resource text := p_payload->>'resource_key';
  v_lock uuid := nullif(p_payload->>'lock_id','')::uuid;
  v_count integer;
begin
  if p_action = 'health' then return jsonb_build_object('ok',true); end if;
  if p_action = 'start_flow' then
    delete from bns_private.auth_limits where expires <= now();
    delete from bns_private.flows where expires <= now();
    -- Serialize global admission without holding a lock during external OAuth calls.
    perform pg_advisory_xact_lock(1824318);
    insert into bns_private.auth_limits(client_hash,attempts,expires)
      values(p_payload->>'client_hash',1,now()+interval '10 minutes')
      on conflict(client_hash) do update set attempts=bns_private.auth_limits.attempts+1
      returning attempts into v_count;
    if v_count > 20 then return jsonb_build_object('code','rate_limit'); end if;
    if (select count(*) from bns_private.flows) >= 2000 then return jsonb_build_object('code','busy'); end if;
    select * into c from bns_private.connections where session_hash=p_payload->>'session_hash' and last_seen>now()-interval '90 days';
    insert into bns_private.flows(state_hash,challenge,expires,existing_connection_id)
      values(p_payload->>'state_hash',p_payload->>'challenge',now()+interval '10 minutes',c.id);
    return jsonb_build_object('ok',true);
  end if;
  if p_action = 'claim_flow' then
    update bns_private.flows set phase='exchanging'
      where state_hash=p_payload->>'state_hash' and phase='pending' and expires>now() returning * into f;
    if not found then return jsonb_build_object('code','expired'); end if;
    if (p_payload->>'denied')::boolean then delete from bns_private.flows where state_hash=f.state_hash; end if;
    return jsonb_build_object('ok',true);
  end if;
  if p_action = 'complete_flow' then
    select * into f from bns_private.flows where state_hash=p_payload->>'state_hash' and phase='exchanging' and expires>now() for update;
    if not found then return jsonb_build_object('code','expired'); end if;
    select * into c from bns_private.connections where id=f.existing_connection_id and workspace_id=p_payload->>'workspace_id';
    if c.id is null then
      insert into bns_private.connections(encrypted_tokens,workspace_id,workspace_name)
        values(p_payload->>'encrypted_tokens',p_payload->>'workspace_id',p_payload->>'workspace_name') returning * into c;
    else
      update bns_private.connections set encrypted_tokens=p_payload->>'encrypted_tokens', workspace_name=p_payload->>'workspace_name',
        token_version=token_version+1, refresh_lock=null, refresh_until=null, last_seen=now() where id=c.id returning * into c;
    end if;
    update bns_private.flows set phase='ready',connection_id=c.id,ticket_hash=p_payload->>'ticket_hash',expires=now()+interval '5 minutes' where state_hash=f.state_hash;
    return jsonb_build_object('ok',true);
  end if;
  if p_action = 'exchange_ticket' then
    select * into f from bns_private.flows where ticket_hash=p_payload->>'ticket_hash' and phase='ready' and expires>now() and challenge=p_payload->>'challenge' for update;
    if not found then return jsonb_build_object('code','expired'); end if;
    update bns_private.connections set session_hash=p_payload->>'session_hash',last_seen=now() where id=f.connection_id returning * into c;
    delete from bns_private.flows where state_hash=f.state_hash;
    return jsonb_build_object('workspace_id',c.workspace_id,'workspace_name',c.workspace_name);
  end if;
  if p_action = 'authenticate' then
    update bns_private.connections set last_seen=now() where session_hash=p_payload->>'session_hash' and last_seen>now()-interval '90 days' returning * into c;
    if not found then return jsonb_build_object('code','auth'); end if;
    return to_jsonb(c);
  end if;

  select * into c from bns_private.connections where id=v_owner and last_seen>now()-interval '90 days';
  if not found then return jsonb_build_object('code','auth'); end if;
  case p_action
    when 'reserve_notion' then
      select * into c from bns_private.connections where id=v_owner for update;
      v_count := greatest(0,ceil(extract(epoch from(c.next_request_at-clock_timestamp()))*1000)::integer);
      if v_count>4000 then return jsonb_build_object('code','busy'); end if;
      update bns_private.connections set next_request_at=greatest(clock_timestamp(),next_request_at)+interval '400 milliseconds' where id=v_owner;
      return jsonb_build_object('delay',v_count);
    when 'disconnect' then
      delete from bns_private.connections where id=v_owner;
      return jsonb_build_object('ok',true);
    when 'claim_refresh' then
      select * into c from bns_private.connections where id=v_owner for update;
      if c.token_version<>(p_payload->>'token_version')::integer then return jsonb_build_object('claimed',false,'connection',to_jsonb(c)); end if;
      if c.refresh_until>now() then return jsonb_build_object('code','busy'); end if;
      update bns_private.connections set refresh_lock=v_lock,refresh_until=now()+interval '45 seconds' where id=v_owner returning * into c;
      return jsonb_build_object('claimed',true,'connection',to_jsonb(c));
    when 'complete_refresh' then
      update bns_private.connections set encrypted_tokens=p_payload->>'encrypted_tokens',token_version=token_version+1,refresh_lock=null,refresh_until=null
        where id=v_owner and refresh_lock=v_lock returning * into c;
      if not found then select * into c from bns_private.connections where id=v_owner; end if;
      return to_jsonb(c);
    when 'release_refresh' then
      update bns_private.connections set refresh_lock=null,refresh_until=null where id=v_owner and refresh_lock=v_lock;
      return jsonb_build_object('ok',true);
    when 'operation' then
      select * into o from bns_private.operations where owner=v_owner and operation_id=v_operation;
      if o.resource_key is not null and o.resource_key<>v_resource then return jsonb_build_object('code','validation'); end if;
      return jsonb_build_object('operation',case when o.owner is null then null else to_jsonb(o) end);
    when 'acquire_save' then
      delete from bns_private.save_locks where resource_key=v_resource and expires<=now();
      insert into bns_private.save_locks(resource_key,owner,lock_id,expires) values(v_resource,v_owner,v_lock,now()+interval '90 seconds') on conflict do nothing;
      if not found then return jsonb_build_object('code','busy'); end if;
      return jsonb_build_object('ok',true);
    when 'release_save' then
      delete from bns_private.save_locks where resource_key=v_resource and owner=v_owner and lock_id=v_lock;
      return jsonb_build_object('ok',true);
    when 'begin_write' then
      if not exists(select 1 from bns_private.save_locks where resource_key=v_resource and owner=v_owner and lock_id=v_lock and expires>now()) then return jsonb_build_object('code','busy'); end if;
      select * into o from bns_private.operations where owner=v_owner and operation_id=v_operation;
      if o.owner is not null and o.resource_key<>v_resource then return jsonb_build_object('code','validation'); end if;
      if o.state in ('saved','duplicate') then return jsonb_build_object('operation',to_jsonb(o)); end if;
      if exists(select 1 from bns_private.operations where resource_key=v_resource and (state in ('writing','uncertain') or (state in ('saved','duplicate') and not confirmed))) then return jsonb_build_object('code','uncertain'); end if;
      insert into bns_private.operations(owner,operation_id,resource_key,state) values(v_owner,v_operation,v_resource,'writing')
        on conflict(owner,operation_id) do update set state='writing',updated_at=now();
      return jsonb_build_object('operation',null);
    when 'finish_save' then
      if not exists(select 1 from bns_private.save_locks where resource_key=v_resource and owner=v_owner and lock_id=v_lock) then return jsonb_build_object('code','busy'); end if;
      if p_payload->>'state' not in ('saved','duplicate') then return jsonb_build_object('code','validation'); end if;
      if exists(select 1 from bns_private.operations where owner=v_owner and operation_id=v_operation and resource_key<>v_resource) then return jsonb_build_object('code','validation'); end if;
      insert into bns_private.operations(owner,operation_id,resource_key,state,page_id,page_url,confirmed)
        values(v_owner,v_operation,v_resource,p_payload->>'state',p_payload->>'page_id',p_payload->>'page_url',(p_payload->>'confirmed')::boolean)
        on conflict(owner,operation_id) do update set state=excluded.state,page_id=excluded.page_id,page_url=excluded.page_url,confirmed=excluded.confirmed,updated_at=now();
      if (p_payload->>'confirmed')::boolean then
        update bns_private.operations set confirmed=true, page_id=p_payload->>'page_id',page_url=p_payload->>'page_url',
          state=case when state in ('writing','uncertain') then 'saved' else state end where resource_key=v_resource and state in ('writing','uncertain','saved','duplicate');
      end if;
      return jsonb_build_object('ok',true);
    when 'fail_write' then
      if p_payload->>'state' not in ('rejected','uncertain') then return jsonb_build_object('code','validation'); end if;
      update bns_private.operations set state=p_payload->>'state',updated_at=now() where owner=v_owner and operation_id=v_operation and resource_key=v_resource and state='writing';
      return jsonb_build_object('ok',true);
    else return jsonb_build_object('code','validation');
  end case;
end;
$$;
revoke all on function public.bns_service(text,jsonb) from public,anon,authenticated;
revoke all on function public.bns_cleanup() from public,anon,authenticated;
grant execute on function public.bns_service(text,jsonb) to service_role;
grant execute on function public.bns_cleanup() to service_role;
