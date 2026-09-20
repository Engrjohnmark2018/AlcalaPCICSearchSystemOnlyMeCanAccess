# PCIC Crop Insurance Search System — Static Web App

A one-search-away system that lets farmers check their **PCIC crop insurance** (rice and corn)
from their own name and birthday — no more scanning hard copies in the MAO office.

**For Alcala Farmers Only**
Developed by: **ENGR. JOHN MARK C. CONTILLO, ABE**

- **Pure static app** — a single `index.html` file. No server, no internet needed after loading.
- **Two separate databases**: one CSV for **Rice**, one CSV for **Corn**.
- The CSV databases are **hidden from farmers**. They only ever see their own search result.
- Bilingual: **English labels with Ilocano helper text**; result popups in **Ilocano**.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole web app (farmer search + admin) |
| `sample-Rice-Database.csv` | Sample rice CSV for testing |
| `sample-Corn-Database.csv` | Sample corn CSV for testing |
| `README.md` | This guide |

---

## Quick start (try it now)

1. Open `index.html` in a browser (double-click it, or host it — see below).
2. **Tap the logo (top-left) 5 times quickly** to open the admin login, and log in.
3. Upload `sample-Rice-Database.csv` and `sample-Corn-Database.csv`.
4. Go back to the farmer search and try:
   - Commodity **Rice** → First Name `Juan`, Last Name `Dela Cruz`, Birthday `03/15/1975`
     *(shows 2 insured entries with their areas)*
   - Commodity **Rice** → First Name `Pedro`, Last Name `Banganan`, Birthday `11/22/1980`
     *(he has 2 rows in the CSV, but one has no planting date — only his 1 complete row is shown)*
   - Commodity **Rice** → First Name `Liza`, Last Name `Gawisan`, Birthday `01/17/1990`
     *(her only row has no variety and no planting date → she is **not on the list**)*
   - Commodity **Corn** → First Name `Danilo`, Last Name `Tumbaga`, Birthday `04/04/1978`
     *(shows 3 insured entries with areas)*
   - Commodity **Corn** → First Name `Cristino`, Last Name `Balweg`, Birthday `05/05/1985`
     *(he IS in the CSV, but his row has no variety and no planting date → he is
     **not on the list**: "I-update mi ti database iti sumarsaruno nga al-aldaw.")*
   - Any name/birthday **not** in the list → *"I-update mi ti database iti sumarsaruno nga al-aldaw."*

---

## Admin access (MAO staff only)

**Tap the logo (top-left) 5 times quickly.** (Adding `#admin` to the web address also works.)
The admin area is password-protected.

**Default password: `@EdiMAO2024`** — change it right away in the admin panel
("Change Password"). The new password is saved in the same browser.
After 5 wrong attempts the login locks for 30 seconds.

In the admin panel you can:

- Upload / replace the **Rice** CSV and the **Corn** CSV (drag-and-drop or choose file)
- See record counts and when each database was last updated
- Download ready-made **CSV templates**
- **Edit the popup messages** farmers see (with placeholders and live preview)
- Change the password
- Clear either database (requires a second confirming tap)
- **Export a farmer version** of the app with the databases baked in (see below)

---

## CSV database format

First row = headers. Recommended (and what the template uses):

```
Name,Birthday,Commodity,FarmLocation,Area,Variety,PlantingDate
Juan Dela Cruz,03/15/1975,Rice,Brgy. San Juan,1.5 ha,NSIC Rc222,01/12/2026
Maria Santiago,07/22/1968,Rice,Brgy. Pasi,0.75 ha,NSIC Rc160,02/03/2026
```

Rules:

- **Required columns:** `Name`, `Birthday`, `Variety`, `PlantingDate`.
  Recommended: `Commodity`, `Area`.
- **A row must have BOTH a variety and a planting date to count as insured.**
  Rows missing either are skipped — if a farmer has no complete rows, the popup says
  *"I-update mi ti database iti sumarsaruno nga al-aldaw."* (not on the list). If a farmer
  has some complete and some incomplete rows, only the complete ones are shown.
- **Area** is optional and shown in the popup exactly as typed (e.g., `1.5 ha`,
  `2,500 sqm`). A blank area shows "—".
- **FarmLocation** is optional, shown in the popup table right beside Commodity
  (e.g., `Brgy. San Juan`). A blank location shows "—". Old CSVs without this
  column still work — the column position does not matter, only the header name
  (aliases like `Barangay` or `Location` are also recognized).
- **Dates:** use `MM/DD/YYYY`. The parser also accepts `M/D/YYYY`, `YYYY-MM-DD`,
  `Jan 5, 2026`, `15-Mar-2024`, etc., and normalizes everything to MM/DD/YYYY.
- **One row = one insured planting.** A farmer with several parcels/plantings simply has
  several rows — the popup then lists up to **5** entries.
- **Matching:** the farmer types **First Name**, **Middle Name (optional)**, **Last Name**,
  and birthday. The search requires the first name, last name, and exact birthday to match.
  The middle name is optional and smart:
  - If the farmer types a middle name, it is used first; if the database doesn't have it,
    the search still succeeds on first + last name + birthday.
  - If the farmer skips the middle name, records with middle names/initials
    (e.g., "Maria D. Santos") are still found.
  - Spelling details are tolerant: case does not matter, "Lastname, Firstname" order in the
    CSV is handled, periods/hyphens/extra spaces are ignored, and typing `Munoz` finds `Muñoz`.
- Rows with a missing name or an invalid birthday are **skipped** (counted in the
  upload summary). Exact duplicate rows are removed automatically.
- Save from Excel as **CSV UTF-8** (File → Save As → CSV UTF-8).

---

## Editing the popup messages (admin)

The **Popup Messages** card in the admin panel lets you change every message farmers
see in the popups — wording, language, or both — without touching any code.

Editable messages:

| Popup | Fields |
|---|---|
| **Found** | main message, birthday line, table heading |
| **Not on the list** | main message, sub message |
| **No database yet** | main message, sub message |

Placeholders auto-fill the farmer's details when the popup is shown:

| Placeholder | Filled with |
|---|---|
| `{{Name}}` | The farmer's name from the database |
| `{{Birthday}}` | The farmer's birthday (MM/DD/YYYY) |
| `{{Commodity}}` | Rice or Corn |

Tips:

- Use **Preview found** / **Preview not on the list** to see exactly what the farmer
  will see — the preview uses your unsaved edits, so you can experiment freely.
- **Save messages** stores your wording (a field left blank falls back to its default).
- **Reset to defaults** restores the original messages.

---

## How the data is stored (important)

The uploaded CSV data is saved in the **browser storage (localStorage) of the computer
where you uploaded it** — the CSV file itself never goes anywhere and is never exposed
to farmers.

Practical consequences:

- This is perfect for an **office kiosk / tablet / computer**: staff uploads once,
  everyone who uses that device can search.
- The database is **not synced** to other computers or to farmers' phones. On another
  device the database is empty until staff uploads the CSVs there too.
- **Do not** clear the browser's site data — that erases the database (just re-upload).
- The password gate keeps casual users out of the admin area; like any static app it is
  not military-grade encryption, so only upload data you're allowed to handle on that
  device.

> Farmers' own phones: use the admin panel's **Share with Farmers** button to export a
> baked-in copy of the app — see the next section.

---

## Sharing with farmers (baked-in export)

The admin panel has a **Share with Farmers — Baked-in App** card. It downloads a copy
of this app with the currently saved Rice and Corn databases and your popup messages
embedded inside the file itself. The exported **farmer edition** has the admin panel
disabled and **no password included** — there is nothing to find or crack in the
shared file.

Workflow:

1. Upload / update your Rice and Corn CSVs in the admin panel (as usual).
2. Click **Download farmer app (baked-in index.html)** — you get a single file,
   `PCIC-Crop-Insurance-Search.html`.
3. Share it:
   - upload it once to a free host (Netlify Drop, GitHub Pages) and share the **link**, or
   - send the file directly via Messenger / Viber / Bluetooth / USB.
4. Farmers open it on their phones — the databases are already inside; no upload is
   needed, and it works offline.

Updating the database later: edit the CSV → upload in the admin → click the export
button again → replace the file on your host (or re-send it). Anyone opening the same
link gets the new data after a page refresh.

Notes:

- A database uploaded on a device **overrides** the baked-in one on that device (the
  admin status cards show the source: "built into this file" vs "uploaded on this
  device").
- The farmer edition has **no admin panel and no password** — the admin login is
  disabled in the shared file (logo taps and `#admin` do nothing). Update the data from
  your office copy, then export and re-share.
- Remember: the data travels inside the shared file — only share it as widely as
  intended.
- Do the export from a normal browser tab — sandboxed preview frames may block
  downloads.

---

## Farmer experience

1. **Select your commodity** — big Rice (Pagay) or Corn (Mais) buttons.
2. Fill in **First Name**, **Middle Name (optional)**, and **Last Name**, then type the
   **birthday (MM/DD/YYYY)** — plain typing, no calendar popup. (The birthday field
   auto-inserts the slashes and opens a number keypad on phones.)
3. Press **SEARCH**.

**If found**, the popup shows (up to 5 insured crops, each with its area):

> **Juan Dela Cruz** naka insure ka ti mulam.
> Birthday: 03/15/1975
>
> | # | Commodity | Farm Location  | Area    | Variety    | Planting Date |
> |---|-----------|----------------|---------|------------|---------------|
> | 1 | Rice      | Brgy. San Juan | 1.5 ha  | NSIC Rc222 | 01/12/2026    |
> | 2 | Rice      | Brgy. San Juan | 0.75 ha | NSIC Rc160 | 02/03/2026    |

**If not on the list** (name/birthday not found, or no complete variety + planting date rows):

> I-update mi ti database iti sumarsaruno nga al-aldaw.
> (We will update the database in the next days -- stay tune.)

**If that commodity's database hasn't been uploaded yet**, the popup says so and asks
the farmer to come back.

---

## Deploying

Any of these work — it's just one file:

- **Office computer / kiosk:** open `index.html` directly (double-click).
- **USB / shared folder:** copy `index.html`, open on any computer.
- **Free hosting:** drag the folder into Netlify Drop, or push to GitHub Pages, and
  share the link (each device still needs its own CSV upload unless you use the
  baked-in version).

---

## Customizing the messages

All farmer-facing text (Ilocano + English) is inside `index.html` — search for the
phrase you want to change (e.g. `naka insure ka ti mulam`) and edit it directly.
