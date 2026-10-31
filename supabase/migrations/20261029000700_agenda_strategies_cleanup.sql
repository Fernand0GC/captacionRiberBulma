-- Las estrategias del seed viejo que duplican a las de las planillas reales quedan inactivas (no se borran por si se usaron).
update public.agenda_strategies set active = false where name in ('Contenido', 'En vivo', 'Kardex');
