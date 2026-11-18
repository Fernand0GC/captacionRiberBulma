# Quickstart: validar la 005

## Preparación

```bash
cd captacionRiberBulma
corepack pnpm exec supabase migration up      # nunca db reset
corepack pnpm exec vite --port 5180 --strictPort
```

## Pruebas automáticas

```bash
corepack pnpm exec supabase test db           # supabase/tests/referrals_test.sql
corepack pnpm test                            # tests/unit/referrals.test.ts
corepack pnpm exec playwright test tests/e2e/referrals.spec.ts
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build && corepack pnpm size
```

## Recorrido manual

1. **Referidores** (`jefe.ventas`, menú «Referidos» → «Referidores y metas», Verdolago): crear «Contacto Fernanda»
   (Personal, meta 20) y «Freelance Walker» (Freelance, meta 10).
2. **Registro** (`aux.verdolago`, Registrar → Nuevo registro): marcar «Es referido» → «Contacto Fernanda». Repetir
   sin señal (modo avión del navegador) y comprobar que se sube al volver la señal.
3. **Duplicado**: registrar como referido de Walker un celular que ya existe → se rechaza como siempre y no cuenta en el reporte.
4. **Ficha** (`enc.verdolago`): el contacto muestra «Referido por: Contacto Fernanda»; corregirlo a Walker deja la
   edición en el historial.
5. **Reporte** (`jefe.ventas`): filas por referidor con llegados, compraron, %, meta y cumplimiento; abrir un referidor muestra sus contactos; «Por día» muestra la grilla del mes; Excel.
6. **Permisos**: `enc.verdolago` no ve el menú y la dirección `/referidos` no le muestra datos (la base responde `forbidden`).
