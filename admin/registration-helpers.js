export function normalizeValue(value) {
  return String(value || "").toLowerCase();
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Name, phone, email, and registration number (incl. digit-only partial match on reg no). */
export function registrationMatchesSearch(reg, searchValue) {
  if (!searchValue) return true;
  if (normalizeValue(reg.name).includes(searchValue)) return true;
  if (normalizeValue(reg.phone).includes(searchValue)) return true;
  if (normalizeValue(reg.email).includes(searchValue)) return true;
  const regNoStr = String(reg.regNumber ?? "");
  if (normalizeValue(regNoStr).includes(searchValue)) return true;
  const qDigits = digitsOnly(searchValue);
  if (qDigits.length > 0) {
    const regDigits = digitsOnly(regNoStr);
    if (regDigits.includes(qDigits)) return true;
  }
  return false;
}
