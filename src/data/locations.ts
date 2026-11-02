import type { ClinicLocation, LocationId, OpeningHours } from '@/types'

/**
 * Three fictional clinics in an invented town. They are described by surroundings
 * rather than by a street address, so nothing here can be mistaken for a real practice.
 */
const hours = (weekdayOpen: number, weekdayClose: number, saturday?: [number, number]): OpeningHours[] => [
  { weekday: 0, opensAt: null, closesAt: null },
  { weekday: 1, opensAt: weekdayOpen, closesAt: weekdayClose },
  { weekday: 2, opensAt: weekdayOpen, closesAt: weekdayClose },
  { weekday: 3, opensAt: weekdayOpen, closesAt: weekdayClose },
  { weekday: 4, opensAt: weekdayOpen, closesAt: weekdayClose },
  { weekday: 5, opensAt: weekdayOpen, closesAt: weekdayClose },
  {
    weekday: 6,
    opensAt: saturday ? saturday[0] : null,
    closesAt: saturday ? saturday[1] : null
  }
]

export const locations: ClinicLocation[] = [
  {
    id: 'downtown',
    name: { en: 'Downtown', es: 'Downtown' },
    place: {
      en: 'Second floor of a converted warehouse on the harbour side of the old town.',
      es: 'Segunda planta de un antiguo almacén rehabilitado, en la zona del puerto del casco viejo.'
    },
    gettingHere: {
      en: 'Two minutes from the central transit station. Lift from the street entrance; validated parking in the building garage.',
      es: 'A dos minutos de la estación central de transporte. Ascensor desde la entrada; aparcamiento validado en el garaje del edificio.'
    },
    phone: '(555) 014-2200',
    image: '/images/clinic-downtown.webp',
    hours: hours(8 * 60, 19 * 60, [9 * 60, 13 * 60])
  },
  {
    id: 'northside',
    name: { en: 'Northside', es: 'Northside' },
    place: {
      en: 'Ground floor of a garden block beside the neighbourhood library.',
      es: 'Planta baja de un edificio con jardín, junto a la biblioteca del barrio.'
    },
    gettingHere: {
      en: 'Step-free entrance from the car park, which is free for patients. Two bus routes stop outside.',
      es: 'Entrada sin escalones desde el aparcamiento, gratuito para pacientes. Dos líneas de autobús paran en la puerta.'
    },
    phone: '(555) 014-2300',
    image: '/images/clinic-northside.webp',
    hours: hours(7 * 60 + 30, 18 * 60, [9 * 60, 13 * 60])
  },
  {
    id: 'westside',
    name: { en: 'Westside', es: 'Westside' },
    place: {
      en: 'A single-storey clinic at the quiet north edge of the park.',
      es: 'Una clínica de una sola planta en el extremo norte del parque, una zona tranquila.'
    },
    gettingHere: {
      en: 'Covered drop-off lane at the door and free parking. A community shuttle runs every twenty minutes.',
      es: 'Carril cubierto para dejar pacientes en la puerta y aparcamiento gratuito. Una lanzadera vecinal pasa cada veinte minutos.'
    },
    phone: '(555) 014-2400',
    image: '/images/clinic-westside.webp',
    hours: hours(8 * 60, 17 * 60)
  }
]

export const locationById = (id: string): ClinicLocation | undefined =>
  locations.find((location) => location.id === id)

export const isLocationId = (value: unknown): value is LocationId =>
  typeof value === 'string' && locations.some((location) => location.id === value)
