-- RLS: permite role 'wedding' acessar todas as tabelas do casamento (SELECT + INSERT + UPDATE + DELETE)

-- wedding_installments
CREATE POLICY "wedding_role_wedding_installments"
  ON public.wedding_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'wedding'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'wedding'::public.app_role));

-- wedding_vendors
CREATE POLICY "wedding_role_wedding_vendors"
  ON public.wedding_vendors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'wedding'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'wedding'::public.app_role));

-- wedding_vendor_payments
CREATE POLICY "wedding_role_wedding_vendor_payments"
  ON public.wedding_vendor_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'wedding'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'wedding'::public.app_role));

-- wedding_budget
CREATE POLICY "wedding_role_wedding_budget"
  ON public.wedding_budget FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'wedding'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'wedding'::public.app_role));
