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

Suggestions Contributor is a separate role from Suggestions. It allows a person to submit suggestions in the granted scope. It does not include review, programme administration, or the suggestions portfolio. The existing Suggestions role is unchanged and does not gain submission rights through this role.

An existing invitation that contains one role continues to be issued, reissued, and accepted.
