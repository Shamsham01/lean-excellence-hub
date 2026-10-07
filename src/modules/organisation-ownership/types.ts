export type OrganisationOwnerSummary = {
  membershipId: string;
  displayName: string;
  email: string | null;
};

export type OwnershipTransferGrantSummary = {
  roleDisplayName: string;
  roleCanonicalName: string;
  scopeType: string;
  scopeLabel: string;
};

export type OwnershipTransferTarget = {
  membershipId: string;
  displayName: string;
  email: string | null;
  isAlreadyOwner: boolean;
  grants: OwnershipTransferGrantSummary[];
};

export type OrganisationOwnershipSnapshot = {
  organisationId: string;
  organisationName: string;
  canTransfer: boolean;
  canViewOwners: boolean;
  owners: OrganisationOwnerSummary[];
};

export type OwnershipTransferResult = {
  organisationId: string;
  sourceMembershipId: string;
  targetMembershipId: string;
  transferred: boolean;
};
