import { db, serverTimestamp } from "./firebase.js";
import {
  collection,
  runTransaction,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("registrationForm");
const formResult = document.getElementById("formResult");
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const eventSelectionGrid = document.getElementById("eventSelectionGrid");
const eventNameInput = document.getElementById("eventName");
const eventDisplay = document.getElementById("eventDisplay");
const selectedEventLabel = document.getElementById("selectedEventLabel");
const successCard = document.getElementById("successCard");
const genderSelect = document.getElementById("genderSelect");
const submitButton = form ? form.querySelector("button[type=\"submit\"]") : null;
const submitStatus = document.getElementById("submitStatus");
const directPaymentNote = document.getElementById("directPaymentNote");
const registrationClosedBanner = document.getElementById("registrationClosedBanner");

const REGISTRATION_END_DATE = "2026-04-30T23:59:59+05:30";
const registrationClosed = new Date() > new Date(REGISTRATION_END_DATE);


const EMAILJS_SERVICE_ID = "service_oelo1t3";
const EMAILJS_TEMPLATE_ID = "template_t3lut81";
const EMAILJS_PUBLIC_KEY = "VsrnVcsptNZyqUHKP";

if (window.emailjs) {
  window.emailjs.init(EMAILJS_PUBLIC_KEY);
}

const CLOUDINARY_CLOUD_NAME = "dpyslavgz";
const CLOUDINARY_UPLOAD_PRESET = "x2uxplk3";
const CLOUDINARY_FOLDER = "kdsac-registrations";
const directParams = new URLSearchParams(window.location.search);
const directPayment = directParams.get("direct") === "1";
const directKey = directParams.get("key") || "";
let directAllowed = false;
let manualRegistrationEnabled = false;

async function hashDirectKey(value) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkDirectAccess() {
  if (!directPayment || !directKey) return false;
  try {
    const snap = await getDoc(doc(db, "settings", "directAccess"));
    if (!snap.exists()) return false;
    const data = snap.data();
    if (data.enabled !== true || !data.keyHash) return false;
    const localHash = await hashDirectKey(directKey);
    return localHash === data.keyHash;
  } catch (error) {
    console.error("Direct access check failed", error);
    return false;
  }
}

const directAccessVerified = await checkDirectAccess();
directAllowed = directAccessVerified;

async function createRazorpayOrder(amount, name, category) {
  const response = await fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      name,
      category,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Payment setup failed");
  }

  return response.json();
}

function openRazorpayCheckout(order, prefill) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Payment gateway unavailable"));
      return;
    }

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Kharagpur Mini Marathon 2026",
      description: "Registration Fee",
      order_id: order.orderId,
      prefill,
      theme: {
        color: "#ff6a00",
      },
      handler: (response) => {
        resolve({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          reject(new Error("Payment was cancelled"));
        },
      },
    };

    const instance = new window.Razorpay(options);
    instance.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Payment failed"));
    });
    instance.open();
  });
}

async function verifyRazorpayPayment(payment) {
  const response = await fetch("/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      signature: payment.signature,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Payment verification failed");
  }

  const result = await response.json();
  if (!result.verified) {
    throw new Error("Payment verification failed");
  }
}

async function uploadFile(file) {
  if (!file || !file.name) return null;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const result = await response.json();
  return result.secure_url || result.url || null;
}

function generateCardToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getNextRegistrationNumber() {
  const counterRef = doc(db, "counters", "registration");
  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastNumber = snap.exists() ? Number(snap.data().lastNumber || 0) : 0;
    const newNumber = lastNumber + 1;
    transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });
    return newNumber;
  });
  return String(nextNumber).padStart(4, "0");
}

function setRegistrationClosedState() {
  if (!form) return;

  if (registrationClosedBanner) {
    registrationClosedBanner.hidden = false;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Registration Closed";
  }

  form.querySelectorAll("input, select, textarea, button").forEach((field) => {
    if (field === submitButton) return;
    if (field.id === "menuToggle") return;
    if (field.type === "hidden") return;
    field.disabled = true;
  });

  if (submitStatus) {
    submitStatus.textContent = "Registration closed on 30 April 2026.";
    submitStatus.classList.remove("is-loading");
    submitStatus.classList.add("is-error");
  }

  if (directPaymentNote && directPayment) {
    directPaymentNote.hidden = false;
    directPaymentNote.textContent = "Registration is closed. Direct registration is no longer available.";
  }
}

function enableManualRegistrationState() {
  if (!form) return;

  manualRegistrationEnabled = true;

  if (registrationClosedBanner) {
    registrationClosedBanner.hidden = false;
    registrationClosedBanner.textContent = "Manual registration link active. This entry will be saved by admin.";
  }

  form.querySelectorAll("input, select, textarea, button").forEach((field) => {
    if (field.id === "menuToggle") return;
    if (field.type === "hidden") return;
    field.disabled = false;
  });

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Registration";
  }

  if (submitStatus) {
    submitStatus.textContent = "Manual registration link verified. You can submit this entry.";
    submitStatus.classList.remove("is-error");
    submitStatus.classList.remove("is-loading");
  }

  if (directPaymentNote && directPayment) {
    directPaymentNote.hidden = false;
    directPaymentNote.textContent = "Manual registration link active. Submit this entry through admin approval.";
  }
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (form && formResult) {
  if (registrationClosed) {
    setRegistrationClosedState();
    if (directPayment) {
      if (directAccessVerified) {
        enableManualRegistrationState();
      } else if (directPaymentNote) {
        directPaymentNote.hidden = false;
        directPaymentNote.textContent = "Direct link invalid or disabled. Payment required.";
      }
    } else if (formResult) {
      formResult.textContent = "Registration is now closed.";
      if (successCard) successCard.hidden = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (registrationClosed && !manualRegistrationEnabled) {
      if (submitStatus) {
        submitStatus.textContent = "Registration closed on 30 April 2026.";
        submitStatus.classList.add("is-error");
      }
      if (formResult) {
        formResult.textContent = "Registration is closed. New entries are no longer being accepted.";
      }
      if (successCard) {
        successCard.hidden = false;
      }
      return;
    }

    const formData = new FormData(form);
    const name = formData.get("name");
    const gender = formData.get("gender");
    let eventName = formData.get("eventName");
    const photoFile = formData.get("photo");
    const govtIdFile = formData.get("govtId");

    if (!eventName) {
      if (gender === "Female") {
        eventName = "Women 5 KM";
      } else if (gender === "Male") {
        eventName = "Men 10 KM";
      }
    }

    if (submitStatus) {
      submitStatus.textContent = "Preparing your registration...";
      submitStatus.classList.add("is-loading");
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      if (!photoFile || !photoFile.name) {
        throw new Error("Photo is required.");
      }
      const fee = gender === "Female" ? 250 : 350;
      let payment = {
        paymentId: "",
        orderId: "",
        signature: "",
        status: "manual",
        method: "cash",
      };

      if (!directAllowed) {
        if (submitStatus) {
          submitStatus.textContent = "Opening payment window...";
        }
        const order = await createRazorpayOrder(fee, name, eventName);
        const paymentResult = await openRazorpayCheckout(order, {
          name: String(name || "").trim(),
          email: String(formData.get("email") || "").trim(),
          contact: String(formData.get("phone") || "").trim(),
        });
        if (submitStatus) {
          submitStatus.textContent = "Verifying payment...";
        }
        await verifyRazorpayPayment(paymentResult);
        payment = {
          ...paymentResult,
          status: "paid",
          method: "razorpay",
        };
      }

      const regNumber = await getNextRegistrationNumber();
      const registrationRef = doc(collection(db, "registrations"));
      if (submitStatus) {
        submitStatus.textContent = "Uploading documents...";
      }
      let photoUrl = "";
      let govtIdUrl = "";
      try {
        const uploads = await Promise.allSettled([
          uploadFile(photoFile),
          uploadFile(govtIdFile),
        ]);
        photoUrl = uploads[0].status === "fulfilled" ? uploads[0].value : "";
        govtIdUrl = uploads[1].status === "fulfilled" ? uploads[1].value : "";
      } catch (uploadError) {
        console.error("Upload failed", uploadError);
      }

      const payload = {
        name: String(name || "").trim(),
        nameLower: String(name || "").trim().toLowerCase(),
        fatherName: String(formData.get("fatherName") || "").trim(),
        gender: String(gender || "").trim(),
        eventName,
        dob: String(formData.get("dob") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        medicalCondition: String(formData.get("medicalCondition") || "").trim(),
        tshirtSize: String(formData.get("tshirtSize") || "").trim(),
        fee,
        paymentId: payment.paymentId,
        paymentOrderId: payment.orderId,
        paymentSignature: payment.signature,
        paymentAmount: fee,
        paymentCurrency: "INR",
        paymentStatus: payment.status,
        paymentMethod: payment.method,
        regNumber,
        photoUrl: photoUrl || "",
        govtIdUrl: govtIdUrl || "",
        status: "pending",
        certificateStatus: "pending",
        rank: "",
        createdAt: serverTimestamp(),
      };

      await setDoc(registrationRef, payload);

      if (submitStatus) {
        submitStatus.textContent = "Finalizing registration...";
      }

      if (submitStatus) {
        submitStatus.textContent = "Sending confirmation email...";
      }
      const websiteLink = `${window.location.origin}/index.html`;
      const emailParams = {
        name: payload.name,
        category: payload.eventName,
        amount: payload.fee,
        website_link: websiteLink,
        reg_number: payload.regNumber,
        event_date: "10 May 2026",
        reporting_time: "5:00 AM",
        start_time: "6:00 AM",
        venue: "Kharagpur Sersa Stadium, Paschim Medinipur, West Bengal",
        email: payload.email,
      };

      try {
        if (window.emailjs) {
          await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailParams);
        }
      } catch (mailError) {
        console.error("Email send failed", mailError);
      }

      formResult.textContent = `${name}, your registration for ${eventName} has been received successfully. Your registration number is ${regNumber}. You will receive a confirmation email shortly.`;
      if (successCard) {
        successCard.hidden = false;
      }
      if (submitStatus) {
        submitStatus.textContent = "";
        submitStatus.classList.remove("is-loading");
      }
      form.reset();
      if (eventNameInput) {
        eventNameInput.value = "";
      }
      if (eventDisplay) {
        eventDisplay.value = "";
      }
      if (selectedEventLabel) {
        selectedEventLabel.textContent = "Choose gender to assign event";
      }
      if (eventSelectionGrid) {
        eventSelectionGrid.querySelectorAll(".event-choice").forEach((choice) => {
          choice.classList.remove("is-selected");
        });
      }
      if (genderSelect) {
        genderSelect.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      formResult.textContent =
        message && message.toLowerCase().includes("payment")
          ? `${message}. Registration was not submitted.`
          : "Sorry, we could not save your registration. Please try again.";
      if (successCard) {
        successCard.hidden = false;
      }
      if (submitStatus) {
        submitStatus.textContent = "";
        submitStatus.classList.remove("is-loading");
      }
      console.error(error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
      }
      if (submitStatus) {
        submitStatus.classList.remove("is-loading");
      }
    }
  });
}

function setEventFromGender(gender) {
  let eventName = "";

  if (gender === "Female") {
    eventName = "Women 5 KM";
  } else if (gender === "Male") {
    eventName = "Men 10 KM";
  } else if (gender === "Other") {
    eventName = "Other";
  }

  if (eventNameInput) {
    eventNameInput.value = eventName;
  }
  if (eventDisplay) {
    eventDisplay.value = eventName;
  }
  if (selectedEventLabel) {
    selectedEventLabel.textContent = eventName || "Choose gender to assign event";
  }

  if (eventSelectionGrid) {
    eventSelectionGrid.querySelectorAll(".event-choice").forEach((choice) => {
      const matches = choice.dataset.event === eventName;
      choice.classList.toggle("is-selected", matches);
    });
  }

  if (successCard) {
    successCard.hidden = true;
  }
}

if (genderSelect) {
  genderSelect.addEventListener("change", () => {
    setEventFromGender(genderSelect.value);
  });
}

if (submitButton) {
  submitButton.disabled = false;
}
