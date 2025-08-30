import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore write errors
  }
}

export default function usePersistentState(key, initial) {
  const [state, setState] = useState(() => loadLS(key, initial));

  // Map local storage keys to Supabase tables and converters
  const TABLE_MAP = {
    nm_points_students_v2: {
      table: 'students',
      mapFrom: (s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        password: s.password,
        group_id: s.groupId,
        points: s.points,
        photo: s.photo,
      }),
      mapTo: (r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        password: r.password,
        groupId: r.group_id,
        points: r.points,
        photo: r.photo,
      }),
      badges: true,
    },
    nm_points_groups_v2: {
      table: 'groups',
      mapFrom: (g) => ({ id: g.id, name: g.name, points: g.points }),
      mapTo: (r) => ({ id: r.id, name: r.name, points: r.points }),
    },
    nm_points_awards_v2: {
      table: 'awards',
      mapFrom: (a) => ({
        id: a.id,
        ts: new Date(a.ts).toISOString(),
        type: a.type,
        target_id: a.targetId,
        amount: a.amount,
        reason: a.reason,
      }),
      mapTo: (r) => ({
        id: r.id,
        ts: new Date(r.ts).getTime(),
        type: r.type,
        targetId: r.target_id,
        amount: r.amount,
        reason: r.reason,
      }),
    },
    nm_points_badges_v1: {
      table: 'badges',
      mapFrom: (b) => ({ id: b.id, title: b.title, image: b.image, requirement: b.requirement }),
      mapTo: (r) => ({ id: r.id, title: r.title, image: r.image, requirement: r.requirement }),
    },
    nm_points_teachers_v1: {
      table: 'teachers',
      mapFrom: (t) => ({ id: t.id, email: t.email, password_hash: t.passwordHash, approved: t.approved }),
      mapTo: (r) => ({ id: r.id, email: r.email, passwordHash: r.password_hash, approved: r.approved }),
    },
  };

  const cfg = TABLE_MAP[key];

  // Initial load from Supabase
  useEffect(() => {
    if (!cfg || !supabase) return;
    let cancelled = false;
    async function load() {
      let { data, error } = await supabase.from(cfg.table).select('*');
      if (error || !data) return;
      if (cfg.badges) {
        const { data: badgeRows } = await supabase.from('student_badges').select('*');
        const badgeMap = new Map();
        (badgeRows || []).forEach((b) => {
          if (!badgeMap.has(b.student_id)) badgeMap.set(b.student_id, []);
          badgeMap.get(b.student_id).push(b.badge_id);
        });
        data = data.map((r) => ({ ...cfg.mapTo(r), badges: badgeMap.get(r.id) || [] }));
      } else {
        data = data.map(cfg.mapTo);
      }
      if (!cancelled) setState(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cfg]);

  // Persist to localStorage
  useEffect(() => saveLS(key, state), [key, state]);

  // Persist to Supabase when state changes
  useEffect(() => {
    if (!cfg || !supabase) return;
    async function save() {
      await supabase.from(cfg.table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const rows = state.map(cfg.mapFrom);
      if (rows.length) await supabase.from(cfg.table).insert(rows);
      if (cfg.badges) {
        await supabase
          .from('student_badges')
          .delete()
          .neq('student_id', '00000000-0000-0000-0000-000000000000');
        const badgeRows = [];
        state.forEach((s) =>
          (s.badges || []).forEach((b) => badgeRows.push({ student_id: s.id, badge_id: b }))
        );
        if (badgeRows.length) await supabase.from('student_badges').insert(badgeRows);
      }
    }
    save();
  }, [cfg, state]);

  return [state, setState];
}
