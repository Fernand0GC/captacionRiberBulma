---
description: "Task list for 002-cuenta-unica-portal"
---

# Tasks: Captación dentro del portal

**Input**: `specs/002-cuenta-unica-portal/` (spec.md, plan.md) y los contratos de `barra-comun`.
**Tests**: Vitest para la lógica pura, pgTAP para `profiles.ci`, humo con `curl` para el flujo OIDC. Un commit por tarea.

## Phase 1: Setup

- [X] T001 Spec, plan y tasks en `specs/002-cuenta-unica-portal/`

## Phase 2: Identidad (US4)

- [X] T002 Migración `profiles.ci` (`supabase/migrations/20261116000100_profiles_ci.sql`) + pgTAP `supabase/tests/profiles_ci_test.sql`; aplicar con `migration up` en la base local; CI `7788990-1B` en `aux.verdolago`
- [X] T003 `ci` en `admin-users` (create/update, normalizado, duplicado → 409) y en la pantalla Usuarios (`UserForm`, `UsersPage`, `api.ts`), con `normalizeCi` probado en `tests/unit/ci.test.ts`

## Phase 3: Cuenta única (US1)

- [X] T004 Edge Function `supabase/functions/cuenta-unica/` (`oidc.ts` puro + `index.ts`), `verify_jwt = false` en `config.toml`, `supabase/functions/.env.example`; pruebas de `oidc.ts` en `tests/unit/sso.test.ts`
- [X] T005 SPA: botón y mensajes `?sso` en `LoginPage`, ruta `/ingreso-unico` (`SsoLanding.tsx`), `VITE_CUENTA_UNICA` en `.env.example`

## Phase 4: Portal (US3, US2)

- [X] T006 `frame-ancestors` en `vercel.json` y en `vite.config.ts` (`VITE_PORTAL_ORIGEN`)
- [ ] T007 Puente: `src/features/portal/contract.ts` + `bridge.ts` con pruebas `tests/unit/portal-bridge.test.ts`
- [ ] T008 `LogoutProvider` (flujo de Salir reutilizable) + `PortalProvider` + modo portal en `AppShell` + avisos lazy (`notices.ts`, `tests/unit/portal-notices.test.ts`)

## Phase 5: Cierre

- [ ] T009 Verificaciones (`typecheck`, `lint`, `test`, `build`, `size`, `db:test` contra la base 56322, humo OIDC) y `qa/handoff.md`
