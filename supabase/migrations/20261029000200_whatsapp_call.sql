-- Las auxiliares también llaman por WhatsApp (pedido 2026-10-29): medio de contacto propio para distinguirlo
-- de la llamada telefónica en el historial y en las métricas.
alter type public.contact_method add value if not exists 'whatsapp_call' after 'call';
