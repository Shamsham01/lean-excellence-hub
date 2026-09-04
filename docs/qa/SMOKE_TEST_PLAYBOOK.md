# LEH Smoke Test Playbook — CookieWorks QA Tenant

Manual acceptance tracker for the CookieWorks Manufacturing (`cookieworks-manufacturing`) QA tenant.

## Preconditions

- CookieWorks tenant reset to foundation-only (`npm run qa:cookie:reset` locally, or hosted maintainer reset).
- Inventory shows zero module/business records.
- Tester has persona credentials from `docs/development/qa-tenant.md`.

## Module order

1. Organisation / workforce / permissions
2. Maturity
3. 5S
4. Gemba
5. Scheduling
6. Training
7. Skills
8. Suggestions
9. Recognition
10. CI Projects
11. Benefits
12. Problem Solving
13. AI

## Result legend

| Value | Meaning |
| --- | --- |
| PASS | Observed behaviour matches expected result |
| FAIL | Incorrect behaviour — log bug/reference |
| BLOCKED | Cannot execute due to dependency/defect |

---

## 1. Organisation / workforce / permissions

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-01 | Admin login | Admin | Foundation reset complete | Sign in at `/login` | Redirected to platform shell with CookieWorks context | | | | |
| ORG-02 | Hierarchy visible | Admin | ORG-01 | Open organisation/hierarchy settings | Bodmin Cookie Factory tree with Operations subtree and support departments | | | | |
| ORG-03 | Operator restricted scope | Operator | ORG-01 | Attempt admin-only configuration | Forbidden or hidden controls | | | | |
| ORG-04 | CI manager org-wide access | CI Manager | ORG-01 | Open settings requiring org-wide permissions | Permitted where configured | | | | |
| ORG-05 | Finance least privilege | Finance | ORG-01 | Open non-benefits admin areas | No access to unrelated admin modules | | | | |

---

## 2. Maturity (first detailed module)

### 2.1 Framework configuration

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-01 | Empty state | Admin or CI Manager | No maturity framework exists | Open `/platform/maturity` | Useful empty state explaining no framework configured | | | | |
| MAT-02 | Create framework draft | Admin or CI Manager | MAT-01 | Create new Lean maturity framework | Draft framework created with editable metadata | | | | |
| MAT-03 | Add maturity levels | Admin or CI Manager | MAT-02 | Add levels (e.g. L1–L5) | Levels saved in draft framework | | | | |
| MAT-04 | Add pillars | Admin or CI Manager | MAT-02 | Add pillars (e.g. Leadership, Daily Management) | Pillars appear in builder | | | | |
| MAT-05 | Add criteria/questions | Admin or CI Manager | MAT-04 | Add criteria and linked scored questions | Criteria/questions saved and linked | | | | |
| MAT-06 | Edit draft framework | Admin or CI Manager | MAT-05 | Modify draft name/description/structure | Changes persist after refresh | | | | |
| MAT-07 | Publish framework | Admin or CI Manager | MAT-06 | Publish framework version | Published version visible; draft immutability rules enforced | | | | |
| MAT-08 | Published immutability | Admin or CI Manager | MAT-07 | Attempt to edit published version in place | Product requires new version or blocks silent mutation | | | | |
| MAT-09 | Version history | Admin or CI Manager | MAT-07 | View framework versions | Published version retained/versioned per product rules | | | | |

### 2.2 Self assessment

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-10 | Initiate self assessment | CI Manager or Production Manager | MAT-07 | Start self assessment for Bodmin/site scope | Assessment created in draft/in-progress state | | | | |
| MAT-11 | Assign organisational scope | CI Manager | MAT-10 | Select unit scope (site/department as supported) | Scope stored and reflected in assessment header | | | | |
| MAT-12 | Operator answers criteria | Operator or Team Leader | MAT-10 | Open assigned assessment and answer criteria | Answers save for accessible criteria | | | | |
| MAT-13 | Save draft answers | Operator | MAT-12 | Save without submitting | Draft state retained | | | | |
| MAT-14 | Navigate away/back | Operator | MAT-13 | Leave page and return | Answers persist | | | | |
| MAT-15 | Incomplete behaviour | Operator | MAT-13 | Attempt submit with missing required answers | Validation/incomplete state shown; submit blocked or warned per rules | | | | |
| MAT-16 | Submit assessment | Operator | MAT-14 | Complete required answers and submit | Status moves to submitted/review-ready per workflow | | | | |

### 2.3 Evidence

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-17 | Upload image evidence | Operator | MAT-12 | Upload supported image to criterion/answer | Evidence attached and visible in assessment | | | | |
| MAT-18 | Upload document evidence | Operator | MAT-12 | Upload supported document (PDF/office as supported) | Evidence attached successfully | | | | |
| MAT-19 | Associate evidence to criterion | Operator | MAT-17 | Link evidence to correct criterion/answer | Association visible on review screens | | | | |
| MAT-20 | Preview/download evidence | Assessor | MAT-16 | Open evidence from review UI | Preview/download works for permitted user | | | | |
| MAT-21 | Permission boundary | Operator | MAT-17 | Sign in as unrelated persona without access | Evidence not visible/editable | | | | |
| MAT-22 | Remove/replace evidence | Operator | MAT-17 | Remove or replace permitted evidence | Update reflected; old file handled per policy | | | | |
| MAT-23 | Unsupported/oversized file | Operator | MAT-12 | Upload disallowed type or oversized file | Clear validation error; no partial corrupt state | | | | |

### 2.4 Formal assessment / review

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-24 | Assessor opens submitted assessment | Assessor | MAT-16 | Open submitted assessment queue/detail | Answers and evidence visible | | | | |
| MAT-25 | Review answers/evidence | Assessor | MAT-24 | Review criterion responses | Review UI shows self-assessment content | | | | |
| MAT-26 | Score/assess criteria | Assessor | MAT-25 | Enter formal scores/assessments | Scores saved in review state | | | | |
| MAT-27 | Reviewer comments/actions | Assessor | MAT-25 | Add reviewer comments where supported | Comments persist and are visible to permitted roles | | | | |
| MAT-28 | Send back / request correction | Assessor or CI Manager | MAT-25 | Request correction if supported | Assessment returns to correctable state for respondent | | | | |
| MAT-29 | Complete assessment review | Assessor | MAT-26 | Complete assessor review step | Moves to approval/publish queue per workflow | | | | |

### 2.5 Approval / official result

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-30 | Approval by authorised persona | CI Manager or Production Manager | MAT-29 | Approve assessed result | Approval recorded | | | | |
| MAT-31 | Publish official result | CI Manager | MAT-30 | Publish official maturity result | Official snapshot created | | | | |
| MAT-32 | Overall score verification | CI Manager | MAT-31 | View official result summary | Overall score matches answered/scored data | | | | |
| MAT-33 | Pillar scores | CI Manager | MAT-31 | View pillar breakdown | Pillar scores present and consistent | | | | |
| MAT-34 | Maturity level mapping | CI Manager | MAT-31 | View assigned maturity level | Level aligns with configured thresholds/rules | | | | |
| MAT-35 | Official snapshot immutability | Admin | MAT-31 | Attempt silent edit of published official result | Mutation blocked; versioning/history preserved | | | | |

### 2.6 Permissions

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-36 | Admin configure framework | Admin | MAT-01 | Configure/publish framework | Allowed | | | | |
| MAT-37 | Operator forbidden configure | Operator | MAT-01 | Attempt framework builder access | Forbidden/hidden | | | | |
| MAT-38 | Assessor formal review only | Assessor | MAT-16 | Perform review without admin rights | Review allowed; admin-only actions forbidden | | | | |
| MAT-39 | Finance no maturity admin | Finance | MAT-01 | Open maturity admin routes | Forbidden/hidden | | | | |

### 2.7 Mobile (after desktop PASS)

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-40 | Mobile self-assessment journey | Operator | Desktop MAT-12..MAT-16 PASS | Repeat core answer/save/submit flow on mobile viewport | Same functional outcome on mobile | | | | |
| MAT-41 | Mobile evidence upload | Operator | Desktop MAT-17 PASS | Upload image evidence on mobile viewport | Evidence attaches and displays | | | | |
| MAT-42 | Mobile assessor review | Assessor | Desktop MAT-24 PASS | Open submitted assessment on mobile | Review readable and actionable | | | | |

---

## 3. 5S

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5S-01 | Empty state | CI Manager | Maturity module baseline complete (optional) | Open 5S module with no standards | Empty state shown | | | | |
| 5S-02 | Create/publish standard | CI Manager | 5S-01 | Build and publish 5S standard | Published standard available for audits | | | | |
| 5S-03 | Perform audit | Operator | 5S-02 | Start and complete audit for Operations area | Audit saved with score | | | | |

---

## 4. Gemba

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GEM-01 | Empty state | CI Manager | Foundation only | Open Gemba with no definitions | Empty state shown | | | | |
| GEM-02 | Publish definition | CI Manager | GEM-01 | Create/publish Gemba definition | Definition available for walks | | | | |
| GEM-03 | Complete walk | Team Leader | GEM-02 | Perform walk with observation | Walk completed and listed | | | | |

---

## 5. Scheduling

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCH-01 | Create schedule | Production Manager | 5S and/or Gemba artefacts exist | Create recurring schedule | Schedule appears in calendar/list | | | | |
| SCH-02 | Complete occurrence | Operator | SCH-01 | Mark occurrence complete | Completion recorded | | | | |

---

## 6. Training

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRN-01 | Create course | CI Manager | Foundation only | Create/publish training course | Course available in catalogue | | | | |
| TRN-02 | Record completion | Production Manager | TRN-01 | Record operator completion | Completion visible on profile/capability views | | | | |

---

## 7. Skills

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SKL-01 | Define skill + scale | CI Manager | Foundation only | Create skill and proficiency scale | Published capability requirements configurable | | | | |
| SKL-02 | Record assessment | Production Manager | SKL-01 | Assess operator skill level | Assessment stored | | | | |

---

## 8. Suggestions

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SUG-01 | Programme setup | CI Manager | Foundation only | Create/publish suggestion programme | Operator can submit suggestions | | | | |
| SUG-02 | Submit suggestion | Operator | SUG-01 | Submit improvement suggestion | Suggestion enters review queue | | | | |
| SUG-03 | Manager review | Production Manager | SUG-02 | Review/decision on suggestion | Status updated with audit trail | | | | |

---

## 9. Recognition

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REC-01 | Configure recognition type | CI Manager | Foundation only | Create recognition type | Type available for awards | | | | |
| REC-02 | Award recognition | Production Manager | REC-01 + implemented suggestion (optional) | Award operator | Award visible to recipients | | | | |

---

## 10. CI Projects

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRJ-01 | Create draft project | CI Manager | Foundation only | Create improvement project draft | Draft saved | | | | |
| PRJ-02 | Advance lifecycle | Production Manager | PRJ-01 | Submit/approve/start per methodology | Lifecycle transitions succeed | | | | |

---

## 11. Benefits

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BEN-01 | Create benefit | CI Manager | PRJ-01 optional | Create benefit draft/forecast | Benefit enters validation workflow | | | | |
| BEN-02 | Finance validation | Finance | BEN-01 submitted | Approve/reject as finance validator | Finance decision recorded | | | | |

---

## 12. Problem Solving

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PS-01 | Create case | CI Manager | Foundation only (builtin methods expected) | Create and activate problem-solving case | Case visible in portfolio | | | | |
| PS-02 | Contributor access | Operator | PS-01 | Add contribution/observation | Contributor can add permitted content only | | | | |

---

## 13. AI

| Test ID | Scenario | Persona | Preconditions | Action | Expected result | Actual result | PASS/FAIL/BLOCKED | Bug/ref | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | Enable tenant AI setting | Admin | Foundation only | Enable AI in organisation settings | AI features available to permitted personas | | | | |
| AI-02 | Start guided session | CI Manager | AI-01 | Start AI session in supported module | Session recorded in history | | | | |

---

## Execution notes

- Record **Actual result** and **PASS/FAIL/BLOCKED** during manual runs only — do not mark PASS because automated tests exist elsewhere.
- Link defects to tracker IDs in **Bug/ref**.
- Re-run `npm run qa:cookie:inventory` after reset to confirm Day Zero before each module cycle.
