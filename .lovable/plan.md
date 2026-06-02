## Fix: "Complete Profile" button does nothing (clinician `/clinician/review`)

### Root cause
In `src/pages/PatientHub.tsx`, the `ProfileCompletenessBanner`'s `onEditProfile` only calls `setActiveTab("plan")`. But the `Tabs` (and the Plan tab's profile editor) are nested inside a `Collapsible` "Clinical Detail" drawer that is **uncontrolled and collapsed by default**. So the tab silently switches while the drawer stays closed and off-screen — nothing visible happens.

### Fix (single file, presentation-only)
`src/pages/PatientHub.tsx`:
1. Add controlled open state for the drawer: `const [detailOpen, setDetailOpen] = useState(false)` and make `<Collapsible open={detailOpen} onOpenChange={setDetailOpen}>`.
2. Update the banner handler so it opens the drawer, selects the Plan tab, and scrolls the editor into view:
   ```ts
   onEditProfile={() => {
     setDetailOpen(true);
     setActiveTab("plan");
     requestAnimationFrame(() =>
       document.getElementById("plan-recovery")?.scrollIntoView({ behavior: "smooth", block: "start" })
     );
   }}
   ```
   (`requestAnimationFrame` lets the collapsible content mount before scrolling.)

No engine, scoring, data, or schema changes. Clinical-detail drawer keeps its default-collapsed behavior for normal use.

### Verify
- Drive `/clinician/review` in the preview, click "Complete Profile" → drawer expands, Plan tab active, profile editor (`RecoveryProfileSection`) scrolled into view.
- Confirm no console errors and the drawer still toggles normally via its own trigger.

---

After this fix is confirmed, proceed with the previously-approved **Full QA Hardening Initiative** starting at Phase 0 (test infra + `.lovable/qa-hardening.md` tracker) and Phase 1 (Patient sweep).