# Quickstart: probar la 022 en local

## Aplicar la migración (solo base local)

```sh
docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261123002200_my_contacts_assigned_at.sql
```

## Tests

```sh
pnpm test tests/unit/dueStatus.test.ts tests/unit/inboxView.test.ts
docker exec -i supabase_db_riber-captacion psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/tests/my_contacts_assigned_test.sql
pnpm build && pnpm exec playwright test tests/e2e/my-contacts-late.spec.ts   # preguntar antes si otra pestaña corre Playwright
```

## Prueba manual (http://localhost:5180)

Sirven los 400 clientes «Vol 021» que ya están en la base local (de `specs/021-asignados-depurar/seed-volumen-021.sql`):
asignados a la Auxiliar Verdolago el sábado 21, el domingo 22 y hoy 23. No hace falta otro seed.

1. Entrar como `aux.verdolago` (clave `Captacion.2026`) → «Mis contactos».
2. Arriba: tres tarjetas «Para hoy», «Atrasados», «Contactados hoy» con números.
3. «Captados» muestra los grupos «Hoy» (abierto), «Ayer · N atrasados» y «Sáb 21 · N atrasados» (cerrados).
   El grupo «Hoy» dibuja 25 filas, con «Filas» (10/25/50/100), «1–25 de N» y el paginador en su franja.
4. Abrir «Ayer»: cada fila dice «Atrasado · asignado hace 1 día»; las del sábado, «hace 2 días».
5. Columna «Asignado» (en computadora): fecha y hora de la asignación y «por Encargado Verdolago».
6. Tocar «Atrasados»: solo quedan los de días anteriores; tocarla otra vez vuelve todo.
7. Lupa con «Vol 021 Sáb 007»: aparece aunque su grupo estaba cerrado.
8. Elegir 50 en «Filas» y recargar: sigue en 50 (se recuerda en ese navegador).
9. La pestaña dice «Captados N ⚠ M» o «Captados N ⚠», nunca el mismo número dos veces.
