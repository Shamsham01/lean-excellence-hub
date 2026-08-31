const DELIVERY_KEY_MAX_LENGTH = 200;

export function buildDeliveryKey(
  notificationKind: string,
  eventId: string,
  recipientMembershipId: string,
): string {
  const deliveryKey = `${notificationKind}:${eventId}:${recipientMembershipId}`;

  if (deliveryKey.length > DELIVERY_KEY_MAX_LENGTH) {
    throw new Error(
      `delivery_key exceeds ${DELIVERY_KEY_MAX_LENGTH} characters`,
    );
  }

  return deliveryKey;
}
