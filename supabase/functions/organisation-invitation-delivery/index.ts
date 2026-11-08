import {
  createDefaultInvitationDeliveryDependencies,
  handleOrganisationInvitationDeliveryRequest,
} from "../_shared/organisation-invitation-delivery/handler.ts";

const dependencies = createDefaultInvitationDeliveryDependencies();

Deno.serve((request) =>
  handleOrganisationInvitationDeliveryRequest(request, dependencies),
);
