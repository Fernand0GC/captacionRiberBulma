-- Rol Cobros (spec 006, 2026-11-18): verifica las compartidas de sus sucursales; no accede a datos de clientes.
-- Va en su propia migración porque un valor nuevo de enum no se puede usar en la misma transacción en que se agrega
-- (research R7/R8). Lo usa 20261118002100_ajustes_ventas_2.sql.
alter type public.app_role add value if not exists 'collections';
