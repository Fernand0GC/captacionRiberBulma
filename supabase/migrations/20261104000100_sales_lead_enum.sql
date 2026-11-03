-- Rol Jefe de ventas (regional): gestiona VARIAS sucursales (no una ni todas). Va en su propia migración porque
-- un valor nuevo de enum no se puede usar en la misma transacción en que se agrega.
alter type public.app_role add value if not exists 'sales_lead' after 'branch_manager';
