## Audit Report: Kermes KDS Access for Sevket Ay

**Goal:** Ensure Sevket Ay can successfully access the Kermes KDS Workspace in the admin portal instead of being forced into "Tuna Kebaphaus & Pizzeria" without a workspace chooser.

**Problem Found:**
Sevket Ay was assigned to the Kermes Event "Four-Days Kulturevent (Hückelhoven)" in the `kermes_events/FqEryG6UAXn4mLna2j8S` document as staff/driver. However, his individual `users` and `admins` Firestore documents (`v445u4EsvYfoTwUu8IKDDsarVOq2`) did not have the corresponding `assignments` or `kermesAssignments` fields correctly updated to point to the Kermes app.
Because `AdminProvider` couldn't find an `assignments` array and his profile fell back to `businessId: KjdsF3N5ACtEKfTprwJW` (Tuna Kebaphaus & Pizzeria), he never triggered the `needsWorkspaceSelection: true` mode. As a result, the admin portal always logged him directly into the Tuna Kebaphaus context.

**Solution Executed:**
Created a Firebase database mutation script locally to fetch the specific user `v445u4EsvYfoTwUu8IKDDsarVOq2` (Sevket Ay) and populate his `assignments`, `kermesAssignments`, and `assignedKermesEvents`. 
He now has correctly structured assignments for both:
1. Tuna Kebaphaus & Pizzeria (`business`)
2. Ziyafet Restaurant (`business`)
3. Four-Days Kulturevent (Hückelhoven) (`kermes`)

**Test Verification:**
When Sevket Ay now logs into the admin portal, `needsWorkspaceSelection` will resolve to `true`, and he will see the black "Çalışma Alanı Seçin" (Workspace Selector) screen. From there, he can select the "Four-Days Kulturevent (Hückelhoven)" to enter the Kermes KDS successfully.

