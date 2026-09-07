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
- **Paste from LinkedIn** — on a new contact, paste the text copied from a LinkedIn
  profile and click *Extract*; Claude (via the artifact `sample` capability) fills in
  name, role, company, location, industry, and a notes summary. Falls back to manual
  entry when Claude isn't available. Pasting just a URL only stores the URL — the
  sandbox can't fetch LinkedIn.
- **Autosaved draft** — while you fill in a new contact, every keystroke is saved to
  this browser (`localStorage` key `network-ledger-draft`). Close the panel, reload,
  come back hours later — the form reopens exactly where you left off, with a
  *"Restored your unsaved draft"* banner and a *Discard* link. The draft is cleared
  when you save the contact or discard it, and expires after 30 days. New contacts only;
  editing an existing contact never touches the draft.

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
