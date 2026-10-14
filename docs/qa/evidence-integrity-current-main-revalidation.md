# Evidence-integrity revalidation against current main

The captured-attempt and clinician-observation changes were written against an earlier main baseline. Revalidate the complete synthetic merge against current main before any merge.

Safeguards:
- No production database migration or clinical data rewrite in this PR.
- Speech attempt identity must remain immutable across asynchronous analysis and navigation.
- Save acknowledgement must reflect an actual persisted database row.
- Inspect any changes to scored evidence and clinician report interpretation.
- Synthetic CI is not a substitute for staging multi-role API checks, true speech hardware, or clinical validation.
