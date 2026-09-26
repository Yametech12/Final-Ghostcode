---
name: Bug report
<<<<<<< ours
about: Report something broken in Epimetheus
title: '[bug] '
labels: [bug]
assignees: ''
---

### Description

<!-- A clear and concise description of the bug. -->

### Steps to reproduce
=======
about: Something is broken
title: '[bug] '
labels: bug
assignees: ''
---

<!--
STOP — is this a security vulnerability?
Report it privately per SECURITY.md. Do NOT open a public issue for a
vulnerability. That includes: another user's data being readable, a way to reach
`admin`, a leaked secret, or an RLS gap.
-->

## What happened

<!-- One or two sentences. What did you expect, and what happened instead? -->

## How to reproduce
>>>>>>> theirs

1.
2.
3.

<<<<<<< ours
### Expected behavior

### Actual behavior

### Screenshots / recordings

<!-- Drag images or screen recordings here. -->

### Environment

- Platform: [desktop web / mobile web / PWA]
- Browser:
- OS:
- URL / route:

### Logs

<details>
<summary>Console / server logs</summary>

```
paste logs here
```

</details>
=======
**Reproducible every time?**

- [ ] Yes, every time
- [ ] Intermittent
- [ ] Only happened once

## Where

| | |
| --- | --- |
| Environment | local dev / Vercel preview / production |
| Route or page | e.g. `/calibration` |
| Browser + version | e.g. Chrome 128 |
| Theme | dark / light |
| Signed in? | yes (tier: free / strategist / oracle) / no |
| Admin? | yes / no |

## Evidence

**Console and network errors.** Open devtools → Console, plus the failing request
in Network. Redact tokens and personal data.

```
```

**If the server returned a 500, include the `requestId` from the response body.**
It maps to a server log line, and without it the report cannot be traced:

```
requestId:
```

**Screenshots or a screen recording** — drag them in here.

## What I have already ruled out

<!--
Worth including: did you test in the other theme? A hard reload (service worker)?
A different browser? This saves a round trip.
-->

## Additional context

<!-- Anything else: related issues, when it started, whether it worked before. -->
>>>>>>> theirs
