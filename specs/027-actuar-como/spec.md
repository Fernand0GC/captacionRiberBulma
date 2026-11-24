# Spec 027 · Actuar como (Sistemas)

**Created**: 2026-11-24 · **Status**: implementada en local, pendiente de QA del PO.
**Input**: «Como Sistemas no puedo entrar como eneas ni como nadie para probar; en Cobros ya existe "Actuar como"».
Mismo modelo que Cobros (sistemaNotion, spec 009 FR-029–FR-033), adaptado a Supabase.

## Decisiones (PO: «lo recomendado», 2026-11-24)
- Solo **admin (Sistemas)** puede actuar como otro. No es un permiso asignable.
- Como cualquier usuario **activo**, excepto él mismo y otros admin. Sin encadenar.
- **Puede guardar**: se aplica con los permisos de la otra persona; la auditoría guarda al admin como autor real.
- Dura **30 minutos** o hasta «Volver a mi cuenta»; vuelve sin pedir contraseña.
- Banda siempre visible: «Actuando como {nombre} ({rol}) · mm:ss · Volver a mi cuenta».
- Mientras actúa no se usan las acciones de usuarios (Edge Function `admin-users`): se rechazan.

## Diseño
Supabase no deja emitir tokens propios con las llaves nuevas, así que **no se emite ningún token**: el admin sigue con
su sesión y la app manda la cabecera `x-actuar-como: <id de la suplantación>`. Una función *pre-request* de PostgREST
(`public.apply_impersonation`, corre antes de cada consulta) valida en la tabla `impersonations` que esa suplantación
sea del admin, esté abierta y vigente, y reemplaza los claims: `sub` = la persona, `act.sub` = el admin (RFC 8693, igual
que Cobros). Así `auth.uid()` devuelve a la persona y **todas las RLS y RPC existentes funcionan sin cambios**.
- `impersonation_start(p_target)` / `impersonation_end()`: abren y cierran (solo por RPC; la tabla no se lee directo).
- `audit_log.acting_by`: el admin real en cada cambio auditado hecho mientras actuaba.
- La app recarga al empezar y al volver (no quedan datos en caché de la otra identidad).
- Captaciones sin señal: cada una ya guarda su `userId`; el envío solo corre para la identidad activa, así que nunca se
  suben con la identidad equivocada. Al volver con pendientes de la persona se avisa.

## Criterios de aceptación
1. Dado un admin, cuando actúa como un auxiliar, entonces ve el menú, la sucursal y los datos del auxiliar, con la banda.
2. Dado que actúa como alguien, cuando guarda (p. ej. registra un cliente), entonces se aplica con los permisos de esa
   persona y la auditoría guarda al admin en `acting_by`.
3. Dado que actúa como alguien, cuando pulsa «Volver a mi cuenta» o pasan 30 min, entonces vuelve a su sesión sin clave.
4. **Permisos**: un usuario que no es admin no puede empezar (`forbidden`), ni por pantalla ni por llamada directa; nadie
   puede usar la suplantación de otro admin (cabecera robada): `impersonation_invalid`.
5. **Error**: con una suplantación vencida o cerrada, la consulta se rechaza con `impersonation_invalid` y la app vuelve
   sola a la cuenta del admin.
6. No se puede actuar como uno mismo, como otro admin ni como un usuario inactivo; tampoco encadenar.

## Deshacer
`alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';` desactiva todo al instante
(la cabecera se ignora). La tabla y la columna pueden quedar.
