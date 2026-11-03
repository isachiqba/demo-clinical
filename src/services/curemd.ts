import type { Appointment, AppointmentStatus, CuremdStatus, CuremdTask } from '@/types'

/**
 * The two statuses an appointment carries, and the rules that keep them coherent.
 *
 * **Nothing in this file talks to CureMD.** There is no integration: a CureMD status only
 * records what a receptionist says they did by hand in the other system. "Registered in
 * CureMD" means "reception declared it", never "we checked".
 *
 * Keeping the rules here, rather than scattered through dialogs, is what stops the two
 * statuses drifting into combinations that could not happen in real life.
 */

/** Which appointment statuses each CureMD status is allowed to sit beside. */
const COHERENT: Record<CuremdStatus, AppointmentStatus[]> = {
  // Asked for by a patient, not yet in CureMD, so not yet agreed by the clinic.
  'pending-registration': ['requested'],
  // In CureMD, so the clinic has agreed to it.
  registered: ['confirmed', 'arrived', 'completed'],
  // In CureMD at the old time while a new one is being arranged.
  'change-pending': ['confirmed', 'arrived'],
  // In CureMD, and reception still has to take it out.
  'cancellation-pending': ['confirmed', 'arrived'],
  // Taken out of CureMD.
  cancelled: ['cancelled'],
  // Never got as far as CureMD, so there is nothing to undo there.
  'not-required': ['cancelled', 'unavailable']
}

export const isCoherent = (status: AppointmentStatus, curemd: CuremdStatus): boolean =>
  COHERENT[curemd].includes(status)

/** Everything wrong with an appointment's pair of statuses; empty when it is sound. */
export const incoherences = (appointment: Appointment): string[] => {
  const problems: string[] = []

  if (!isCoherent(appointment.status, appointment.curemd.status)) {
    problems.push(`${appointment.status} cannot sit with ${appointment.curemd.status}`)
  }

  const hasChange = appointment.pendingChange !== null
  if (hasChange !== (appointment.curemd.status === 'change-pending')) {
    problems.push('a pending change and the change-pending status must go together')
  }

  if (appointment.curemd.status === 'registered' && !appointment.curemd.registered) {
    problems.push('registered without a record of what was registered')
  }

  if (appointment.curemd.status === 'pending-registration' && appointment.curemd.registered) {
    problems.push('pending registration but something is already recorded as registered')
  }

  return problems
}

/** The work, if any, this appointment is waiting on reception to do in CureMD. */
export const pendingTaskOf = (appointment: Appointment): CuremdTask | null => {
  switch (appointment.curemd.status) {
    case 'pending-registration':
      return 'registration'
    case 'change-pending':
      return 'change'
    case 'cancellation-pending':
      return 'cancellation'
    default:
      return null
  }
}

export const hasPendingTask = (appointment: Appointment): boolean =>
  pendingTaskOf(appointment) !== null

/**
 * A new appointment cannot be confirmed to the patient while it is still only a request
 * sitting in someone's inbox: reception has to put it in CureMD first.
 */
export const canConfirm = (appointment: Appointment): boolean =>
  appointment.status === 'requested' && appointment.curemd.status === 'registered'

/** A request that has never reached CureMD needs no undoing there. */
export const cancellingNeedsCuremd = (appointment: Appointment): boolean =>
  appointment.curemd.status === 'registered' ||
  appointment.curemd.status === 'change-pending' ||
  appointment.curemd.status === 'cancellation-pending'

/** Reception can still move an appointment that is not finished with. */
export const canReschedule = (appointment: Appointment): boolean =>
  appointment.status === 'requested' ||
  appointment.status === 'confirmed' ||
  appointment.status === 'arrived'

export const isOpenRequest = (appointment: Appointment): boolean =>
  appointment.status === 'requested'

/** Is this appointment settled, one way or another? */
export const isClosed = (appointment: Appointment): boolean =>
  appointment.status === 'cancelled' ||
  appointment.status === 'unavailable' ||
  appointment.status === 'completed'

/**
 * The time the patient should be told about: the one reception says is in CureMD when
 * there is one, otherwise the time they asked for. A pending change is deliberately not
 * shown as theirs yet.
 */
export const effectiveStartWall = (appointment: Appointment): string =>
  appointment.curemd.registered?.startWall ?? appointment.startWall
