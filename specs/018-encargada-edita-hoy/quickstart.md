# Quickstart: La encargada edita la planificación de hoy

## Local

```bash
pnpm db:start                    # si no está corriendo
supabase migration up            # aplica la migración nueva (NO usar db reset)
pnpm db:test                     # pgTAP: org_assignments_test.sql en verde
pnpm dev                         # en otra terminal
pnpm e2e tests/e2e/planning-same-day.spec.ts
```

## Prueba manual

1. Entrar como `enc.trinidad` → Planificación → hoy.
2. «＋ Mañana» (o tarde) y crear una asignación de hoy.
3. La fila muestra «Resultado», «Editar» y «✕». Editar la meta y guardar: se ve la meta nueva.
4. Quitarla con «✕».
5. «Día anterior»: ninguna fila tiene «Editar» ni «✕»; «Resultado» sí.

## Producción (solo con autorización)

Archivo a aplicar: `supabase/migrations/20261123000100_org_replan_same_day.sql` (se copia también como
`../migraciones-018-produccion.sql` siguiendo la costumbre del repo).
