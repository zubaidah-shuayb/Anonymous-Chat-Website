
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Someone',
  theme text NOT NULL DEFAULT 'rose' CHECK (theme IN ('rose','azure')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROOMS
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Our Space',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- MEMBERS
CREATE TABLE public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- INVITES
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  attachment_path text,
  attachment_type text,
  attachment_name text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_room_created_idx ON public.messages (room_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- REACTIONS
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- READ RECEIPTS
CREATE TABLE public.read_receipts (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.read_receipts TO authenticated;
GRANT ALL ON public.read_receipts TO service_role;
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

-- HELPERS
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

-- POLICIES
CREATE POLICY "profiles_select_self_or_partner" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_room_with(id, auth.uid()));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "rooms_select_members" ON public.rooms FOR SELECT TO authenticated
  USING (public.is_room_member(id, auth.uid()));
CREATE POLICY "rooms_update_members" ON public.rooms FOR UPDATE TO authenticated
  USING (public.is_room_member(id, auth.uid())) WITH CHECK (public.is_room_member(id, auth.uid()));

CREATE POLICY "members_select_members" ON public.room_members FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "invites_select_members" ON public.invites FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "messages_select_members" ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "reactions_select_members" ON public.message_reactions FOR SELECT TO authenticated
  USING (public.is_room_member(public.message_room(message_id), auth.uid()));
CREATE POLICY "reactions_insert_own" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(public.message_room(message_id), auth.uid()));
CREATE POLICY "reactions_delete_own" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "receipts_select_members" ON public.read_receipts FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "receipts_insert_own" ON public.read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "receipts_update_own" ON public.read_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION public.create_private_space(p_display_name text, p_theme text, p_room_name text DEFAULT 'Our Space')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_room uuid; v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.profiles (id, display_name, theme)
    VALUES (v_uid, coalesce(nullif(trim(p_display_name),''),'Someone'), CASE WHEN p_theme IN ('rose','azure') THEN p_theme ELSE 'rose' END)
    ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, theme = excluded.theme, updated_at = now();
  INSERT INTO public.rooms (name, created_by) VALUES (coalesce(nullif(trim(p_room_name),''),'Our Space'), v_uid) RETURNING id INTO v_room;
  INSERT INTO public.room_members (room_id, user_id) VALUES (v_room, v_uid);
  v_token := encode(gen_random_bytes(24),'hex');
  INSERT INTO public.invites (room_id, token, created_by) VALUES (v_room, v_token, v_uid);
  RETURN jsonb_build_object('room_id', v_room, 'token', v_token);
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_invite(p_room_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_token text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF (SELECT count(*) FROM public.room_members WHERE room_id = p_room_id) >= 2 THEN RAISE EXCEPTION 'Space is already full'; END IF;
  UPDATE public.invites SET expires_at = now() WHERE room_id = p_room_id AND used_at IS NULL;
  v_token := encode(gen_random_bytes(24),'hex');
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
    VALUES (v_uid, coalesce(nullif(trim(p_display_name),''),'Someone'), CASE WHEN p_theme IN ('rose','azure') THEN p_theme ELSE 'azure' END)
    ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, theme = excluded.theme, updated_at = now();
  INSERT INTO public.room_members (room_id, user_id) VALUES (v_inv.room_id, v_uid);
  UPDATE public.invites SET used_by = v_uid, used_at = now() WHERE id = v_inv.id;
  RETURN v_inv.room_id;
END; $$;

REVOKE ALL ON FUNCTION public.create_private_space(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_private_space(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_private_space(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_private_space(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_preview(text) TO authenticated;

-- REALTIME
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.read_receipts REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
