import { createContext, useContext } from 'react'

/** true solo después de la `bienvenida` del portal (puente.md). Fuera del portal, siempre false. */
export const PortalModeContext = createContext(false)

export const usePortalMode = () => useContext(PortalModeContext)
