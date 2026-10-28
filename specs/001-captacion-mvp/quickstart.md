# Quickstart: validación del MVP de captación (001)

Guía para levantar el proyecto en local y comprobar de punta a punta que cumple la spec.
Los detalles están en [data-model.md](data-model.md) y [contracts/](contracts/).

## Prerrequisitos
- Node 24, pnpm
- Docker (para Supabase local) y Supabase CLI
- Chrome (para Playwright y para probar en celular con DevTools)

## Levantar en local
```bash
pnpm install
supabase start                 # Postgres + Auth locales, aplica supabase/migrations y supabase/seed.sql
cp .env.example .env.local     # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY que imprime `supabase start`
pnpm dev
```
El seed crea las 10 sucursales, los catálogos y un usuario de prueba por rol (credenciales en `supabase/seed.sql`, solo para local).

## Pruebas automáticas
```bash
pnpm test            # Vitest: teléfono, UUID v7, outbox, turno, transiciones
supabase test db     # pgTAP: matriz de permisos rol × acción, RPC, idempotencia, duplicados
pnpm e2e             # Playwright: flujos de campo offline/online y de gestión
pnpm build && pnpm size   # presupuesto de bundle (≤170 KB gzip JS inicial)
```

## Escenarios de validación manual

| # | Escenario | Resultado esperado | Cubre |
|---|---|---|---|
| 1 | Volantero: registrar 5 captaciones con red | Cada Guardar vuelve a Registrar; el contador sube a 5 | US1, SC-001 |
| 2 | DevTools → Offline; registrar 5 más; volver online | Insignia "5 por subir"; en menos de 2 min sube a 0; el contador queda en 10; en gestión aparecen 10 | US1, SC-002, SC-003 |
| 3 | Offline: registrar; cerrar la pestaña; reabrir | La pendiente sigue y se sube | Edge cases |
| 4 | Con red: registrar un teléfono existente (con otro formato: `+591 7…`) | Bloqueado, "teléfono ya registrado"; no muestra datos de la ficha | FR-016 |
| 5 | Offline: dos usuarios registran el mismo teléfono; ambos vuelven online | Uno queda vigente y el otro en `/gestion/duplicados`; el segundo autor ve el aviso | FR-017 |
| 6 | Volantero: abrir `/gestion` y llamar a `rest/v1/prospects` con su token | Redirección en la UI; la API devuelve 0 filas | SC-005, FR-007 |
| 7 | Encargado VERDOLAGO: listado | Solo VERDOLAGO; editar una ficha deja auditoría | US2 |
| 8 | Encargado: asignar 3 prospectos a un auxiliar; el auxiliar abre `/seguimiento` | Ve solo esos 3; registra una gestión; pasa uno a Venta | US3 |
| 9 | Pasar a Sin interés sin motivo / reabrir una Venta | Ambos rechazados | FR-031, máquina de estados |
| 10 | Encargado: agenda de mañana con 6 actividades; copiar al día siguiente; cerrar 2 | Copias en pendiente; cumplimiento calculado | US4 |
| 11 | Gerente: meta VERDOLAGO/CELULARES = 10; 3 ventas con producto de la línea CELULARES | Avance 30%, objetivo diario = 7 ÷ días restantes | US5, FR-052 |
| 12 | Exportar una semana de VERDOLAGO | Hojas CLIENTES, INFORMES, AGENDA y GERENCIA; los totales coinciden con la app | US6, SC-007 |
| 13 | Admin: desactivar a un volantero que tiene pendientes offline (creados antes) | Al volver la red (dentro de los 7 días) se suben las anteriores a la baja, marcadas "subidas tras baja"; ve "Usuario desactivado" y se cierra la sesión | US7, R9 |
| 14 | Lighthouse con Moto G Power y 3G lento en `/registrar` | Interactivo en ≤3 s; con la PWA instalada y sin red abre igual | SC-004 |

## Lo que no prueba el entorno local
- Carga de 90 usuarios en simultáneo (SC-006): se mide con k6 contra un proyecto de **staging** (T082).
- Señal real en campo y celulares reales de las sucursales (SC-009): se validan en un piloto en una sucursal antes del despliegue general (constitución, principio V).
