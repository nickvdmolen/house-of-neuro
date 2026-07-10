-- Atomic score mutations for House of Neuro.
-- Run this file after supabase-schema.sql in the Supabase SQL editor.
--
-- SECURITY INVOKER is intentional: the RPC has only the table access granted
-- to its caller. The current app signs into Supabase anonymously and keeps its
-- teacher/student identity only in React state. Atomicity is provided here, but
-- caller authorization still requires auth.uid() mappings plus RLS, or a trusted
-- backend that invokes this RPC.

begin;

alter table public.semesters
  add column if not exists start_date date,
  add column if not exists end_date date;

alter table public.awards
  alter column target_id type text using target_id::text;

alter table public.awards
  add column if not exists mutation_meta jsonb not null default '{}'::jsonb,
  add column if not exists previous_points integer,
  add column if not exists resulting_points integer,
  -- NULL means that a legacy row predates this RPC and is not auditable.
  add column if not exists mutation_applied boolean;

create index if not exists awards_target_history_idx
  on public.awards (target, target_id, ts, id);

create or replace function public.apply_score_mutations(
  p_awards jsonb,
  p_peer_awards jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_awards jsonb := coalesce(p_awards, '[]'::jsonb);
  v_peers jsonb := coalesce(p_peer_awards, '[]'::jsonb);
  v_award_count integer;
  v_peer_count integer;
  v_item jsonb;

  v_id uuid;
  v_ts timestamptz;
  v_target text;
  v_target_id text;
  v_amount integer;
  v_reason text;
  v_semester text;
  v_apply boolean;
  v_repair boolean;
  v_badge_id text;
  v_badge_action text;
  v_marker_supplied boolean;
  v_marker text;
  v_meta jsonb;
  v_existing_noop boolean;
  v_existing public.awards%rowtype;
  v_new_claim boolean;
  v_legacy_repair boolean;
  v_old_points integer;
  v_new_points integer;
  v_badges text[];
  v_old_marker text;
  v_marker_missing boolean;
  v_can_legacy_repair boolean;
  v_apply_now boolean;
  v_badge_present boolean;
  v_status text;

  v_peer_from text;
  v_peer_event_id text;
  v_peer_event public.peer_events%rowtype;
  v_peer_actor public.students%rowtype;
  v_peer_recipient public.students%rowtype;
  v_peer_group public.groups%rowtype;
  v_peer_existing_count integer;
  v_peer_replay boolean := false;
  v_peer_budget bigint;
  v_peer_expected_target text;
  v_incoming_peer jsonb;
  v_stored_peer jsonb;
  v_peer_score_map jsonb;
  v_award_score_map jsonb;
  v_peer_id uuid;
  v_peer_recipients text[];
  v_peer_expected_recipients text[];

  v_results jsonb := '[]'::jsonb;
  v_applied_ids jsonb := '[]'::jsonb;
  v_replayed_ids jsonb := '[]'::jsonb;
  v_repaired_ids jsonb := '[]'::jsonb;
  v_noop_ids jsonb := '[]'::jsonb;
  v_applied_peer_ids jsonb := '[]'::jsonb;
  v_replayed_peer_ids jsonb := '[]'::jsonb;
  v_all_replayed boolean;
begin
  if jsonb_typeof(v_awards) is distinct from 'array' or
     jsonb_typeof(v_peers) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'HON_INVALID_PAYLOAD: p_awards and p_peer_awards must be arrays';
  end if;

  v_award_count := jsonb_array_length(v_awards);
  v_peer_count := jsonb_array_length(v_peers);
  if v_award_count = 0 or v_award_count > 500 or v_peer_count > 500 then
    raise exception using
      errcode = '22023',
      message = 'HON_INVALID_SIZE: provide 1..500 awards and at most 500 peer rows';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_awards) as items(value)
    group by value ->> 'id' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(v_peers) as items(value)
    group by value ->> 'id' having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'HON_DUPLICATE_REQUEST_ID';
  end if;

  -- A peer request is one complete student/event submission. Lock the event
  -- before inspecting prior rows so two concurrent submissions serialize.
  if v_peer_count > 0 then
    if v_peer_count <> v_award_count or exists (
      select 1 from jsonb_array_elements(v_peers) as items(value)
      where jsonb_typeof(value) is distinct from 'object'
        or nullif(value ->> 'id', '') is null
        or nullif(value ->> 'from_student_id', '') is null
        or nullif(value ->> 'event_id', '') is null
        or nullif(value ->> 'target_id', '') is null
        or value ->> 'target' is null
        or value ->> 'target' not in ('student', 'group')
    ) then
      raise exception using errcode = '22023', message = 'HON_INVALID_PEER_SUBMISSION';
    end if;

    select min(value ->> 'from_student_id'), min(value ->> 'event_id')
      into v_peer_from, v_peer_event_id
      from jsonb_array_elements(v_peers) as items(value);
    if (select count(distinct value ->> 'from_student_id') from jsonb_array_elements(v_peers) as items(value)) <> 1
       or (select count(distinct value ->> 'event_id') from jsonb_array_elements(v_peers) as items(value)) <> 1 then
      raise exception using errcode = '22023', message = 'HON_MULTIPLE_PEER_EVENTS';
    end if;

    select event.* into v_peer_event
      from public.peer_events event
     where event.id = v_peer_event_id
     for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'HON_PEER_EVENT_NOT_FOUND';
    end if;
    -- Canonical payloads make a retry successful only when every stored peer
    -- row has the same generated ID and the same data. Timestamp is included.
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', value ->> 'id',
      'ts', to_jsonb((value ->> 'ts')::timestamptz),
      'from_student_id', value ->> 'from_student_id',
      'event_id', value ->> 'event_id',
      'target', value ->> 'target',
      'target_id', value ->> 'target_id',
      'semesterId', value ->> 'semesterId',
      'amount', (value ->> 'amount')::integer,
      'total_amount', (value ->> 'total_amount')::integer,
      'reason', value ->> 'reason',
      'recipients', coalesce(value -> 'recipients', '[]'::jsonb),
      'weekKey', value ->> 'weekKey'
    ) order by value ->> 'id'), '[]'::jsonb)
      into v_incoming_peer
      from jsonb_array_elements(v_peers) as items(value);

    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', peer.id::text,
      'ts', to_jsonb(peer.ts),
      'from_student_id', peer.from_student_id,
      'event_id', peer.event_id,
      'target', peer.target,
      'target_id', peer.target_id,
      'semesterId', peer."semesterId",
      'amount', peer.amount,
      'total_amount', peer.total_amount,
      'reason', peer.reason,
      'recipients', to_jsonb(coalesce(peer.recipients, '{}'::text[])),
      'weekKey', coalesce(to_jsonb(peer) ->> 'weekKey', to_jsonb(peer) ->> 'weekkey')
    ) order by peer.id::text), '[]'::jsonb)
      into v_peer_existing_count, v_stored_peer
      from public.peer_awards peer
     where peer.from_student_id = v_peer_from
       and peer.event_id = v_peer_event_id;

    if v_peer_existing_count > 0 then
      if v_stored_peer is distinct from v_incoming_peer then
        raise exception using
          errcode = '23505',
          message = 'HON_PEER_EVENT_ALREADY_SUBMITTED: retry differs from stored submission';
      end if;
      v_peer_replay := true;
      select coalesce(jsonb_agg(value ->> 'id' order by value ->> 'id'), '[]'::jsonb)
        into v_replayed_peer_ids
        from jsonb_array_elements(v_peers) as items(value);

      -- A transactionally stored peer submission must also have every score
      -- award. Do not guess-repair inconsistent legacy data by applying points.
      if exists (
        select 1 from jsonb_array_elements(v_awards) as items(value)
        where not exists (
          select 1 from public.awards where id = (value ->> 'id')::uuid
        )
      ) then
        raise exception using errcode = '55000', message = 'HON_INCOMPLETE_PEER_REPLAY';
      end if;
    else
      if v_peer_event.active is not true then
        raise exception using errcode = '22023', message = 'HON_PEER_EVENT_INACTIVE';
      end if;

      -- The UI uses student targets when own-group awards are enabled (and also
      -- when both scopes are enabled). Pure other-group events target groups.
      if coalesce(v_peer_event.allow_own_group, false) then
        v_peer_expected_target := 'student';
      elsif coalesce(v_peer_event.allow_other_groups, true) then
        v_peer_expected_target := 'group';
      else
        raise exception using errcode = '22023', message = 'HON_PEER_SCOPE_MISMATCH';
      end if;

      -- Lock score groups before students, matching the mutation loop's global
      -- lock order. Group submissions also take a short SHARE table lock so no
      -- student can enter or leave a target group until its exact recipients are
      -- committed. Then lock actor and target/member rows in deterministic order.
      if v_peer_expected_target = 'group' then
        perform target_group.id
          from public.groups target_group
         where target_group.id in (
           select value ->> 'target_id'
             from jsonb_array_elements(v_peers) as items(value)
         )
         order by target_group.id
         for update;
        lock table public.students in share mode;
      end if;
      perform locked_student.id
        from public.students locked_student
       where locked_student.id = v_peer_from
          or (
            v_peer_expected_target = 'student'
            and locked_student.id in (
              select value ->> 'target_id'
                from jsonb_array_elements(v_peers) as items(value)
            )
          )
          or (
            v_peer_expected_target = 'group'
            and locked_student."groupId" in (
              select value ->> 'target_id'
                from jsonb_array_elements(v_peers) as items(value)
            )
          )
       order by locked_student.id
       for update;

      select actor.* into v_peer_actor
        from public.students actor
       where actor.id = v_peer_from;
      if not found then
        raise exception using errcode = 'P0002', message = 'HON_PEER_STUDENT_NOT_FOUND';
      end if;
      if v_peer_event."semesterId" is not null
         and v_peer_actor."semesterId" is distinct from v_peer_event."semesterId" then
        raise exception using errcode = '22023', message = 'HON_PEER_SEMESTER_MISMATCH';
      end if;

      for v_item in
        select value
          from jsonb_array_elements(v_peers) as items(value)
         order by value ->> 'target', value ->> 'target_id', value ->> 'id'
      loop
        if v_item ->> 'target' is distinct from v_peer_expected_target then
          raise exception using errcode = '22023', message = 'HON_PEER_SCOPE_MISMATCH';
        end if;
        if jsonb_typeof(v_item -> 'recipients') is distinct from 'array' then
          raise exception using errcode = '22023', message = 'HON_PEER_RECIPIENTS_MISMATCH';
        end if;
        if exists (
          select 1
            from jsonb_array_elements(v_item -> 'recipients') recipient(value)
           where jsonb_typeof(value) is distinct from 'string'
        ) then
          raise exception using errcode = '22023', message = 'HON_PEER_RECIPIENTS_MISMATCH';
        end if;

        select coalesce(array_agg(recipient order by recipient), '{}'::text[])
          into v_peer_recipients
          from jsonb_array_elements_text(v_item -> 'recipients') recipients(recipient);

        if v_peer_expected_target = 'student' then
          if v_item ->> 'target_id' = v_peer_actor.id then
            raise exception using errcode = '22023', message = 'HON_PEER_SELF_AWARD';
          end if;
          select recipient.* into v_peer_recipient
            from public.students recipient
           where recipient.id = v_item ->> 'target_id';
          if not found then
            raise exception using errcode = 'P0002', message = 'HON_PEER_RECIPIENT_NOT_FOUND';
          end if;
          if v_peer_event."semesterId" is not null
             and v_peer_recipient."semesterId" is distinct from v_peer_event."semesterId" then
            raise exception using errcode = '22023', message = 'HON_PEER_SEMESTER_MISMATCH';
          end if;
          if not coalesce(v_peer_event.allow_other_groups, true)
             and (
               v_peer_actor."groupId" is null
               or v_peer_recipient."groupId" is distinct from v_peer_actor."groupId"
             ) then
            raise exception using errcode = '22023', message = 'HON_PEER_SCOPE_MISMATCH';
          end if;
          v_peer_expected_recipients := array[v_peer_recipient.id]::text[];
        else
          select target_group.* into v_peer_group
            from public.groups target_group
           where target_group.id = v_item ->> 'target_id';
          if not found then
            raise exception using errcode = 'P0002', message = 'HON_PEER_GROUP_NOT_FOUND';
          end if;
          if v_peer_event."semesterId" is not null
             and v_peer_group."semesterId" is distinct from v_peer_event."semesterId" then
            raise exception using errcode = '22023', message = 'HON_PEER_SEMESTER_MISMATCH';
          end if;
          if v_peer_group.id = v_peer_actor."groupId" then
            raise exception using errcode = '22023', message = 'HON_PEER_SELF_AWARD';
          end if;
          if v_peer_event."semesterId" is not null and exists (
            select 1
              from public.students member
             where member."groupId" = v_peer_group.id
               and member."semesterId" is distinct from v_peer_event."semesterId"
          ) then
            raise exception using errcode = '22023', message = 'HON_PEER_SEMESTER_MISMATCH';
          end if;
          select coalesce(array_agg(member.id order by member.id), '{}'::text[])
            into v_peer_expected_recipients
            from public.students member
           where member."groupId" = v_peer_group.id;
          if coalesce(array_length(v_peer_expected_recipients, 1), 0) = 0 then
            raise exception using errcode = '22023', message = 'HON_PEER_RECIPIENTS_MISMATCH';
          end if;
        end if;

        if v_peer_recipients is distinct from v_peer_expected_recipients then
          raise exception using errcode = '22023', message = 'HON_PEER_RECIPIENTS_MISMATCH';
        end if;
      end loop;

      select coalesce(sum((value ->> 'total_amount')::bigint), 0)
        into v_peer_budget
        from jsonb_array_elements(v_peers) as items(value);
      if v_peer_budget is distinct from v_peer_event.budget::bigint then
        raise exception using errcode = '22023', message = 'HON_PEER_BUDGET_MISMATCH';
      end if;
      select coalesce(jsonb_agg(jsonb_build_object(
        'target', value ->> 'target',
        'target_id', value ->> 'target_id',
        'amount', (value ->> 'total_amount')::integer
      ) order by value ->> 'target', value ->> 'target_id',
                 (value ->> 'total_amount')::integer), '[]'::jsonb)
        into v_peer_score_map
        from jsonb_array_elements(v_peers) peer(value);
      select coalesce(jsonb_agg(jsonb_build_object(
        'target', value ->> 'target',
        'target_id', value ->> 'target_id',
        'amount', (value ->> 'amount')::integer
      ) order by value ->> 'target', value ->> 'target_id',
                 (value ->> 'amount')::integer), '[]'::jsonb)
        into v_award_score_map
        from jsonb_array_elements(v_awards) award(value);

      if v_peer_score_map is distinct from v_award_score_map or exists (
        select 1 from jsonb_array_elements(v_peers) peer(value)
        where (value ->> 'amount')::integer <= 0
           or (value ->> 'total_amount')::integer <= 0
      ) or exists (
        select 1 from jsonb_array_elements(v_awards) award(value)
        where coalesce((value ->> 'applyPoints')::boolean, true) is not true
           or coalesce((value ->> 'repairPointsWhenMarkerMissing')::boolean, false) is true
           or value ? 'badgeId'
           or value ? 'badgeAction'
           or value ? 'lastWeekRewarded'
      ) then
        raise exception using errcode = '22023', message = 'HON_PEER_SCORE_MISMATCH';
      end if;
    end if;
  end if;

  -- Claims are processed in target order. INSERT ... ON CONFLICT happens before
  -- the score update; concurrent retries therefore cannot increment twice.
  for v_item in
    select value from jsonb_array_elements(v_awards) as items(value)
    order by value ->> 'target', value ->> 'target_id', value ->> 'id'
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'HON_INVALID_AWARD';
    end if;
    begin
      v_id := nullif(v_item ->> 'id', '')::uuid;
      v_ts := coalesce(nullif(v_item ->> 'ts', '')::timestamptz, clock_timestamp());
      v_amount := (v_item ->> 'amount')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'HON_INVALID_AWARD_SCALAR';
    end;

    v_target := v_item ->> 'target';
    v_target_id := nullif(v_item ->> 'target_id', '');
    v_semester := nullif(v_item ->> 'semesterId', '');
    v_reason := case when v_item ? 'reason' then v_item ->> 'reason' else null end;
    v_apply := coalesce((v_item ->> 'applyPoints')::boolean, true);
    v_repair := coalesce((v_item ->> 'repairPointsWhenMarkerMissing')::boolean, false);
    v_badge_id := nullif(v_item ->> 'badgeId', '');
    v_badge_action := nullif(v_item ->> 'badgeAction', '');
    v_marker_supplied := v_item ? 'lastWeekRewarded';
    v_marker := case when v_marker_supplied then nullif(v_item ->> 'lastWeekRewarded', '') else null end;

    if v_id is null or v_target is null or v_target_id is null or v_amount is null or v_amount = 0
       or v_target not in ('student', 'group') then
      raise exception using errcode = '22023', message = 'HON_INVALID_AWARD';
    end if;
    if (v_badge_id is null) <> (v_badge_action is null)
       or (v_badge_action is not null and v_badge_action not in ('grant', 'revoke'))
       or (v_badge_action = 'grant' and v_amount < 0)
       or (v_badge_action = 'revoke' and v_amount > 0) then
      raise exception using errcode = '22023', message = 'HON_INVALID_BADGE_ACTION';
    end if;
    if v_target = 'group' and (v_badge_id is not null or v_marker_supplied or v_repair) then
      raise exception using errcode = '22023', message = 'HON_INVALID_GROUP_OPTIONS';
    end if;
    if v_badge_id is not null and not v_apply then
      raise exception using errcode = '22023', message = 'HON_BADGE_POINTS_REQUIRED';
    end if;
    if v_marker_supplied and v_marker is null then
      raise exception using errcode = '22023', message = 'HON_INVALID_WEEK_MARKER';
    end if;
    if v_repair and (not v_marker_supplied or v_target <> 'student' or v_badge_id is not null) then
      raise exception using errcode = '22023', message = 'HON_INVALID_WEEK_REPAIR';
    end if;

    -- A transaction-scoped lock makes the request ID a single durable claim,
    -- including badge no-ops that are stored as hidden zero-amount award rows.
    perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));

    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'applyPoints', v_apply,
      'repairPointsWhenMarkerMissing', v_repair,
      'badgeId', v_badge_id,
      'badgeAction', v_badge_action,
      'lastWeekRewarded', v_marker
    ));
    insert into public.awards (
      id, ts, target, target_id, "semesterId", amount, reason,
      mutation_meta, mutation_applied
    ) values (
      v_id, v_ts, v_target, v_target_id, v_semester, v_amount, v_reason,
      v_meta, false
    )
    on conflict (id) do nothing
    returning * into v_existing;
    v_new_claim := found;
    v_legacy_repair := false;

    if not v_new_claim then
      select award.* into v_existing
        from public.awards award where award.id = v_id for update;
      v_existing_noop := coalesce((v_existing.mutation_meta ->> 'noop')::boolean, false);
      if v_existing_noop then
        if v_existing.target is distinct from v_target
           or v_existing.target_id is distinct from v_target_id
           or v_existing.amount is distinct from 0
           or (v_existing.mutation_meta ->> 'requestedAmount')::integer is distinct from v_amount
           or (v_existing.mutation_meta - 'noop' - 'requestedAmount') is distinct from v_meta
           or v_existing.reason is distinct from v_reason
           or v_existing.ts is distinct from v_ts
           or v_existing."semesterId" is distinct from v_semester then
          raise exception using errcode = '23505', message = 'HON_NOOP_CLAIM_COLLISION';
        end if;
        v_replayed_ids := v_replayed_ids || jsonb_build_array(v_id::text);
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'id', v_id::text, 'status', 'noop', 'applied', false,
          'replayed', true, 'pointsApplied', false,
          'previousPoints', v_existing.previous_points,
          'resultingPoints', v_existing.resulting_points
        ));
        continue;
      end if;
      if v_existing.target is distinct from v_target
         or v_existing.target_id is distinct from v_target_id
         or v_existing.amount is distinct from v_amount
         or v_existing.reason is distinct from v_reason then
        raise exception using errcode = '23505', message = 'HON_AWARD_ID_COLLISION';
      end if;
      if coalesce(v_existing.mutation_meta, '{}'::jsonb) is distinct from v_meta then
        v_legacy_repair := v_repair
          and coalesce(v_existing.mutation_meta, '{}'::jsonb) = '{}'::jsonb;
        if not v_legacy_repair then
          raise exception using errcode = '23505', message = 'HON_AWARD_OPTIONS_COLLISION';
        end if;
      end if;
      if not v_legacy_repair and not v_repair and (
        v_existing.ts is distinct from v_ts or
        v_existing."semesterId" is distinct from v_semester
      ) then
        raise exception using errcode = '23505', message = 'HON_AWARD_REPLAY_MISMATCH';
      end if;
      if not v_legacy_repair then
        v_replayed_ids := v_replayed_ids || jsonb_build_array(v_id::text);
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'id', v_id::text, 'status', 'replayed', 'applied', false,
          'replayed', true, 'pointsApplied', false,
          'previousPoints', v_existing.previous_points,
          'resultingPoints', v_existing.resulting_points
        ));
        continue;
      end if;
    end if;

    if v_target = 'student' then
      select coalesce(points, 0), coalesce(badges, '{}'::text[]), "lastWeekRewarded"
        into v_old_points, v_badges, v_old_marker
        from public.students where id = v_target_id for update;
    else
      select coalesce(points, 0) into v_old_points
        from public.groups where id = v_target_id for update;
      v_badges := '{}'::text[];
      v_old_marker := null;
    end if;
    if not found then
      raise exception using errcode = 'P0002', message = 'HON_SCORE_TARGET_NOT_FOUND';
    end if;

    if v_new_claim and v_marker_supplied
       and v_old_marker ~ '^\d{4}-W\d{2}$'
       and v_marker ~ '^\d{4}-W\d{2}$'
       and v_old_marker > v_marker then
      raise exception using errcode = '22023', message = 'HON_STALE_WEEK_MARKER';
    end if;

    v_marker_missing := v_marker_supplied and v_old_marker is distinct from v_marker;
    v_can_legacy_repair := v_old_marker is null or (
      v_old_marker ~ '^\d{4}-W\d{2}$' and
      v_marker ~ '^\d{4}-W\d{2}$' and
      v_old_marker < v_marker
    );
    if not v_new_claim and v_legacy_repair and not v_can_legacy_repair then
      -- The same or a newer marker proves this legacy award must not apply
      -- points again. Upgrade its metadata so future retries are pure replays.
      update public.awards
         set mutation_meta = v_meta,
             mutation_applied = true
       where id = v_id;
      v_replayed_ids := v_replayed_ids || jsonb_build_array(v_id::text);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_id::text, 'status', 'replayed', 'applied', false,
        'replayed', true, 'pointsApplied', false,
        'previousPoints', v_existing.previous_points,
        'resultingPoints', v_existing.resulting_points
      ));
      continue;
    end if;

    -- badgeId/badgeAction express desired state, not an array replacement.
    if v_new_claim and v_badge_id is not null then
      v_badge_present := v_badge_id = any(v_badges);
      if (v_badge_action = 'grant' and v_badge_present)
         or (v_badge_action = 'revoke' and not v_badge_present) then
        update public.awards
           set amount = 0,
               mutation_meta = v_meta || jsonb_build_object(
                 'noop', true,
                 'requestedAmount', v_amount
               ),
               previous_points = v_old_points,
               resulting_points = v_old_points,
               mutation_applied = false
         where id = v_id;
        v_noop_ids := v_noop_ids || jsonb_build_array(v_id::text);
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'id', v_id::text, 'status', 'noop', 'applied', false,
          'replayed', false, 'pointsApplied', false,
          'previousPoints', v_old_points, 'resultingPoints', v_old_points
        ));
        continue;
      end if;
    end if;

    if v_new_claim then
      v_apply_now := v_apply and not (v_marker_supplied and not v_marker_missing);
    else
      -- An explicit repair may complete a legacy award+missing-marker split.
      -- If this RPC already applied it, only the marker is repaired.
      v_apply_now := v_apply and v_marker_missing
        and v_existing.mutation_applied is distinct from true;
    end if;
    v_new_points := v_old_points + case when v_apply_now then v_amount else 0 end;

    if v_target = 'student' then
      if v_badge_action = 'grant' then
        v_badges := array_append(v_badges, v_badge_id);
      elsif v_badge_action = 'revoke' then
        v_badges := array_remove(v_badges, v_badge_id);
      end if;
      update public.students
         set points = v_new_points,
             badges = v_badges,
             "lastWeekRewarded" = case
               when v_marker_supplied and (v_new_claim or v_marker_missing) then v_marker
               else "lastWeekRewarded"
             end
       where id = v_target_id;
    else
      update public.groups set points = v_new_points where id = v_target_id;
    end if;

    update public.awards
       set mutation_meta = v_meta,
           previous_points = case
             when v_new_claim or v_apply_now then v_old_points
             else coalesce(previous_points, v_old_points)
           end,
           resulting_points = case
             when v_new_claim or v_apply_now then v_new_points
             else coalesce(resulting_points, v_new_points)
           end,
           mutation_applied = coalesce(mutation_applied, false) or v_apply_now
     where id = v_id
     returning previous_points, resulting_points into v_old_points, v_new_points;

    if v_new_claim then
      v_status := case when v_marker_supplied and not v_apply_now
        then 'history_repaired' else 'applied' end;
      v_applied_ids := v_applied_ids || jsonb_build_array(v_id::text);
    else
      v_status := 'repaired';
      v_repaired_ids := v_repaired_ids || jsonb_build_array(v_id::text);
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_id::text, 'status', v_status, 'applied', true,
      'replayed', false, 'pointsApplied', v_apply_now,
      'previousPoints', v_old_points, 'resultingPoints', v_new_points
    ));
  end loop;

  if v_peer_count > 0 and not v_peer_replay then
    for v_item in select value from jsonb_array_elements(v_peers) as items(value)
    loop
      v_peer_id := (v_item ->> 'id')::uuid;
      select coalesce(array_agg(recipient order by ordinal), '{}'::text[])
        into v_peer_recipients
        from jsonb_array_elements_text(coalesce(v_item -> 'recipients', '[]'::jsonb))
             with ordinality recipients(recipient, ordinal);
      insert into public.peer_awards (
        id, ts, from_student_id, event_id, target, target_id, "semesterId",
        amount, total_amount, reason, recipients, weekkey
      ) values (
        v_peer_id, (v_item ->> 'ts')::timestamptz,
        v_peer_from, v_peer_event_id, v_item ->> 'target', v_item ->> 'target_id',
        nullif(v_item ->> 'semesterId', ''), (v_item ->> 'amount')::integer,
        (v_item ->> 'total_amount')::integer, v_item ->> 'reason',
        v_peer_recipients, v_item ->> 'weekKey'
      );
      v_applied_peer_ids := v_applied_peer_ids || jsonb_build_array(v_peer_id::text);
    end loop;
  end if;

  v_all_replayed := jsonb_array_length(v_applied_ids) = 0
    and jsonb_array_length(v_repaired_ids) = 0
    and jsonb_array_length(v_noop_ids) = 0
    and jsonb_array_length(v_replayed_ids) = v_award_count
    and (v_peer_count = 0 or v_peer_replay);

  return jsonb_build_object(
    'applied', not v_all_replayed,
    'replayed', v_all_replayed,
    'results', v_results,
    'peerApplied', v_peer_count > 0 and not v_peer_replay,
    'peer_replay', v_peer_replay,
    'applied_award_ids', v_applied_ids,
    'replayed_award_ids', v_replayed_ids,
    'repaired_award_ids', v_repaired_ids,
    'noop_award_ids', v_noop_ids,
    'applied_peer_award_ids', v_applied_peer_ids,
    'replayed_peer_award_ids', v_replayed_peer_ids
  );
end;
$function$;

comment on function public.apply_score_mutations(jsonb, jsonb) is
  'Atomically applies idempotent score awards, badge/week state, and exact-replay peer submissions.';

revoke all on function public.apply_score_mutations(jsonb, jsonb) from public;
revoke all on function public.apply_score_mutations(jsonb, jsonb) from anon;
grant execute on function public.apply_score_mutations(jsonb, jsonb) to authenticated;
grant execute on function public.apply_score_mutations(jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
