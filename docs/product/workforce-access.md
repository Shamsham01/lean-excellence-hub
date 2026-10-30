# Workforce access

## Personal name and organisation name

Lean Excellence Hub keeps two names for a person.

| Name | Where it is stored | What it is for |
| --- | --- | --- |
| Personal profile name | `profiles.display_name` | The name on the person's own account. It stays with them when they belong to more than one organisation. |
| Organisation membership name | `organisation_memberships.display_name` | The name used inside one organisation. Directories, capability profiles, and other organisation screens prefer this name. |

An administrator can enter a name when creating an invitation. That name is stored as the invitation's intended membership name and is copied when the invitation is reissued. Reissue does not copy a confirmation the invitee made on the previous link.

The invitee can confirm or correct the name while creating an account and again while accepting the invitation. They do not need to open Settings to give a blank profile a name.

Acceptance applies the name in this order:

1. The name the invitee confirmed on the invitation.
2. The name the invitee confirmed while creating the account.
3. The name the administrator entered.

Acceptance writes that name only where the current value is blank:

- A new membership with no name receives the invited name.
- A personal profile with no name receives the same name.
- A personal profile name the person has already chosen stays unchanged.
- A membership name that already exists in that organisation stays unchanged.
- Joining a second organisation sets that organisation's membership name and leaves the first organisation's membership name and the personal profile name in place.

Settings shows the personal name and the current organisation's membership name separately. If the personal profile is blank, the personal-name field offers the organisation membership name so it can be saved. A failure to load the membership is shown as a load error. It is not presented as a missing assignment.

## Invitation roles and scopes

An invitation can contain more than one application role. Each role has its own scope. A person who can edit records at one site and view records at another site does not gain edit permission at the second site.

Creating, reissuing, and accepting an invitation checks every role and scope together. If any role is retired, outside the inviter's current authority, or paired with a scope that role does not allow, the whole invitation is rejected. No grant is saved on its own, and no grant is dropped silently. Reissue copies every role and scope, and the invited organisation name. Accepting the same invitation again does not create a second membership or a second set of grants.

A job function describes the person's work. It does not grant application permissions. Permissions come only from the roles and scopes on the invitation or from a later access grant.

Suggestions Contributor is a separate role from Suggestions. It allows a person to submit suggestions in the granted scope and to open the suggestions they created, including drafts. It does not include the review portfolio, reviewer notes, programme administration, or `suggestions.read`. The existing Suggestions role is unchanged and does not gain submission rights through this role.

Suggestions navigation is available with `suggestions.read`, Workplace Viewer, or `suggestions.submit`. A member whose grants do not include `suggestions.read` sees the submission and own-suggestion view. Shared suggestions appear there only when they also hold Workplace Viewer. The portfolio, review queue, and programme tools stay on the `suggestions.read` path. Creating a suggestion still checks submission scope and the member's primary work area. A member without `suggestions.submit` does not see New suggestion.

An existing invitation that contains one role continues to be issued, reissued, and accepted.

## Your access

Settings → Profile shows Your access after the membership profile loads. Each active role is listed with its scope. Expired and revoked grants are left out. A failure to load the profile is an error. It is not shown as “No active access grants” or “Not assigned”.

Home shows the workplace activity a member is allowed to see, plus their own profile. A metric that needs a module read permission stays hidden when that permission is absent, so a zero is not used to mean that the permission is missing. When a member also holds Workplace Viewer, Home keeps that shared activity beside the module metrics their other grants allow.

LeanAI setup tasks that need administration stay hidden without that permission. When LeanAI conversation is not enabled for the member, the assistant says so and does not present the conversation as available.

## Workplace viewing matrix

Workplace Viewer is a separate role. It is not Team Member, and it does not receive every permission whose name ends in “read”. The only permission on the role is `workplace.view`, granted at either organisation scope or one site subtree. Job function still does not grant these permissions.

A site grant covers that site and its units. It does not cover a sibling site. An organisation grant covers every site. Viewing never adds editing, review, programme administration, or administration.

| Area | Viewing includes | Scope | Kept out |
| --- | --- | --- | --- |
| Maturity and frameworks | Published framework names and published official results: score, status, site, and published date | Site or organisation | Draft frameworks, in-progress assessments, criterion answers, assessor notes, and evidence attached to an unpublished assessment |
| 5S | Published standard names and completed audit results: standard, area, score, and completed date | Site or organisation | Draft standards, in-progress or cancelled audits, and named audit participants |
| Gemba | Published walk definitions and completed walks: name, area, and completed date | Site or organisation | Draft definitions and in-progress walks |
| Actions | Open, in-progress, completed, and verified actions: title, status, priority, area, and due date | Site or organisation | Creating, assigning, completing, or verifying an action. Cancelled actions stay out of the viewer feed |
| Projects | Submitted, approved, active, on-hold, and completed projects: title, status, priority, and area | Site or organisation | Draft projects and charter financial fields |
| Benefits | Approved, realising, and realised benefits: title, class, non-financial type, status, and area | Site or organisation | Amounts, currencies, baselines, realisation values, and financial evidence |
| Problem solving | Active and closed cases: title, status, area, and closed date | Site or organisation | Draft cases, participant lists, hypotheses, and analysis notes |
| Suggestions | Submitted and later shared statuses: title, status, and area. A person’s own drafts stay available through Suggestions Contributor | Site or organisation | The review portfolio, reviewer notes, and programme administration. Suggestions Contributor remains the submission role |
| Recognition | Active awards whose visibility is the unit or the organisation: title, message, and area | Site or organisation | Recipient-only awards, revoked awards, and the recipient list |
| Skills | Active skill catalogue: name, code, and category | Organisation catalogue when any workplace view is granted | Draft skills and every employee’s assessment, including scores and evidence |
| Training | Active course catalogue: name and code. A person’s own completed courses | Organisation catalogue; own records only | Other employees’ completions and sign-off evidence |
| People | The signed-in member’s own profile, job function, primary work area, and effective grants | Self | The people directory, another person’s capability profile, administration, and self-service editing of someone else’s record |

Published framework names, 5S standards, and Gemba definitions appear when any workplace view is held, because those catalogues are organisation records. Completed audits, walks, actions, and the other operational rows stay inside the granted site. A person’s own completed training is included. Other employees’ completions are not.

The shared list is paged in the database, 25 records at a time, in a stable order. Next and previous links load the following page. Opening a record uses its id and the same scope, status, and publication filters. That lookup does not depend on which page of the list is currently shown.

A member who can use a module at one site and view another site keeps the normal module page for the first site. Shared workplace records for the viewing grant appear in a separate section on that page and on Home. The section links to the workplace summary. It does not merge those rows into the module’s read or write API, and it does not add create, edit, approval, or administration at the viewed site. A sibling site stays out of both experiences unless a grant covers it. An organisation grant covers every site.

Workplace Viewer does not add attachment download, module export, or workplace search. Those routes keep their existing authorization. There is no workplace search index. LeanAI may explain a module the person can view. It does not retrieve records outside the table above, and it does not describe conversation as available unless that separate capability is turned on. Existing read functions that return restricted columns stay unchanged, so holding Workplace Viewer does not open financial amounts, draft detail, or another person’s assessment.

Operator access is an invitation preset. It adds Workplace Viewer and Suggestions Contributor at the chosen site. An administrator can remove or change either row before creating the invitation. Assigning Workplace Viewer to someone who is already a member uses the existing access grant, which records the grantor, role, and scope. Publishing the role does not grant it to existing members, and it does not change Team Member or Suggestions.
