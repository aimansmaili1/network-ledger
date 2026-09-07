# Network Ledger

A personal CRM for nurturing professional relationships built through the LBS network —
classmates, speakers, alumni, and recruiters. Track each contact through a relationship
pipeline, log touchpoints, and never lose sight of who needs a follow-up.

## Features

- **Pipeline board** — five stages: New, Reaching out, Nurturing, Established, Dormant.
  Drag cards between columns to move a relationship forward.
- **List view** — a searchable worklist, sorted so overdue follow-ups surface first.
- **Rich contact records** — role, company, industry, location, email, phone, LinkedIn,
  how you met / LBS context, relationship strength, tags, last contact, next follow-up,
  and free-form notes.
- **Follow-up tracking** — overdue dates flagged red, due-today amber; one click to
  "log a touch today" and schedule the next one.
- **Filters** — by stage, relationship strength, follow-ups due, and full-text search.

## Running it

This is a single, dependency-free HTML file. Open `index.html` in a browser, or serve
the folder with any static server:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

### Data storage

The app is designed to run as a **Claude Artifact**, where it syncs contacts to a
cloud database. Outside that environment (opening the file directly, GitHub Pages,
any other static host) it automatically falls back to **browser localStorage** — data
is saved, but only in that one browser on that one device.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No build step, no framework, no npm.
