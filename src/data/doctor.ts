import type { ClinicBlock, DoctorProfile } from '@/types'

/**
 * The one doctor this practice is. Everything about him lives here so that swapping in a
 * real person is a single-file change.
 *
 * Deliberately absent, and it should stay that way: no degrees, licence numbers, board
 * certifications, years of experience, hospital affiliations, awards or patient reviews.
 * `care` below says what kind of care is offered, which is not the same as claiming a
 * qualification. The portrait is a stand-in and is labelled as illustrative wherever it
 * appears (see `public/images/CREDITS.md`).
 */

/**
 * The weekly consulting schedule: when the doctor sits in which clinic.
 *
 * This is the **single agenda** the whole demo books against. Two rules hold it together,
 * and `tests/doctorSchedule.test.ts` enforces both:
 *
 *  1. No two blocks overlap. One person cannot be in two clinics at once.
 *  2. Blocks at different clinics on the same day are separated by at least
 *     `TRAVEL_BUFFER_MINUTES`, so he has time to get there.
 *
 * Every block must also sit inside its clinic's opening hours — a clinic can be open when
 * he is not there, but he is never there when it is shut.
 *
 * `pause` is a break inside a block: no appointments are offered in that window.
 */
const blocks: ClinicBlock[] = [
  // Monday
  { weekday: 1, locationId: 'downtown', startsAt: 8 * 60, endsAt: 12 * 60 },
  { weekday: 1, locationId: 'northside', startsAt: 14 * 60, endsAt: 18 * 60, pause: [16 * 60, 16 * 60 + 20] },

  // Tuesday
  { weekday: 2, locationId: 'northside', startsAt: 8 * 60 + 30, endsAt: 13 * 60, pause: [10 * 60 + 30, 10 * 60 + 50] },
  { weekday: 2, locationId: 'westside', startsAt: 14 * 60 + 30, endsAt: 17 * 60 },

  // Wednesday
  { weekday: 3, locationId: 'westside', startsAt: 9 * 60, endsAt: 13 * 60 },
  { weekday: 3, locationId: 'downtown', startsAt: 15 * 60, endsAt: 19 * 60, pause: [17 * 60, 17 * 60 + 20] },

  // Thursday
  { weekday: 4, locationId: 'downtown', startsAt: 8 * 60, endsAt: 12 * 60 },
  { weekday: 4, locationId: 'westside', startsAt: 13 * 60 + 30, endsAt: 16 * 60 + 30 },

  // Friday
  { weekday: 5, locationId: 'northside', startsAt: 8 * 60 + 30, endsAt: 12 * 60 + 30 },
  { weekday: 5, locationId: 'downtown', startsAt: 14 * 60, endsAt: 17 * 60 },

  // Saturday morning, one clinic only.
  { weekday: 6, locationId: 'downtown', startsAt: 9 * 60, endsAt: 13 * 60 }

  // Sunday: no consulting.
]

/**
 * How long he needs between leaving one clinic and seeing the first patient at another.
 * Provisional, like the slot capacity: a real number would come from the practice.
 */
export const TRAVEL_BUFFER_MINUTES = 45

export const doctor: DoctorProfile = {
  name: 'Dr. Lorba',
  initials: 'DL',
  /** What kind of care is offered — not a credential. */
  care: { en: 'Internal medicine', es: 'Medicina interna' },
  tagline: {
    en: 'One doctor, three clinics, the same notes every time.',
    es: 'Un solo médico, tres consultas y las mismas notas en cada visita.'
  },
  /**
   * His introduction, a paragraph per entry. Written for patients, so it says what the
   * practice covers and how it works — never a qualification, a registration or a number
   * of years, none of which this demo claims.
   */
  bio: [
    {
      en: 'Dr. Lorba offers internal medicine care with a close, personal approach. His aim is to listen to each patient, understand what they need and support them in looking after their health.',
      es: 'El Dr. Lorba ofrece atención en medicina interna con un enfoque cercano y personalizado. Su propósito es escuchar a cada paciente, comprender sus necesidades y acompañarlo en el cuidado de su salud.'
    },
    {
      en: 'His practice covers prevention, health reviews and the care of acute and long-term conditions, with clear explanations so that every patient understands the next steps in their care.',
      es: 'Su consulta abarca la prevención, las revisiones de salud y la atención de enfermedades agudas y crónicas, con explicaciones claras para que cada paciente comprenda los siguientes pasos de su atención.'
    },
    {
      en: 'He sees patients in English and Spanish and consults at three locations, so you can choose whichever clinic suits you best.',
      es: 'Atiende en inglés y español y pasa consulta en tres ubicaciones, para que pueda elegir la sede que le resulte más cómoda.'
    }
  ],
  invitation: {
    en: 'Request an appointment and take the next step in looking after your health.',
    es: 'Solicite su cita y dé el siguiente paso en el cuidado de su salud.'
  },
  /** Add or remove codes here; the page lists whatever is set. */
  languages: ['en', 'es'],
  image: '/images/doctor-lorba.webp',
  imageIsIllustrative: true,
  blocks,
  travelBufferMinutes: TRAVEL_BUFFER_MINUTES
}

/** The consulting blocks on one weekday, earliest first. */
export const blocksOnWeekday = (weekday: number): ClinicBlock[] =>
  doctor.blocks
    .filter((block) => block.weekday === weekday)
    .sort((a, b) => a.startsAt - b.startsAt)

/** The blocks he holds at one clinic on one weekday. */
export const blocksAt = (weekday: number, locationId: ClinicBlock['locationId']): ClinicBlock[] =>
  blocksOnWeekday(weekday).filter((block) => block.locationId === locationId)

/** The clinics he sits in at all, in the order the site lists them. */
export const clinicsHeAttends = (): ClinicBlock['locationId'][] => [
  ...new Set(doctor.blocks.map((block) => block.locationId))
]
