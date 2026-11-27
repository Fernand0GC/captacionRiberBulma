// Spec 033: el registro y la planificación comparten la detección del canal.
export function isFreelanceChannel(name: string | undefined): boolean {
  const normalized = (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')

  return normalized === 'freelance' || normalized === 'freelancers'
}
