import type { Service, ServiceId } from '@/types'

/**
 * Four consultation types. Descriptions say what an appointment *is*, never what a
 * patient should do about a symptom — this is a demo, not medical advice.
 *
 * They deliberately carry no duration: every request takes one ten-minute slot on the
 * booking grid, and how long the clinician actually spends is the clinic's business.
 */
export const services: Service[] = [
  {
    id: 'primary-care',
    icon: 'stethoscope',
    name: { en: 'Internal medicine', es: 'Medicina interna' },
    summary: {
      en: 'Day-to-day care, with your history kept from one visit to the next.',
      es: 'Atención cotidiana, con tu historial conservado de una visita a la siguiente.'
    },
    detail: {
      en: 'A general appointment for everyday health questions, ongoing conditions and medication reviews.',
      es: 'Una consulta general para cuestiones de salud cotidianas, afecciones de seguimiento y revisión de medicación.'
    },
  },
  {
    id: 'annual-wellness',
    icon: 'clipboard',
    name: { en: 'Annual wellness', es: 'Revisión anual' },
    summary: {
      en: 'A longer yearly appointment to review how you are doing.',
      es: 'Una consulta anual más larga para revisar cómo estás.'
    },
    detail: {
      en: 'A scheduled yearly visit with time to go through your history, current treatments and anything you want to raise.',
      es: 'Una visita anual programada con tiempo para repasar tu historial, los tratamientos actuales y lo que quieras plantear.'
    },
  },
  {
    id: 'follow-up',
    icon: 'repeat',
    name: { en: 'Follow-up visit', es: 'Visita de seguimiento' },
    summary: {
      en: 'A shorter appointment to continue something already discussed.',
      es: 'Una consulta más corta para continuar algo ya hablado.'
    },
    detail: {
      en: 'For picking up where a previous appointment left off, including reviewing results or adjusting a plan already agreed.',
      es: 'Para retomar una consulta anterior: revisar resultados o ajustar un plan ya acordado.'
    },
  },
  {
    id: 'non-emergency',
    icon: 'message',
    name: { en: 'Non-emergency consultation', es: 'Consulta no urgente' },
    summary: {
      en: 'A short appointment for something that can wait for a scheduled slot.',
      es: 'Una consulta breve para algo que puede esperar a una cita programada.'
    },
    detail: {
      en: 'A general-purpose appointment when you would like to be seen and the matter is not urgent.',
      es: 'Una consulta general para cuando quieras que te vean y el asunto no es urgente.'
    },
  }
]

export const serviceById = (id: string): Service | undefined =>
  services.find((service) => service.id === id)

export const isServiceId = (value: unknown): value is ServiceId =>
  typeof value === 'string' && services.some((service) => service.id === value)
