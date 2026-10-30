ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS pdf_path text;
CREATE POLICY "cours pdf lecture" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cours-pdf');
CREATE POLICY "cours pdf ajout" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cours-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cours pdf suppression" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cours-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);