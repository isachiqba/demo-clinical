import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { serviceById } from '@/data/services'
import type { Appointment, Locale } from '@/types'
import { CLINIC_TIME_ZONE, addMinutesToWall, wallToInstant } from './clinicTime'

/**
 * Builds an iCalendar file for a demo appointment. Times are written as UTC stamps
 * derived from the clinic's wall clock, which is correct on both sides of a daylight
 * saving change, and the event is labelled DEMO so it cannot be mistaken for a real one.
 */

const pad = (value: number): string => String(value).padStart(2, '0')

const toUtcStamp = (wall: string): string => {
  const instant = wallToInstant(wall)
  return (
    `${instant.getUTCFullYear()}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}` +
    `T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}00Z`
  )
}

/** Escapes the characters iCalendar treats as syntax. */
const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545 asks for lines of at most 75 octets, continued with a leading space. */
const fold = (line: string): string => {
  if (line.length <= 73) return line
  const chunks: string[] = [line.slice(0, 73)]
  let rest = line.slice(73)
  while (rest.length > 72) {
    chunks.push(` ${rest.slice(0, 72)}`)
    rest = rest.slice(72)
  }
  if (rest) chunks.push(` ${rest}`)
  return chunks.join('\r\n')
}

export const buildAppointmentIcs = (appointment: Appointment, locale: Locale): string => {
  const service = serviceById(appointment.serviceId)
  const provider = providerById(appointment.providerId)
  const location = locationById(appointment.locationId)

  const serviceName = service ? service.name[locale] : appointment.serviceId
  const locationName = location ? location.name[locale] : appointment.locationId
  const title =
    locale === 'es'
      ? `[DEMO] ${serviceName} — Lorba Medical ${locationName}`
      : `[DEMO] ${serviceName} — Lorba Medical ${locationName}`

  const description =
    locale === 'es'
      ? [
          'Reserva de DEMOSTRACIÓN de Lorba Medical. No es una cita médica real.',
          `Referencia: ${appointment.reference}`,
          `Profesional: ${provider?.name ?? ''} (perfil ficticio)`,
          `Horario de la clínica: ${CLINIC_TIME_ZONE}`
        ]
      : [
          'DEMONSTRATION booking from Lorba Medical. This is not a real medical appointment.',
          `Reference: ${appointment.reference}`,
          `Clinician: ${provider?.name ?? ''} (fictional profile)`,
          `Clinic timezone: ${CLINIC_TIME_ZONE}`
        ]

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lorba Medical Demo//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appointment.reference}-${appointment.id}@lorba-medical.demo`,
    `DTSTAMP:${toUtcStamp(appointment.createdAtWall)}`,
    `DTSTART:${toUtcStamp(appointment.startWall)}`,
    `DTEND:${toUtcStamp(addMinutesToWall(appointment.startWall, appointment.durationMinutes))}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description.join('\n'))}`,
    `LOCATION:${escapeText(`Lorba Medical ${locationName} (demo)`)}`,
    'STATUS:CONFIRMED',
    'CATEGORIES:DEMO',
    'END:VEVENT',
    'END:VCALENDAR'
  ]

  return lines.map(fold).join('\r\n')
}

export const downloadIcs = (appointment: Appointment, locale: Locale): void => {
  const blob = new Blob([buildAppointmentIcs(appointment, locale)], {
    type: 'text/calendar;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lorba-medical-demo-${appointment.reference}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
