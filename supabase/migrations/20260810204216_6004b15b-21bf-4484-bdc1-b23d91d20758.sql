
REVOKE ALL ON FUNCTION public.is_room_member(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shares_room_with(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.message_room(uuid) FROM PUBLIC, anon, authenticated;
