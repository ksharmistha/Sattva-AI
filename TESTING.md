# Testing Checklist

Automated: `npm test` (28 tests, 4 suites) — see `__tests__/`.
Manual: see `TESTING_GUIDE.md` for the full script.

Quick pre-demo smoke test:

- [ ] `npm run validate` passes (lint + tests)
- [ ] `npm run check:ai` reports a valid key (or you accept offline mode)
- [ ] App boots to the login screen with no console errors
- [ ] Log in succeeds
- [ ] Mood selection saves and produces a reply
- [ ] Chat reply arrives and is contextual
- [ ] Crisis phrase opens the resources modal
- [ ] "this is too much" does *not* trigger a greeting
- [ ] Calendar shows today's mood
- [ ] Stats charts render with an insight card
- [ ] Exercises: breathing timer runs
- [ ] Log out works
