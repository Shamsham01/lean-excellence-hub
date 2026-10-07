export function organisationNameMatchesConfirmation(
  organisationName: string,
  confirmation: string,
) {
  return organisationName.trim() === confirmation.trim();
}
