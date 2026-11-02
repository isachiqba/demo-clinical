import type { LocationId, Provider, ServiceId } from '@/types'

/**
 * Three demonstration profiles. Names are invented and the portraits are illustrative
 * stand-ins (see `public/images/CREDITS.md`). No qualifications, registrations, awards
 * or ratings are claimed anywhere, because none of these people exist.
 */
export const providers: Provider[] = [
  {
    id: 'ap-elena-sandoval',
    name: 'Elena Sandoval',
    role: { en: 'Primary care clinician', es: 'Profesional de medicina general' },
    languages: ['en', 'es'],
    serviceIds: ['primary-care', 'annual-wellness', 'follow-up', 'non-emergency'],
    locationIds: ['downtown', 'northside'],
    about: {
      en: 'Sees patients for everyday care and yearly reviews, and keeps the same patients over time.',
      es: 'Atiende consultas cotidianas y revisiones anuales, y mantiene a los mismos pacientes a lo largo del tiempo.'
    },
    image: '/images/team-1.webp',
    initials: 'ES'
  },
  {
    id: 'ap-marcus-feld',
    name: 'Marcus Feld',
    role: { en: 'Primary care clinician', es: 'Profesional de medicina general' },
    languages: ['en'],
    serviceIds: ['primary-care', 'follow-up', 'non-emergency'],
    locationIds: ['downtown', 'westside'],
    about: {
      en: 'Holds later appointments twice a week for people who cannot come during working hours.',
      es: 'Pasa consulta en horario de tarde dos días por semana para quienes no pueden venir en horario laboral.'
    },
    image: '/images/team-2.webp',
    initials: 'MF'
  },
  {
    id: 'ap-howard-brennan',
    name: 'Howard Brennan',
    role: { en: 'Primary care clinician', es: 'Profesional de medicina general' },
    languages: ['en', 'es'],
    serviceIds: ['primary-care', 'annual-wellness', 'follow-up'],
    locationIds: ['northside', 'westside'],
    about: {
      en: 'Takes longer wellness appointments and unhurried follow-ups, often with older patients.',
      es: 'Dedica más tiempo a las revisiones anuales y a los seguimientos sin prisa, a menudo con pacientes mayores.'
    },
    image: '/images/team-3.webp',
    initials: 'HB'
  }
]

export const providerById = (id: string): Provider | undefined =>
  providers.find((provider) => provider.id === id)

/** Clinicians who offer `serviceId`, optionally narrowed to one clinic. */
export const providersFor = (serviceId: ServiceId, locationId?: LocationId): Provider[] =>
  providers.filter(
    (provider) =>
      provider.serviceIds.includes(serviceId) &&
      (!locationId || provider.locationIds.includes(locationId))
  )
