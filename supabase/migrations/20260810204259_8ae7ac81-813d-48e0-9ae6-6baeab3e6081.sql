
CREATE POLICY "attachments_select_members" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments' AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY "attachments_insert_members" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments' AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()) AND owner = auth.uid());

CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());
