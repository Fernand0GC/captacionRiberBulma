# Quickstart: validar Monitoreo de seguimiento

## Requisitos previos

- Supabase local corriendo (`pnpm db:start`).
- Migración nueva aplicada **sin reset**: `supabase migration up` (nunca `supabase db reset`: pisa los catálogos editados en Studio).
- Datos de prueba: `pnpm db:demo` (o los que ya tengas); limpiar después con `pnpm db:clean`.
- `pnpm dev` y usuarios de prueba: un encargado, un jefe de ventas con 2 sucursales, un gerente, una auxiliar.

## Pruebas automáticas

```bash
pnpm db:test      # incluye followup_status_test.sql y agent_activity_test.sql
pnpm test         # unit: search, activity, contactSummary
pnpm e2e tests/e2e/monitoring.spec.ts
pnpm typecheck && pnpm lint && pnpm size
```

`pnpm size` no debe subir el JS inicial (las vistas nuevas van en chunks lazy).

## Escenarios manuales

1. **Seguimientos (US1)**: como encargado, `/gestion?ver=seguimiento&periodo=mes`.
   - La suma de las pestañas (sin Todos) es igual a Todos.
   - Un cliente con contactos muestra la observación del más reciente; sin observación, muestra su resultado.
   - Un cliente sin contactos muestra 0 · 0, sin último contacto y días contados desde el registro.
   - Activar "Vencidos": solo clientes con próximo contacto pasado; el más atrasado arriba.
   - Filtrar Interés "Alto", Intentos "3+", "Sin contacto > 7 días": cada filtro reduce coherentemente.
   - En celular (375 px): tarjetas, sin scroll horizontal de la página.
2. **Permisos**: como encargado, cambiar `sucursal=` en la URL a otra sucursal → error/forbidden, no datos. Como jefe de ventas: solo sus 2 sucursales en el selector. Como auxiliar: `/gestion` no accesible.
3. **Actividad (US2)**: como auxiliar, registrar hoy 2 llamadas por WhatsApp (una "No contestó", otra "Visitará la tienda") y 1 mensaje "Compró". Como encargado, `?ver=actividad&periodo=hoy`:
   - Fila de la auxiliar: Llamadas 2, Mensajes 1, Efectivos 2, No contestó 1, Visitas 1, Ventas 1, Clientes 2–3, Total 3.
   - Otra auxiliar sin contactos aparece en cero. El encargado aparece solo si hizo contactos.
   - Totales = suma de filas. Ordenar por Ventas funciona.
   - Reasignar uno de esos clientes a otra persona: el conteo de la auxiliar no cambia.
4. **Detalle (US3)**: tocar "Visitas 1" → diálogo con 1 contacto "Visitará la tienda"; tocarlo → ficha del cliente; "Atrás" → misma vista y filtros.
5. **Ficha (US4)**: en `/cliente/$id` de un cliente contactado por dos personas, el bloque "Contactos por persona" coincide con el Historial.
6. **Excel (US5)**: exportar Seguimientos con pestaña "Cliente potencial": mismas filas que la pantalla y observación completa. Exportar Actividad: mismas filas + TOTAL.
7. **Bordes**: anular un cliente (Sistemas) → desaparece de ambas vistas y de los conteos. Contacto registrado a las 23:50 hora La Paz cuenta en ese día.
