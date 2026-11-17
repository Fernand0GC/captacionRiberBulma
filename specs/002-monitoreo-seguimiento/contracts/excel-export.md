# Contrato Excel: Monitoreo

Ambos con `exceljs` cargado de forma dinámica; fechas "de pared" en hora de La Paz (mismo ajuste que `exportProspects.ts`). Encabezado en la fila 1: vista, sucursal (o "Todas") y rango de fechas; fila de títulos congelada.

## `Seguimientos_<sucursal>_<desde>_<hasta>.xlsx` — hoja `SEGUIMIENTOS`

Todas las filas del filtro y la pestaña activa (pagina de a 200 hasta completar), en el mismo orden que la pantalla.

Columnas: Cliente · Celular · Sucursal · Responsable · Etapa · Interés · No contestó seguidos · Contactos totales · Último contacto (fecha y hora) · Forma · Resultado · Hecho por · Observación (**completa**) · Próximo contacto · Vencido (Sí/No) · Días sin contacto · Motivo sin interés · Canal · Registrado por · Fecha de registro.

## `Actividad_<sucursal>_<desde>_<hasta>.xlsx` — hoja `ACTIVIDAD`

Una fila por persona (orden de la pantalla) y fila **TOTAL** al final.

Columnas: Personal · Rol · Activo · Llamadas · Mensajes · En tienda · Efectivos · No contestó · Visitas pactadas · Ventas · Clientes contactados · Total de contactos.
