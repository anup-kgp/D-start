/**
 * Firestore: attendanceStatus 'present' | 'absent'; absent takes precedence.
 * Legacy: markedPresent true → counts as present when attendanceStatus unset.
 */
export function getAttendanceState(reg) {
  if (!reg) return "unmarked";
  if (reg.attendanceStatus === "absent") return "absent";
  if (reg.attendanceStatus === "present" || reg.markedPresent === true) return "present";
  return "unmarked";
}

export function attendanceLabel(reg) {
  const s = getAttendanceState(reg);
  if (s === "present") return "present";
  if (s === "absent") return "absent";
  return "not marked";
}

export function countAttendance(registrations) {
  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const reg of registrations) {
    const s = getAttendanceState(reg);
    if (s === "present") present += 1;
    else if (s === "absent") absent += 1;
    else unmarked += 1;
  }
  return {
    total: registrations.length,
    present,
    absent,
    unmarked,
  };
}

export function updatesForPresent() {
  return { attendanceStatus: "present", markedPresent: true };
}

export function updatesForAbsent() {
  return { attendanceStatus: "absent", markedPresent: false };
}

export function updatesForUnmarked(deleteField) {
  return {
    attendanceStatus: deleteField(),
    markedPresent: false,
  };
}
