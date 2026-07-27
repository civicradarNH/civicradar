# CivicRadar — "File with BMC" and "Pledge support" flow review

Report only, no code changed. Covers the Escalation ("File with BMC") modal
in depth (it's doing the most work of the two) and a lighter pass on Pledge
support, which is already close to right.

---

## File with BMC — what's already working

Worth naming before the findings: the recommended-channel pattern here
(one prominent "Recommended: MyBMC WhatsApp" card, everything else folded
behind "More ways to file") is exactly the structure recommended for the
Resources page several reports back, and it's implemented consistently
between the two screens. That's a real win — a citizen who's seen the
pattern once on Resources doesn't have to re-learn it here.

---

## 1. The status stepper doesn't match the one on Profile

This modal shows a 5-stage tracker: **Reported → Shared → Filed →
Escalating → Resolved**. The Profile Activity card for the same report shows
a 3-stage tracker: **Reported → Pending → Resolved**. Same underlying report,
two different step counts, in two different visual styles (the Profile one
uses connected circles with a progress line; this one is a row of plain text
labels).

If the intent is "Profile gives the short version, this modal gives the
detailed breakdown," that's a reasonable design choice — but it should read
as *obviously* a zoomed-in view of the same journey, not as two unrelated
trackers that happen to both mention "reported" and "resolved." Right now
nothing signals the relationship. Recommend either: (a) make the visual
language match (same connected-circle style, this one just has more circles
in the chain), or (b) if 5 stages is genuinely more than a citizen needs to
track visually, collapse this one to the same 3 stages Profile uses, with
"Shared"/"Escalating" folded into "Pending" — one canonical status tracker
used everywhere, rather than a summary version and a detail version that
don't visually agree.

## 2. Title and subtitle both say "this is optional," once each

The modal title is "File with BMC **(optional)**"; the very first line of
the subtitle is "Filing with BMC is your choice." Same fact, stated in the
title and restated in the first sentence below it. The subtitle sentence is
the one doing real work (it explains *why* — "it starts the official
clock" — the title's parenthetical doesn't add anything the subtitle
doesn't already say better). Drop "(optional)" from the title.

## 3. "Logged on CivicRadar today" repeats what the stepper already shows

Same pattern flagged on the Profile Activity cards: a plain-text recency
line sitting directly above/near a status tracker that already communicates
the same "this was reported recently" fact more precisely. If it's removed
from the Activity cards per that earlier finding, remove it here too for the
same reason — one source of truth for status, not two.

## 4. The copy-paste block mixes a phone-call script with form-paste data

The "copy & paste when you call 1916 or use MyBMC" block includes raw
decimal GPS coordinates ("19.076000, 72.877700") inline with the
category and ward. That's exactly right for pasting into a web form or the
MARG app — but nobody reads decimal GPS coordinates aloud to a call-center
operator, and the block's own framing ("when you call 1916 **or** use
MyBMC") implies both use cases share one block. Recommend splitting the
guidance: what to *say* on a call (category, ward name, landmark — all
human-speakable) versus what to *paste* into a portal/app/WhatsApp (which
can include the coordinates). Right now a phone-call user has to visually
skip past a line they can't actually use.

## 5. Two separate channel-specific hint lines stack without a clear order

"For the call centre: read the Marathi section at the bottom of the text
block" and (immediately after, partially visible) "On the portal or MARG
app: [category path]..." are two independent instructions for two different
channels, presented as consecutive paragraphs with no visual separation
(bullet, label, or heading) distinguishing "this line is for phone calls"
from "this line is for the app/portal." A user filing via WhatsApp — the
*recommended* channel — has to read past two hints that don't apply to them
at all. Consider showing only the hint relevant to whichever channel the
user actually opened (you already know which one they tapped), instead of
all channel hints unconditionally.

## 6. "Community action (optional)" doesn't belong inside the filing flow

The Participate Mumbai volunteering/CSR block sits at the bottom of a modal
whose entire purpose is filing an official complaint — and its own copy
even says "not for filing pest-control complaints," meaning even the modal
itself is signaling this content is off-topic for where it lives. This adds
scroll length and a context-switch right at the point where a user is trying
to finish saving their complaint number (the actual task). "Help in Your
Ward" already exists as a section on the Resources page — this belongs
there, not duplicated into the filing modal.

---

## Pledge support — close to right, two small items

This screen is short, clearly organized, and the info line ("Seen only by
your ward coordinator. Follow-up happens in-app.") is a good example of the
plain-fact, one-line disclosure style established elsewhere in the app.
Only minor notes:

- The message field's placeholder trails off as "Note for volunteers—" with
  a dangling dash. If that's meant as a stylistic "continue this sentence"
  prompt it reads more like a cut-off string — a complete example placeholder
  ("e.g. Leave supplies at the society gate") would both read as intentional
  and model the kind of detail that's actually useful to a volunteer.
- No other changes suggested — this is a good short reference for what the
  filing modal's supporting sections should read like once trimmed.

---

## Priority summary

| Item | Effort | Why it matters |
|---|---|---|
| #6 Move "Community action" out of the filing modal | XS | Off-topic content inside a task-completion flow |
| #2 Drop "(optional)" from the title | XS | Restates the subtitle's first sentence |
| #3 Drop "Logged on CivicRadar today" | XS | Same fact as the stepper, stated twice |
| #5 Show only the relevant channel's hint | S | Two hints most users can't use, in every filing attempt |
| #4 Split call-script vs. form-paste guidance | S | GPS coordinates aren't something you read aloud on a call |
| #1 Reconcile the 5-stage vs. 3-stage status tracker | S–M | Same report, two different visual status languages |
| Pledge placeholder wording | XS | Minor, only if already touching this screen |

Nothing here is a rework — the filing flow's core structure (one recommended
channel, collapsed alternatives, gated complaint-number save) is sound. This
is a trim-and-reconcile pass on top of it.
