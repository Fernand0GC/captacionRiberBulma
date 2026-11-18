# Quickstart: validar la 004

## Preparación

```bash
cd captacionRiberBulma
corepack pnpm exec supabase migration up      # nunca db reset (ver CLAUDE.md)
corepack pnpm exec vite --port 5180 --strictPort
```

Usuarios en `RB-union/USUARIOS-LOCALES.md` (clave `Captacion.2026`).

## Pruebas automáticas

```bash
corepack pnpm exec supabase test db           # pgTAP: supabase/tests/org_goals_multi_test.sql
corepack pnpm test                            # Vitest: tests/unit/organization.test.ts
corepack pnpm exec playwright test tests/e2e/organization.spec.ts
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build && corepack pnpm size
```

## Recorrido manual

1. **Dos metas** (`enc.verdolago`, Planificación, día siguiente, «＋ Mañana»): Tienda → RRSS-Mensajería → marcar
   «Mensajería WhatsApp». Aparecen «Meta de captación» y «Meta de compartidas». Guardar sin metas → error. Con 20 y 15 → se guarda.
2. **Selección múltiple**: en el mismo formulario marcar también «Barrios chinos – grupos» con 10 y 30. Guardar → dos
   filas agrupadas, cada una con sus metas.
3. **Compartidas y estados**: solo pide «Meta de compartidas».
4. **Agregar otro**: Tienda → Tareas administrativas → «+ Agregar otro…» → «Kardex de ventas». Queda marcado y aparece
   en la carga siguiente. Escribir «kardex  de VENTAS» usa el mismo.
5. **Resultado**: en la fila de WhatsApp, «Resultado» pide captados y compartidas; la tabla muestra el cumplimiento de cada uno.
6. **Totales y Excel**: los totales muestran captación y compartidas por separado; el Excel trae las columnas nuevas.
7. **Catálogo** (`admin`): el subcanal «Kardex de ventas» figura como agregado por el encargado, con fecha; las casillas
   «Captación» y «Compartidas» se pueden cambiar por subcanal.
