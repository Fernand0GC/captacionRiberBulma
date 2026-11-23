# Quickstart: validar la 023

## Requisitos

- Supabase local levantado (`pnpm db:start`) y migraciones al día con `supabase migration up` (**nunca** `db reset`).
- App en `pnpm dev`; usuario jefe de ventas o encargado de prueba, y una auxiliar con clientes asignados.

## Pruebas automáticas

```bash
pnpm db:test          # pgTAP: supabase/tests/recontacto_test.sql (y el resto)
pnpm test             # Vitest: agenda.test.ts, activity.test.ts
pnpm typecheck && pnpm lint
pnpm e2e tests/e2e/recontacto.spec.ts
```

## Prueba manual

1. Como auxiliar: registra «No contestó» a un cliente → queda en Recaptación para mañana 9:00.
2. Con SQL local, mueve su `next_contact_at` a hoy 9:00 → en «Mis contactos» de la auxiliar aparece en «Para hoy».
3. Como jefa: «Del día» (hoy) → la fila de la auxiliar muestra Le tocaba hoy 1 · Pendientes 1, igual que su tarjeta.
4. La auxiliar lo vuelve a llamar → la jefa refresca: Contactó 1 · Pendientes 0.
5. Actividad «Hoy» → ese contacto suma en «Recontacto»; uno a un cliente nuevo suma en «Primer contacto»; ambas columnas
   suman el Total.
6. Seguimientos «Este mes» + Contar por «Próximo contacto» → aparecen clientes registrados el mes anterior y agendados
   este mes; con «Registro» los totales son los de antes.
7. Excel de las tres vistas: hoja «Agenda», columnas nuevas y título con la fecha contada.

Limpieza: `pnpm db:clean`.
