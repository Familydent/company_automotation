begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null default 'staff' check(role in ('marketer','leadership','staff','doctor','it')),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create function private.role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and active;
$$;
create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$ select private.role() is not null $$;
create function public.can_manage() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role() in ('marketer','leadership'),false) $$;
create function public.is_leader() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role()='leadership',false) $$;
create function public.can_connect() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role() in ('marketer','leadership','it'),false) $$;
revoke all on function public.is_member(),public.can_manage(),public.is_leader(),public.can_connect() from public;
grant execute on function public.is_member(),public.can_manage(),public.is_leader(),public.can_connect() to authenticated;

create table public.directions (
 id uuid primary key default gen_random_uuid(), name text not null, short_name text not null,
 color text not null check(color ~ '^#[0-9a-fA-F]{6}$'), description text not null default '', archived boolean not null default false
);
create table public.branches (id uuid primary key default gen_random_uuid(),name text not null unique,archived boolean not null default false);
create table public.categories (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('source','expense','service','format','partner')),
 name text not null,archived boolean not null default false,unique(kind,name)
);
create table public.goals (
 id uuid primary key default gen_random_uuid(),direction_id uuid references public.directions(id),
 title text not null,channel text not null default '',target text not null default '',due_date date,
 status text not null default 'planned' check(status in ('planned','doing','done')),created_by uuid not null default auth.uid() references public.profiles(id)
);
create table public.content_plans (
 id uuid primary key default gen_random_uuid(),title text not null,starts_on date not null,ends_on date not null,
 created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),check(ends_on>=starts_on)
);
create table public.social_accounts (
 id uuid primary key default gen_random_uuid(),direction_id uuid references public.directions(id),
 platform text not null check(platform in ('instagram','facebook')),handle text not null,url text not null,
 external_id text,connection_status text not null default 'not_connected',last_synced_at timestamptz,archived boolean not null default false,
 unique(platform,handle)
);
create table public.doctors (
 id uuid primary key default gen_random_uuid(),name text not null,specialty text not null default '',
 branch_id uuid references public.branches(id),monthly_target integer not null default 2 check(monthly_target>=0),
 profile_id uuid references public.profiles(id),archived boolean not null default false
);
create table public.content_items (
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.content_plans(id),
 direction_id uuid not null references public.directions(id),title text not null,format text not null default 'Рилс',
 objective text not null default '',language text not null default 'RU',body text not null default '',
 asset_url text not null default '',publish_at timestamptz,assignee_id uuid references public.profiles(id),
 status text not null default 'idea' check(status in ('idea','planned','doing','ready','scheduled','published')),
 created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.content_doctors(content_id uuid references public.content_items(id) on delete cascade,doctor_id uuid references public.doctors(id),primary key(content_id,doctor_id));
create table public.plan_approvals (
 plan_id uuid references public.content_plans(id) on delete cascade, reviewer_id uuid not null default auth.uid() references public.profiles(id),
 decision text not null check(decision in ('approved','rejected')),comment text not null default '',created_at timestamptz not null default now(),primary key(plan_id,reviewer_id)
);
create table public.medical_reviews (
 content_id uuid references public.content_items(id) on delete cascade,reviewer_id uuid not null default auth.uid() references public.profiles(id),
 decision text not null check(decision in ('approved','rejected')),comment text not null default '',created_at timestamptz not null default now(),primary key(content_id,reviewer_id)
);
create function public.plan_is_approved(plan uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_member() and (select count(*) from public.plan_approvals a join public.profiles p on p.id=a.reviewer_id
 where a.plan_id=plan and a.decision='approved' and p.active and p.role='leadership')>=2;
$$;
revoke all on function public.plan_is_approved(uuid) from public;
grant execute on function public.plan_is_approved(uuid) to authenticated;
create table public.tasks (
 id uuid primary key default gen_random_uuid(),title text not null,direction_id uuid references public.directions(id),
 content_id uuid references public.content_items(id),goal_id uuid references public.goals(id),assignee_id uuid references public.profiles(id),
 due_date date,status text not null default 'planned' check(status in ('planned','doing','done')),link text not null default '',
 created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),content_id uuid references public.content_items(id),plan_id uuid references public.content_plans(id),
 body text not null check(length(body) between 1 and 5000),author_id uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),
 check(num_nonnulls(content_id,plan_id)=1)
);
create table public.campaigns(id uuid primary key default gen_random_uuid(),title text not null,direction_id uuid references public.directions(id),source_id uuid references public.categories(id),starts_on date,ends_on date,status text not null default 'planned');
create table public.weekly_reports (
 id uuid primary key default gen_random_uuid(),week_start date not null check(extract(isodow from week_start)=1),branch_id uuid not null references public.branches(id),
 direction_id uuid not null references public.directions(id),source_id uuid not null references public.categories(id),campaign_id uuid references public.campaigns(id),
 inquiries integer check(inquiries>=0),bookings integer check(bookings>=0),first_visits integer check(first_visits>=0),
 registrations integer check(registrations>=0),orders integer check(orders>=0),participants integer check(participants>=0),
 created_by uuid not null default auth.uid() references public.profiles(id),updated_at timestamptz not null default now(),
 unique nulls not distinct(week_start,branch_id,direction_id,source_id,campaign_id)
);
create table public.weekly_receipts (
 report_id uuid primary key references public.weekly_reports(id) on delete cascade,
 amount numeric(14,2) not null check(amount>=0),currency text not null default 'TJS' check(currency='TJS'),
 created_by uuid not null default auth.uid() references public.profiles(id),updated_at timestamptz not null default now()
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),title text not null,amount numeric(14,2) not null check(amount>0),
 currency text not null default 'TJS' check(currency='TJS'),paid_on date not null,direction_id uuid references public.directions(id),
 campaign_id uuid references public.campaigns(id),category_id uuid references public.categories(id),
 type text not null default 'regular' check(type in ('regular','one_off','budget')),created_by uuid not null default auth.uid() references public.profiles(id)
);
create table public.partners (
 id uuid primary key default gen_random_uuid(),name text not null,kind text not null default 'Клиника',
 direction_id uuid references public.directions(id),owner_id uuid references public.profiles(id),
 status text not null default 'Найти контакт',next_action text not null default '',next_date date,
 created_by uuid not null default auth.uid() references public.profiles(id)
);
create table public.partner_activities(id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.partners(id),body text not null,created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now());
create table public.events(id uuid primary key default gen_random_uuid(),title text not null,direction_id uuid references public.directions(id),starts_on date not null,kind text not null default 'Мероприятие',description text not null default '',created_by uuid not null default auth.uid() references public.profiles(id));
create table public.ideas(id uuid primary key default gen_random_uuid(),title text not null,direction_id uuid references public.directions(id),description text not null default '',created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now());
create table public.metric_definitions(id uuid primary key default gen_random_uuid(),direction_id uuid references public.directions(id),name text not null,unit text not null default 'шт.',archived boolean not null default false);
create table public.weekly_metric_values(report_id uuid references public.weekly_reports(id) on delete cascade,metric_id uuid references public.metric_definitions(id),value numeric not null check(value>=0),primary key(report_id,metric_id));
create table public.social_metric_snapshots (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.social_accounts(id),external_media_id text not null default '',
 metric text not null,value numeric not null,observed_at timestamptz not null default now(),period text not null default 'day',source text not null default 'meta'
);
create table public.sync_runs(id uuid primary key default gen_random_uuid(),account_id uuid references public.social_accounts(id),status text not null,message text not null default '',created_at timestamptz not null default now());
create table public.publications (
 id uuid primary key default gen_random_uuid(),content_id uuid not null references public.content_items(id),account_id uuid not null references public.social_accounts(id),
 scheduled_at timestamptz not null,status text not null default 'queued' check(status in ('queued','processing','published','failed','uncertain','cancelled')),
 external_id text,container_id text,permalink text,error text,attempts integer not null default 0,created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(content_id,account_id)
);
create table public.audit_log(id bigint generated always as identity primary key,table_name text not null,record_id text,actor_id uuid,action text not null,created_at timestamptz not null default now());
create table public.content_versions(id bigint generated always as identity primary key,content_id uuid references public.content_items(id),body text not null,title text not null,asset_url text not null,actor_id uuid,created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id),body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table private.social_credentials(account_id uuid primary key references public.social_accounts(id) on delete cascade,encrypted_token text not null,expires_at timestamptz);
-- A restricted RPC is required because private is not an exposed PostgREST schema.
create function public.worker_credentials() returns table(account_id uuid,encrypted_token text,expires_at timestamptz)
 language sql security definer set search_path='' as $$ select * from private.social_credentials $$;
revoke all on function public.worker_credentials() from public,anon,authenticated;
grant execute on function public.worker_credentials() to service_role;
create function public.store_social_credential(account uuid,token text,expires timestamptz) returns void
 language plpgsql security definer set search_path='' as $$ begin
 insert into private.social_credentials values(account,token,expires) on conflict(account_id) do update set encrypted_token=excluded.encrypted_token,expires_at=excluded.expires_at;
 end $$;
revoke all on function public.store_social_credential(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.store_social_credential(uuid,text,timestamptz) to service_role;

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.is_member() or id=auth.uid());
-- Provisioning and role changes happen through the Supabase dashboard/service role, never self-edit.
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.profiles from authenticated,anon;

do $$ declare t text; begin
 foreach t in array array['directions','branches','categories','goals','content_plans','social_accounts','doctors','content_items','content_doctors','plan_approvals','medical_reviews','tasks','comments','campaigns','weekly_reports','weekly_receipts','expenses','partners','partner_activities','events','ideas','metric_definitions','weekly_metric_values','social_metric_snapshots','sync_runs','publications','audit_log','content_versions','notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t not in ('weekly_receipts','expenses','audit_log','notifications') then
 execute format('create policy member_read on public.%I for select to authenticated using(public.is_member())',t);
 end if;
 end loop;
 foreach t in array array['directions','branches','categories','goals','content_plans','social_accounts','doctors','content_items','content_doctors','campaigns','metric_definitions'] loop
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 execute format('create policy manager_write on public.%I for all to authenticated using(public.can_manage()) with check(public.can_manage())',t);
 end loop;
 foreach t in array array['weekly_reports','weekly_receipts','expenses','weekly_metric_values'] loop
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy manager_write on public.%I for all to authenticated using(public.can_manage()) with check(public.can_manage())',t);
 end loop;
 foreach t in array array['partners','partner_activities','events','ideas'] loop
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy member_insert on public.%I for insert to authenticated with check(public.is_member() and created_by=auth.uid())',t);
 execute format('create policy owner_update on public.%I for update to authenticated using(public.can_manage() or (public.is_member() and created_by=auth.uid())) with check(public.can_manage() or (public.is_member() and created_by=auth.uid()))',t);
 end loop;
end $$;
create policy finance_read on public.weekly_receipts for select to authenticated using(public.can_manage());
create policy finance_read on public.expenses for select to authenticated using(public.can_manage());
create policy audit_read on public.audit_log for select to authenticated using(public.can_manage());
create policy own_notifications on public.notifications for select to authenticated using(public.is_member() and recipient_id=auth.uid());
grant insert,update on public.tasks to authenticated;
create policy tasks_insert on public.tasks for insert to authenticated with check(public.is_member() and created_by=auth.uid() and (assignee_id is null or assignee_id=auth.uid() or public.can_manage()));
create policy tasks_update on public.tasks for update to authenticated using(public.can_manage() or (public.is_member() and assignee_id=auth.uid())) with check(public.can_manage() or (public.is_member() and assignee_id=auth.uid()));
grant insert on public.comments to authenticated;
create policy comments_insert on public.comments for insert to authenticated with check(public.is_member() and author_id=auth.uid());
grant insert,update on public.plan_approvals to authenticated;
create policy leader_approval on public.plan_approvals for all to authenticated using(public.is_leader() and reviewer_id=auth.uid()) with check(public.is_leader() and reviewer_id=auth.uid());
grant insert,update on public.medical_reviews to authenticated;
create policy doctor_approval on public.medical_reviews for all to authenticated using(public.is_member() and reviewer_id=auth.uid() and (private.role()='doctor' or public.is_leader())) with check(public.is_member() and reviewer_id=auth.uid() and (private.role()='doctor' or public.is_leader()));
-- Policies must not directly call an inaccessible private function as invoker.
create function public.can_review_medical() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role() in ('doctor','leadership'),false) $$;
revoke all on function public.can_review_medical() from public;
grant execute on function public.can_review_medical() to authenticated;
drop policy doctor_approval on public.medical_reviews;
create policy doctor_approval on public.medical_reviews for all to authenticated using(public.can_review_medical() and reviewer_id=auth.uid()) with check(public.can_review_medical() and reviewer_id=auth.uid());
grant insert on public.publications to authenticated;
create policy publish_approved on public.publications for insert to authenticated with check(
 public.can_manage() and created_by=auth.uid() and status='queued' and external_id is null and container_id is null and permalink is null and error is null and attempts=0
 and exists(select 1 from public.content_items c where c.id=content_id and c.status in ('ready','scheduled') and public.plan_is_approved(c.plan_id))
);

create function private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.audit_log(table_name,record_id,actor_id,action) values(TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'report_id',to_jsonb(new)->>'plan_id'),auth.uid(),TG_OP);
 if TG_TABLE_NAME='content_items' then
 insert into public.content_versions(content_id,body,title,asset_url,actor_id) values(new.id,new.body,new.title,new.asset_url,auth.uid());
 end if;
 return new;
 end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','content_items','content_plans','plan_approvals','medical_reviews','weekly_reports','weekly_receipts','expenses','tasks','publications'] loop
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.record_change()',t);
 end loop;
end $$;

-- Atomic weekly submission: public counts and protected receipts either both save or neither does.
create function public.submit_weekly_report(payload jsonb,receipt numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; begin
 if not public.can_manage() then raise exception 'Forbidden' using errcode='42501'; end if;
 if receipt is null or receipt<0 then raise exception 'Invalid receipt'; end if;
 insert into public.weekly_reports(week_start,branch_id,direction_id,source_id,campaign_id,inquiries,bookings,first_visits,registrations,orders,participants,created_by)
 values((payload->>'week_start')::date,(payload->>'branch_id')::uuid,(payload->>'direction_id')::uuid,(payload->>'source_id')::uuid,nullif(payload->>'campaign_id','')::uuid,
 (payload->>'inquiries')::integer,(payload->>'bookings')::integer,(payload->>'first_visits')::integer,(payload->>'registrations')::integer,(payload->>'orders')::integer,(payload->>'participants')::integer,auth.uid())
 on conflict(week_start,branch_id,direction_id,source_id,campaign_id) do update set inquiries=excluded.inquiries,bookings=excluded.bookings,first_visits=excluded.first_visits,registrations=excluded.registrations,orders=excluded.orders,participants=excluded.participants,updated_at=now() returning id into rid;
 insert into public.weekly_receipts(report_id,amount,created_by) values(rid,receipt,auth.uid()) on conflict(report_id) do update set amount=excluded.amount,updated_at=now();
 return rid;
end $$;
revoke all on function public.submit_weekly_report(jsonb,numeric) from public;
grant execute on function public.submit_weekly_report(jsonb,numeric) to authenticated;

-- Worker locking prevents two cron executions from publishing the same queued item.
create function public.claim_publication() returns setof public.publications language plpgsql security definer set search_path='' as $$
begin return query update public.publications set status='processing',attempts=attempts+1,updated_at=now()
 where id=(select id from public.publications where status='queued' and scheduled_at<=now() order by scheduled_at for update skip locked limit 1) returning *; end $$;
revoke all on function public.claim_publication() from public,anon,authenticated;
grant execute on function public.claim_publication() to service_role;
create index tasks_due on public.tasks(due_date);
create index content_date on public.content_items(publish_at);
create index report_week on public.weekly_reports(week_start,direction_id,branch_id);
create index snapshots_account_time on public.social_metric_snapshots(account_id,observed_at desc);
commit;
