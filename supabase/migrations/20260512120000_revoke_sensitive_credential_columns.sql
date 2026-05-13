-- Prevent anon and authenticated roles from reading encrypted credential columns.
-- All server-side reads of these columns must use the service_role client.
revoke select (boxful_password, pixelpay_secret_key)
  on public.tiendas
  from anon, authenticated;
