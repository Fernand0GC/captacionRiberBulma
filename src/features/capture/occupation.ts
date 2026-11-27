// Spec 031, observación 12 de ventas: en Messenger y Marketplace no se conoce la ocupación del cliente.
export function asksOccupation(channelName: string | undefined): boolean {
  const normalized = (channelName ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')

  return normalized !== 'messenger' && normalized !== 'marketplace'
}
