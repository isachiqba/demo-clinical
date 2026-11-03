import { describe, expect, it } from 'vitest'
import { buildAppointmentIcs, canExportIcs } from '@/services/calendarFile'
import type { Appointment } from '@/types'

const appointment = (startWall: string, overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'apt-1',
  reference: 'LM-AC34',
  serviceId: 'primary-care',
  locationId: 'downtown',
  startWall,
  patientType: 'new',
  patient: {
    firstName: 'Sam',
    lastName: 'Rivera',
    email: 'sam.rivera@example.com',
    phone: '',
    coverage: 'insurance'
  },
  status: 'confirmed',
  curemd: {
    status: 'registered',
    reference: 'CMD-1',
    registered: {
      startWall,
      locationId: 'downtown',
      serviceId: 'primary-care',
      patientName: 'Sam Rivera'
    },
    declaredAtWall: '2026-01-02T11:00',
    operator: 'Demo Reception'
  },
  pendingChange: null,
  proposal: null,
  version: 3,
  createdAtWall: '2026-01-02T10:00',
  audit: [],
  ...overrides
})

const lineOf = (ics: string, prefix: string): string =>
  ics.split('\r\n').find((line) => line.startsWith(prefix)) ?? ''

describe('calendar file', () => {
  it('writes a well-formed single-event calendar', () => {
    const ics = buildAppointmentIcs(appointment('2026-01-14T09:00'), 'en')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.split('BEGIN:VEVENT')).toHaveLength(2)
    expect(ics.includes('\r\n')).toBe(true)
  })

  it('converts winter clinic time to UTC correctly (EST)', () => {
    const ics = buildAppointmentIcs(appointment('2026-01-14T09:00'), 'en')
    expect(lineOf(ics, 'DTSTART:')).toBe('DTSTART:20260114T140000Z')
    expect(lineOf(ics, 'DTEND:')).toBe('DTEND:20260114T141000Z')
  })

  it('converts summer clinic time to UTC correctly (EDT)', () => {
    const ics = buildAppointmentIcs(appointment('2026-07-14T09:00'), 'en')
    expect(lineOf(ics, 'DTSTART:')).toBe('DTSTART:20260714T130000Z')
    expect(lineOf(ics, 'DTEND:')).toBe('DTEND:20260714T131000Z')
  })

  it('marks the event as a demo in both languages', () => {
    for (const locale of ['en', 'es'] as const) {
      const ics = buildAppointmentIcs(appointment('2026-05-05T11:20'), locale)
      expect(lineOf(ics, 'SUMMARY:')).toContain('[DEMO]')
      expect(ics).toContain('CATEGORIES:DEMO')
      expect(ics).toContain('LM-AC34')
      expect(ics).toContain('America/New_York')
    }
    expect(buildAppointmentIcs(appointment('2026-05-05T11:20'), 'es')).toContain('DEMOSTRACIÓN')
    expect(buildAppointmentIcs(appointment('2026-05-05T11:20'), 'en')).toContain('DEMONSTRATION')
  })

  it('is offered only for an appointment the clinic has confirmed', () => {
    expect(canExportIcs(appointment('2026-05-05T11:20'))).toBe(true)

    // A request is not an appointment yet.
    expect(
      canExportIcs(
        appointment('2026-05-05T11:20', {
          status: 'requested',
          curemd: {
            status: 'pending-registration',
            reference: null,
            registered: null,
            declaredAtWall: null,
            operator: null
          }
        })
      )
    ).toBe(false)

    // Nor is a move reception has not yet applied in CureMD.
    expect(
      canExportIcs(
        appointment('2026-05-05T11:20', {
          curemd: {
            status: 'change-pending',
            reference: 'CMD-1',
            registered: {
              startWall: '2026-05-05T11:20',
              locationId: 'downtown',
              serviceId: 'primary-care',
              patientName: 'Sam Rivera'
            },
            declaredAtWall: '2026-01-02T11:00',
            operator: 'Demo Reception'
          },
          pendingChange: {
            startWall: '2026-05-06T09:00',
            locationId: 'downtown',
            requestedAtWall: '2026-05-01T09:00',
            source: 'reception',
            offerId: null
          }
        })
      )
    ).toBe(false)
  })

  it('escapes newlines and folds long lines to the iCalendar limit', () => {
    const ics = buildAppointmentIcs(appointment('2026-05-05T11:20'), 'en')
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75)
    }
    // The description is one logical line: its breaks are escaped, and the physical
    // continuation lines start with a space.
    const description = ics.slice(ics.indexOf('DESCRIPTION:'))
    expect(description).toContain('\\n')
    expect(description.split('\r\n')[1].startsWith(' ')).toBe(true)
  })
})
