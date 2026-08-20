ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS attachment_width int,
  ADD COLUMN IF NOT EXISTS attachment_height int,
  ADD COLUMN IF NOT EXISTS attachment_duration numeric,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.read_receipts ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS messages_room_created_idx ON public.messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_room_attachment_idx ON public.messages (room_id, created_at DESC) WHERE attachment_path IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS reactions_message_idx ON public.message_reactions (message_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS messages_body_trgm_idx ON public.messages USING gin (body gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mark_delivered(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.read_receipts (room_id, user_id, last_read_at, last_delivered_at)
  VALUES (p_room_id, v_uid, 'epoch', now())
  ON CONFLICT (room_id, user_id) DO UPDATE SET last_delivered_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.search_messages(p_room_id uuid, p_query text, p_limit int DEFAULT 40)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_room_member(p_room_id, v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
    SELECT * FROM public.messages m
    WHERE m.room_id = p_room_id AND m.deleted_at IS NULL AND m.body ~* 'https?://'
    ORDER BY m.created_at DESC LIMIT least(coalesce(p_limit,60), 120);
END; $$;