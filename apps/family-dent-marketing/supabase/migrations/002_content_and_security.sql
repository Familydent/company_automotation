begin;
create function public.save_content(record_id uuid, payload jsonb, doctor_ids uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not public.can_manage() then raise exception 'Forbidden' using errcode='42501'; end if;
 if record_id is null then
  insert into public.content_items(plan_id,direction_id,title,format,objective,language,body,asset_url,publish_at,assignee_id,status,created_by)
  values((payload->>'plan_id')::uuid,(payload->>'direction_id')::uuid,payload->>'title',payload->>'format',coalesce(payload->>'objective',''),coalesce(payload->>'language','RU'),coalesce(payload->>'body',''),coalesce(payload->>'asset_url',''),(payload->>'publish_at')::timestamptz,(payload->>'assignee_id')::uuid,coalesce(payload->>'status','idea'),auth.uid()) returning id into result;
 else
  update public.content_items set plan_id=(payload->>'plan_id')::uuid,direction_id=(payload->>'direction_id')::uuid,title=payload->>'title',format=payload->>'format',
  objective=coalesce(payload->>'objective',''),language=coalesce(payload->>'language','RU'),body=coalesce(payload->>'body',''),asset_url=coalesce(payload->>'asset_url',''),
  publish_at=(payload->>'publish_at')::timestamptz,assignee_id=(payload->>'assignee_id')::uuid,status=payload->>'status',updated_at=now() where id=record_id returning id into result;
  if result is null then raise exception 'Content not found'; end if;
 end if;
 delete from public.content_doctors where content_id=result;
 insert into public.content_doctors(content_id,doctor_id) select result,d from unnest(doctor_ids) d group by d;
 return result;
end $$;
revoke all on function public.save_content(uuid,jsonb,uuid[]) from public;
grant execute on function public.save_content(uuid,jsonb,uuid[]) to authenticated;

-- Task assignees may update progress and links, but cannot reassign a task or change its author.
create function private.protect_task() returns trigger language plpgsql set search_path='' as $$ begin
 if not public.can_manage() and current_user <> 'postgres' and auth.role()<>'service_role' then
  if new.assignee_id is distinct from old.assignee_id or new.created_by is distinct from old.created_by then
   raise exception 'Cannot change assignment' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger protect_task before update on public.tasks for each row execute function private.protect_task();

-- Approval must not be inherited if content is moved into another plan after queueing.
-- Worker checks the current plan again immediately before sending.
create index publications_queue on public.publications(scheduled_at) where status='queued';
drop policy manager_write on public.social_accounts;
create policy connection_admin_write on public.social_accounts for all to authenticated using(public.can_connect()) with check(public.can_connect());
create function private.invalidate_connection() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' and new.external_id is distinct from old.external_id then
  new.connection_status='not_connected';new.last_synced_at=null;
  delete from private.social_credentials where account_id=new.id;
 end if;
 return new;
end $$;
create trigger invalidate_connection before update on public.social_accounts for each row execute function private.invalidate_connection();
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
commit;

