import { db, auth, serverTimestamp } from "../firebase.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { normalizeValue, registrationMatchesSearch } from "./registration-helpers.js";
import {
  getAttendanceState,
  countAttendance,
  updatesForPresent,
  updatesForAbsent,
  updatesForUnmarked,
} from "./attendance-state.js";

const adminLogin = document.getElementById("adminLogin");
const attendanceApp = document.getElementById("attendanceApp");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const loginMessage = document.getElementById("loginMessage");
const adminEmail = document.getElementById("adminEmail");
const attendanceSearch = document.getElementById("attendanceSearch");
const attendanceMatches = document.getElementById("attendanceMatches");
const attendanceHint = document.getElementById("attendanceHint");
const attendanceDetail = document.getElementById("attendanceDetail");
const attendanceDetailCard = document.getElementById("attendanceDetailCard");
const detailName = document.getElementById("detailName");
const detailStatusBadge = document.getElementById("detailStatusBadge");
const detailReg = document.getElementById("detailReg");
const detailPhone = document.getElementById("detailPhone");
const detailEvent = document.getElementById("detailEvent");
const detailGender = document.getElementById("detailGender");
const btnPresent = document.getElementById("btnPresent");
const btnAbsent = document.getElementById("btnAbsent");
const btnUnmarked = document.getElementById("btnUnmarked");
const attendanceMessage = document.getElementById("attendanceMessage");
const statTotalAtt = document.getElementById("statTotalAtt");
const statPresentCount = document.getElementById("statPresentCount");
const statAbsentCount = document.getElementById("statAbsentCount");
const statUnmarkedCount = document.getElementById("statUnmarkedCount");

let registrations = [];
let isAdminUser = false;
/** @type {string | null} */
let selectedRegistrationId = null;

function showLoginMessage(text, isError = false) {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.classList.toggle("is-error", isError);
}

function getAuthErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

async function ensureAdminRequest(user) {
  if (!user) return;
  const requestRef = doc(db, "admin_requests", user.uid);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) {
    await setDoc(requestRef, {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      createdAt: serverTimestamp(),
    });
  }
}

async function checkAdmin(user) {
  if (!user) return false;
  const adminRef = doc(db, "admins", user.uid);
  const snap = await getDoc(adminRef);
  return snap.exists() && snap.data().isAdmin === true;
}

async function completeRedirectIfNeeded() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureAdminRequest(result.user);
      showLoginMessage("Signed in. Checking admin access...", false);
    }
  } catch (error) {
    console.error(error);
    showLoginMessage("Sign-in failed. Please try again.", true);
  }
}

completeRedirectIfNeeded();

function setActionMessage(text, isError = false) {
  if (!attendanceMessage) return;
  attendanceMessage.textContent = text;
  attendanceMessage.classList.toggle("is-error", isError);
}

function updateStatsBar() {
  const c = countAttendance(registrations);
  if (statTotalAtt) statTotalAtt.textContent = String(c.total);
  if (statPresentCount) statPresentCount.textContent = String(c.present);
  if (statAbsentCount) statAbsentCount.textContent = String(c.absent);
  if (statUnmarkedCount) statUnmarkedCount.textContent = String(c.unmarked);
}

function syncDetailCardClasses(st) {
  if (!attendanceDetailCard) return;
  attendanceDetailCard.classList.toggle("attendance-detail-card--present", st === "present");
  attendanceDetailCard.classList.toggle("attendance-detail-card--absent", st === "absent");
}

function renderDetail(/* reg */) {
  if (!selectedRegistrationId) return;
  const reg = registrations.find((r) => r.id === selectedRegistrationId);
  if (!reg) {
    attendanceDetail.hidden = true;
    return;
  }

  const st = getAttendanceState(reg);
  if (detailName) detailName.textContent = reg.name || "—";
  if (detailReg) detailReg.textContent = reg.regNumber || "—";
  if (detailPhone) detailPhone.textContent = reg.phone || "—";
  if (detailEvent) detailEvent.textContent = reg.eventName || "—";
  if (detailGender) detailGender.textContent = reg.gender || "—";

  if (detailStatusBadge) {
    if (st === "present") {
      detailStatusBadge.textContent = "Present";
      detailStatusBadge.className = "attendance-status-badge attendance-status-badge--present";
    } else if (st === "absent") {
      detailStatusBadge.textContent = "Absent";
      detailStatusBadge.className = "attendance-status-badge attendance-status-badge--absent";
    } else {
      detailStatusBadge.textContent = "Not marked";
      detailStatusBadge.className = "attendance-status-badge attendance-status-badge--unmarked";
    }
  }

  syncDetailCardClasses(st);
  attendanceDetail.hidden = false;
}

function getSearchMatches() {
  const q = normalizeValue(attendanceSearch ? attendanceSearch.value : "");
  if (!q) return [];
  return registrations.filter((reg) => registrationMatchesSearch(reg, q)).slice(0, 15);
}

function renderMatchList() {
  const q = normalizeValue(attendanceSearch ? attendanceSearch.value : "");
  if (!attendanceMatches) return;

  if (!q) {
    attendanceMatches.hidden = true;
    attendanceMatches.innerHTML = "";
    if (attendanceHint) {
      attendanceHint.textContent = "Type at least 1 character to search.";
      attendanceHint.hidden = false;
    }
    return;
  }

  const list = getSearchMatches();
  if (attendanceHint) attendanceHint.hidden = list.length > 0;

  if (!list.length) {
    attendanceMatches.hidden = false;
    attendanceMatches.innerHTML = `<p class="attendance-empty">No matches. Try another name, reg no, or mobile.</p>`;
    attendanceDetail.hidden = true;
    selectedRegistrationId = null;
    return;
  }

  attendanceMatches.hidden = false;
  attendanceMatches.innerHTML = "";
  list.forEach((reg) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "attendance-match-row";
    if (reg.id === selectedRegistrationId) btn.classList.add("is-selected");
    const st = getAttendanceState(reg);
    const statusClass =
      st === "present" ? " is-present-line" : st === "absent" ? " is-absent-line" : "";
    btn.innerHTML = `
      <span class="attendance-match-name">${escapeHtml(reg.name || "—")}</span>
      <span class="attendance-match-meta${statusClass}">${escapeHtml(reg.regNumber || "—")} · ${escapeHtml(reg.phone || "—")}</span>
    `;
    btn.addEventListener("click", () => {
      selectedRegistrationId = reg.id;
      renderMatchList();
      renderDetail();
      setActionMessage("");
    });
    attendanceMatches.appendChild(btn);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadRegistrations() {
  setActionMessage("Loading registrations…", false);
  try {
    const registrationsRef = collection(db, "registrations");
    const registrationsQuery = query(registrationsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(registrationsQuery);
    registrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    updateStatsBar();
    renderMatchList();
    if (selectedRegistrationId) {
      const still = registrations.some((r) => r.id === selectedRegistrationId);
      if (!still) {
        selectedRegistrationId = null;
        attendanceDetail.hidden = true;
      } else {
        renderDetail();
      }
    }
    setActionMessage("", false);
  } catch (error) {
    console.error(error);
    setActionMessage("Could not load registrations.", true);
  }
}

/**
 * @param {"present" | "absent" | "unmarked"} mode
 */
async function applyAttendanceUpdate(regId, mode) {
  const reg = registrations.find((r) => r.id === regId);
  if (!reg) return;

  const payload =
    mode === "present"
      ? updatesForPresent()
      : mode === "absent"
        ? updatesForAbsent()
        : updatesForUnmarked(deleteField);

  btnPresent.disabled = true;
  btnAbsent.disabled = true;
  btnUnmarked.disabled = true;
  try {
    await updateDoc(doc(db, "registrations", regId), payload);

    if (mode === "present") {
      reg.attendanceStatus = "present";
      reg.markedPresent = true;
    } else if (mode === "absent") {
      reg.attendanceStatus = "absent";
      reg.markedPresent = false;
    } else {
      delete reg.attendanceStatus;
      reg.markedPresent = false;
    }

    updateStatsBar();
    renderMatchList();
    renderDetail();
    setActionMessage("Saved.", false);
  } catch (error) {
    console.error(error);
    setActionMessage("Update failed. Try again.", true);
  } finally {
    btnPresent.disabled = false;
    btnAbsent.disabled = false;
    btnUnmarked.disabled = false;
  }
}

if (btnPresent) {
  btnPresent.addEventListener("click", async () => {
    if (!selectedRegistrationId) return;
    await applyAttendanceUpdate(selectedRegistrationId, "present");
  });
}

if (btnAbsent) {
  btnAbsent.addEventListener("click", async () => {
    if (!selectedRegistrationId) return;
    await applyAttendanceUpdate(selectedRegistrationId, "absent");
  });
}

if (btnUnmarked) {
  btnUnmarked.addEventListener("click", async () => {
    if (!selectedRegistrationId) return;
    await applyAttendanceUpdate(selectedRegistrationId, "unmarked");
  });
}

if (attendanceSearch) {
  attendanceSearch.addEventListener("input", () => {
    renderMatchList();
  });
  attendanceSearch.addEventListener("focus", () => {
    renderMatchList();
  });
}

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    showLoginMessage("Signing in...", false);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureAdminRequest(result.user);
      showLoginMessage("Signed in. Checking admin access...", false);
    } catch (error) {
      const code = getAuthErrorCode(error);
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          showLoginMessage("Opening Google sign-in...", false);
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectError) {
          console.error(redirectError);
        }
      }
      console.error(error);
      showLoginMessage("Unable to sign in. Please try again.", true);
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    isAdminUser = false;
    if (adminLogin) {
      adminLogin.hidden = false;
      adminLogin.style.display = "grid";
    }
    if (attendanceApp) {
      attendanceApp.hidden = true;
    }
    showLoginMessage("Sign in to continue.", false);
    return;
  }

  if (adminEmail) adminEmail.textContent = user.email || "Signed in";
  await ensureAdminRequest(user);
  isAdminUser = await checkAdmin(user);

  if (isAdminUser) {
    if (adminLogin) {
      adminLogin.hidden = true;
      adminLogin.style.display = "none";
    }
    if (attendanceApp) {
      attendanceApp.hidden = false;
    }
    showLoginMessage("", false);
    await loadRegistrations();
    if (attendanceSearch) attendanceSearch.focus();
  } else {
    if (attendanceApp) attendanceApp.hidden = true;
    if (adminLogin) {
      adminLogin.hidden = false;
      adminLogin.style.display = "grid";
    }
    showLoginMessage("Your account is not approved yet. Ask the admin to enable access.", true);
  }
});
