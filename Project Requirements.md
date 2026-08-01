# Project Requirements — PH Healthcare System

## 1. Overview

PH Healthcare System is a web platform that connects patients with doctors for online consultations. A patient searches for a doctor, books a time slot, pays upfront, and joins a video call at the scheduled time. The doctor runs the consultation and sends back a digital prescription afterward. Admins verify doctors and keep the platform running smoothly.

**Goal:** make booking a doctor's appointment as simple as booking anything else online, while giving doctors a lightweight way to manage their schedule and patients a record of every consultation.

This document describes the product as a whole. The [README](./README.md) describes what's actually implemented in this repository today — the two won't fully match until the project is further along.

## 2. Who uses this

| Role             | What they do                                                                 |
| ---------------- | ------------------------------------------------------------------------------ |
| **Patient**      | Finds a doctor, books and pays for a slot, joins the call, keeps their records |
| **Doctor**       | Sets their availability, runs consultations, writes prescriptions              |
| **Admin**        | Approves new doctors, manages user accounts, keeps the platform healthy        |
| **Super Admin**  | Everything an Admin can do, plus creating other Admins                         |

## 3. Features

### 3.1 Accounts and sign-up

- Anyone can register. A public registration always creates a **Patient** account — there's no way to sign up directly as a Doctor or Admin through the same form.
- Doctors register through a separate flow and start out **pending**. They can't take bookings until an Admin approves them.
- The very first Admin account is created by seeding it directly, not through the API — the platform can't have zero admins to approve the first doctor.
- New users get a welcome email.

### 3.2 Admin

- Review pending doctor applications and approve or reject them.
- Block or unblock any account, Patient or Doctor, if it's misbehaving.
- Create additional Admin accounts.

### 3.3 Doctor

- Keep a profile up to date, including specialization.
- Set recurring availability (for example, 3 PM–9 PM on weekdays) and a maximum number of slots per day (for example, 20).
- Start and end a consultation session manually.
- Each session gets a video call link, generated automatically from the doctor's own account.
- After a consultation, fill in clinical notes and prescribed medication. This generates a PDF (prescription + invoice) and emails it to the patient.

### 3.4 Patient

- Search for doctors by name, specialization, or availability.
- Book one slot per doctor per day. A booking only becomes final once payment goes through.
- Slots within a schedule are numbered in the order they're booked (1st booking is slot 1, and so on), so patients know roughly when they'll be seen.
- Optionally attach existing medical records (PDF) when booking, so the doctor has context beforehand.
- Get an email confirmation with the slot number, appointment time, and video call link as soon as payment succeeds.

## 4. How a booking works, end to end

**Patient side:**

1. Log in and search for a doctor.
2. Pick an open slot, optionally attach past medical records.
3. Pay for the slot.
4. Get an email with the slot number, time, and video call link.

**Doctor side:**

1. Log in and review the day's bookings, including anything patients attached.
2. Start the session and join the call at the scheduled time.
3. After the consultation, record findings and prescribe medication.
4. Submit the notes (which emails the PDF to the patient) and end the session.

## 5. Integrations

| Purpose            | Provider                                          | Notes                                                                 |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Payments             | Stripe                                             | Primary. SSL Commerz as a secondary option later.                    |
| Video calls          | Google Meet API                                    | Link generated per session, tied to the doctor's own account.        |
| Transactional email  | Gmail SMTP via Nodemailer                          | Needs a Gmail **App Password** (requires 2-Step Verification), not the account password. |
| File uploads         | Multer (upload handling) + Cloudinary (storage)    | Profile pictures and uploaded medical PDFs.                          |

**Email settings**, read the same way as everything else in this project — through `config`, never `process.env` directly:

| Variable    | Value                              |
| ----------- | ------------------------------------ |
| `SMTP_HOST` | `smtp.gmail.com`                     |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS)      |
| `SMTP_USER` | the Gmail address sending mail       |
| `SMTP_PASS` | the 16-character Gmail App Password  |
| `SMTP_FROM` | the "from" address shown to recipients |

Emails to send:

1. Welcome email on registration
2. Booking confirmation — slot number, time, video call link
3. Prescription + invoice PDF after a consultation

Gmail caps free accounts at roughly 500 emails/day (2,000 on Workspace). That's fine early on, but keep the mailer behind one interface so swapping in a dedicated email provider later doesn't mean touching every place that sends mail.

## 6. Out of scope for now

To keep the MVP focused, these are deliberately not part of the first version:

- In-app messaging between patient and doctor outside of the scheduled call
- Recurring/subscription-based appointments
- Insurance claims or billing beyond a single per-visit payment
- Native mobile apps
