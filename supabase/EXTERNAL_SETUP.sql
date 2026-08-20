-- =====================================================================
-- ZEEL — full backend setup for your own Supabase project.
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run (idempotent).
-- =====================================================================

-- ---------- TABLES ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Someone',
  theme text NOT NULL DEFAULT 'rose' CHECK (theme IN ('rose','azure')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Our Space',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  attachment_path text,
  attachment_type text,
  attachment_name text,
  attachment_size bigint,
  attachment_width int,
  attachment_height int,
  attachment_duration numeric,
  client_id text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.read_receipts (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  last_delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- ---------- GRANTS (PostgREST needs these; RLS alone is not enough) ----------
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.rooms TO authenticated;
GRANT SELECT ON public.room_members TO authenticated;
GRANT SELECT ON public.invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.read_receipts TO authenticated;
GRANT ALL ON public.profiles, public.rooms, public.room_members, public.invites,
             public.messages, public.message_reactions, public.read_receipts TO service_role;

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_receipts     ENABLE ROW LEVEL SECURITY;

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS messages_room_created_idx ON public.messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_room_attachment_idx ON public.messages (room_id, created_at DESC)
  WHERE attachment_path IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS reactions_message_idx ON public.message_reactions (message_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS messages_body_trgm_idx ON public.messages USING gin (body gin_trgm_ops);

-- ---------- SECURITY DEFINER HELPERS ----------
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.shares_room_with(_other uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members a
    JOIN public.room_members b ON a.room_id = b.room_id
    WHERE a.user_id = _user_id AND b.user_id = _other
  );
$$;

CREATE OR REPLACE FUNCTION public.message_room(_message_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT room_id FROM public.messages WHERE id = _message_id;
$$;

-- These are referenced inside RLS policies, which are evaluated as the calling
-- role, so `authenticated` MUST be able to EXECUTE them (anon must not).
REVOKE ALL ON FUNCTION public.is_room_member(uuid,uuid)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_room_with(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.message_room(uuid)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid,uuid)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_room_with(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.message_room(uuid)          TO authenticated, service_role;

-- ---------- POLICIES ----------
DROP POLICY IF EXISTS profiles_select_self_or_partner ON public.profiles;
CREATE POLICY profiles_select_self_or_partner ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_room_with(id, auth.uid()));
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS rooms_select_members ON public.rooms;
CREATE POLICY rooms_select_members ON public.rooms FOR SELECT TO authenticated
  USING (public.is_room_member(id, auth.uid()));
DROP POLICY IF EXISTS rooms_update_members ON public.rooms;
CREATE POLICY rooms_update_members ON public.rooms FOR UPDATE TO authenticated
  USING (public.is_room_member(id, auth.uid())) WITH CHECK (public.is_room_member(id, auth.uid()));

DROP POLICY IF EXISTS members_select_members ON public.room_members;
CREATE POLICY members_select_members ON public.room_members FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS invites_select_members ON public.invites;
CREATE POLICY invites_select_members ON public.invites FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS messages_select_members ON public.messages;
CREATE POLICY messages_select_members ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS messages_update_own ON public.messages;
CREATE POLICY messages_update_own ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS messages_delete_own ON public.messages;
CREATE POLICY messages_delete_own ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS reactions_select_members ON public.message_reactions;
CREATE POLICY reactions_select_members ON public.message_reactions FOR SELECT TO authenticated
  USING (public.is_room_member(public.message_room(message_id), auth.uid()));
DROP POLICY IF EXISTS reactions_insert_own ON public.message_reactions;
CREATE POLICY reactions_insert_own ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(public.message_room(message_id), auth.uid()));
DROP POLICY IF EXISTS reactions_delete_own ON public.message_reactions;
CREATE POLICY reactions_delete_own ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS receipts_select_members ON public.read_receipts;
CREATE POLICY receipts_select_members ON public.read_receipts FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS receipts_insert_own ON public.read_receipts;
CREATE POLICY receipts_insert_own ON public.read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS receipts_update_own ON public.read_receipts;
CREATE POLICY receipts_update_own ON public.read_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- TOKEN GENERATOR (no pgcrypto dependency) ----------
CREATE OR REPLACE FUNCTION public.zeel_new_token()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT replace(gen_random_uuid()::text,'-','') || substr(replace(gen_random_uuid()::text,'-',''),1,16);
$$;
REVOKE ALL ON FUNCTION public.zeel_new_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeel_new_token() TO service_role;

-- ---------- RPCs ----------
CREATE OR REPLACE FUNCTION public.create_private_space(p_display_name text, p_theme text, p_room_name text DEFAULT 'Our Space')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_room uuid; v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Already in a space? return it with its live invite instead of failing.
  SELECT rm.room_id INTO v_room FROM public.room_members rm WHERE rm.user_id = v_uid LIMIT 1;
  IF v_room IS NOT NULL THEN
    SELECT token INTO v_token FROM public.invites
      WHERE room_id = v_room AND used_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1;
    IF v_token IS NULL THEN
      v_token := public.zeel_new_token();
      INSERT INTO public.invites (room_id, token, created_by) VALUES (v_room, v_token, v_uid);
    END IF;
    RETURN jsonb_build_object('room_id', v_room, 'token', v_token, 'existing', true);
  END IF;

  INSERT INTO public.profiles (id, display_name, theme)
    VALUES (v_uid,
            coalesce(nullif(trim(p_display_name),''),'Someone'),
            CASE WHEN p_theme IN ('rose','azure') THEN p_theme ELSE 'rose' END)
    ON CONFLICT (id) DO UPDATE
      SET display_name = excluded.display_name, theme = excluded.theme, updated_at = now();

  INSERT INTO public.rooms (name, created_by)
    VALUES (coalesce(nullif(trim(p_room_name),''),'Our Space'), v_uid)
    RETURNING id INTO v_room;

  INSERT INTO public.room_members (room_id, user_id) VALUES (v_room, v_uid);

  v_token := public.zeel_new_token();
  INSERT INTO public.invites (room_id, token, created_by) VALUES (v_room, v_token, v_uid);

  RETURN jsonb_build_object('room_id', v_room, 'token', v_token, 'existing', false);
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_invite(p_room_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_token text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF (SELECT count(*) FROM public.room_members WHERE room_id = p_room_id) >= 2 THEN
    RAISE EXCEPTION 'Space is already full';
  END IF;
  UPDATE public.invites SET expires_at = now() WHERE room_id = p_room_id AND used_at IS NULL;
  v_token := public.zeel_new_token();
  INSERT INTO public.invites (room_id, token, created_by) VALUES (p_room_id, v_token, v_uid);
  RETURN v_token;
END; $$;

CREATE OR REPLACE FUNCTION public.invite_preview(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.invites%ROWTYPE; v_room public.rooms%ROWTYPE; v_host text; v_count int;
BEGIN
  SELECT * INTO v_inv FROM public.invites WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'reason','not_found'); END IF;
  IF v_inv.used_at IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'reason','used'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('valid', false, 'reason','expired'); END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = v_inv.room_id;
  SELECT count(*) INTO v_count FROM public.room_members WHERE room_id = v_inv.room_id;
  IF v_count >= 2 THEN RETURN jsonb_build_object('valid', false, 'reason','full'); END IF;
  SELECT display_name INTO v_host FROM public.profiles WHERE id = v_inv.created_by;
  RETURN jsonb_build_object('valid', true, 'room_name', v_room.name, 'host_name', coalesce(v_host,'Someone'));
END; $$;

CREATE OR REPLACE FUNCTION public.join_private_space(p_token text, p_display_name text, p_theme text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_inv public.invites%ROWTYPE; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF public.is_room_member(v_inv.room_id, v_uid) THEN RETURN v_inv.room_id; END IF;
  IF v_inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  SELECT count(*) INTO v_count FROM public.room_members WHERE room_id = v_inv.room_id;
  IF v_count >= 2 THEN RAISE EXCEPTION 'This space is already full'; END IF;
  INSERT INTO public.profiles (id, display_name, theme)
    VALUES (v_uid, coalesce(nullif(trim(p_display_name),''),'Someone'),
            CASE WHEN p_theme IN ('rose','azure') THEN p_theme ELSE 'azure' END)
    ON CONFLICT (id) DO UPDATE
      SET display_name = excluded.display_name, theme = excluded.theme, updated_at = now();
  INSERT INTO public.room_members (room_id, user_id) VALUES (v_inv.room_id, v_uid);
  UPDATE public.invites SET used_by = v_uid, used_at = now() WHERE id = v_inv.id;
  RETURN v_inv.room_id;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mark_delivered(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.read_receipts (room_id, user_id, last_read_at, last_delivered_at)
  VALUES (p_room_id, v_uid, 'epoch', now())
  ON CONFLICT (room_id, user_id) DO UPDATE SET last_delivered_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.search_messages(p_room_id uuid, p_query text, p_limit int DEFAULT 40)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(p_query),'') = '' THEN RETURN; END IF;
  RETURN QUERY
    SELECT * FROM public.messages m
    WHERE m.room_id = p_room_id AND m.deleted_at IS NULL
      AND (m.body ILIKE '%' || p_query || '%' OR coalesce(m.attachment_name,'') ILIKE '%' || p_query || '%')
    ORDER BY m.created_at DESC
    LIMIT least(coalesce(p_limit, 40), 100);
END; $$;

CREATE OR REPLACE FUNCTION public.messages_around(p_room_id uuid, p_message_id uuid, p_span int DEFAULT 25)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_at timestamptz; v_span int := least(coalesce(p_span,25), 60);
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT created_at INTO v_at FROM public.messages WHERE id = p_message_id AND room_id = p_room_id;
  IF v_at IS NULL THEN RETURN; END IF;
  RETURN QUERY
    (SELECT * FROM public.messages m WHERE m.room_id = p_room_id AND m.created_at <= v_at ORDER BY m.created_at DESC LIMIT v_span)
    UNION
    (SELECT * FROM public.messages m WHERE m.room_id = p_room_id AND m.created_at > v_at ORDER BY m.created_at ASC LIMIT v_span);
END; $$;

CREATE OR REPLACE FUNCTION public.room_media(p_room_id uuid, p_kind text DEFAULT 'all', p_limit int DEFAULT 60, p_offset int DEFAULT 0)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
    SELECT * FROM public.messages m
    WHERE m.room_id = p_room_id AND m.deleted_at IS NULL AND m.attachment_path IS NOT NULL
      AND (
        p_kind = 'all'
        OR (p_kind = 'image' AND m.attachment_type LIKE 'image/%')
        OR (p_kind = 'video' AND m.attachment_type LIKE 'video/%')
        OR (p_kind = 'audio' AND m.attachment_type LIKE 'audio/%')
        OR (p_kind = 'file' AND m.attachment_type NOT LIKE 'image/%' AND m.attachment_type NOT LIKE 'video/%' AND m.attachment_type NOT LIKE 'audio/%')
      )
    ORDER BY m.created_at DESC
    LIMIT least(coalesce(p_limit,60), 120) OFFSET greatest(coalesce(p_offset,0), 0);
END; $$;

CREATE OR REPLACE FUNCTION public.room_links(p_room_id uuid, p_limit int DEFAULT 60)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
    SELECT * FROM public.messages m
    WHERE m.room_id = p_room_id AND m.deleted_at IS NULL AND m.body ~* 'https?://'
    ORDER BY m.created_at DESC LIMIT least(coalesce(p_limit,60), 120);
END; $$;

-- RPC execution rights: signed-in users only.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.create_private_space(text,text,text)',
    'public.rotate_invite(uuid)',
    'public.join_private_space(text,text,text)',
    'public.invite_preview(text)',
    'public.touch_last_seen()',
    'public.mark_delivered(uuid)',
    'public.search_messages(uuid,text,int)',
    'public.messages_around(uuid,uuid,int)',
    'public.room_media(uuid,text,int,int)',
    'public.room_links(uuid,int)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- ---------- STORAGE: private "attachments" bucket, members-only ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 104857600)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 104857600;

DROP POLICY IF EXISTS attachments_select_members ON storage.objects;
CREATE POLICY attachments_select_members ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()));
DROP POLICY IF EXISTS attachments_insert_members ON storage.objects;
CREATE POLICY attachments_insert_members ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()) AND owner = auth.uid());
DROP POLICY IF EXISTS attachments_delete_own ON storage.objects;
CREATE POLICY attachments_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid());

-- ---------- REALTIME ----------
ALTER TABLE public.messages          REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.read_receipts     REPLICA IDENTITY FULL;
ALTER TABLE public.room_members      REPLICA IDENTITY FULL;
ALTER TABLE public.profiles          REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','message_reactions','read_receipts','room_members','profiles'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
