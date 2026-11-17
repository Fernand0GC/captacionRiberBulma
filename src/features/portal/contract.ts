// Copia de los tipos públicos de barra-comun (src/contrato.ts v1 y contracts/puente.md `rb-puente/1`).
// No se modifican acá: el contrato manda. Sin dependencia del paquete (Captación no usa la barra, solo el puente).

/** Sistemas del catálogo fijo, en su orden oficial. */
export type IdSistema = 'captacion' | 'cobros' | 'seguimiento' | 'panel-web'

export interface Aviso {
  /** Único dentro de la lista. */
  id: string
  texto: string
  /** Sistema de origen. */
  sistema: IdSistema
  /** ISO 8601 con zona horaria, p. ej. "2026-11-16T08:14:00-04:00". */
  fecha: string
  url?: string
}

export const PROTOCOLO = 'rb-puente/1'

/** Tema que manda el portal (el puente solo usa claro/oscuro). */
export type TemaPuente = 'claro' | 'oscuro'

type Base = { protocolo: typeof PROTOCOLO }

export type MensajeSistema = Base &
  (
    | { tipo: 'listo'; sistema: IdSistema }
    | { tipo: 'avisos'; sistema: IdSistema; avisos: Aviso[] }
    | { tipo: 'ruta'; sistema: IdSistema; ruta: string }
    | { tipo: 'sesion-cerrada'; sistema: IdSistema }
  )

export type MensajePortal = Base &
  (
    | { tipo: 'bienvenida'; tema: TemaPuente }
    | { tipo: 'tema'; tema: TemaPuente }
    | { tipo: 'abrir'; ruta: string }
    | { tipo: 'salir' }
  )
