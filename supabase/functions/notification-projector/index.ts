import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleNotificationProjectorRequest } from "../_shared/notification-projector/handler.ts";
import { createNotificationProjectorWorkerClient } from "../_shared/notification-projector/worker-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve((request) =>
  handleNotificationProjectorRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createWorkerClient: () => {
      const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      return createNotificationProjectorWorkerClient({
        rpc: (fn, args) => serviceClient.rpc(fn, args),
        lookupRecognitionRecipients: async (organisationId, awardId) => {
          const { data, error } = await serviceClient
            .from("recognition_recipients")
            .select("membership_id")
            .eq("organisation_id", organisationId)
            .eq("recognition_award_id", awardId);

          if (error) {
            throw error;
          }

          return (data ?? []).map((row) => row.membership_id);
        },
        lookupSuggestionAuthorMembershipId: async (
          organisationId,
          suggestionId,
        ) => {
          const { data, error } = await serviceClient.rpc(
            "lookup_suggestion_author_membership_id_for_worker",
            {
              target_organisation_id: organisationId,
              target_suggestion_id: suggestionId,
            },
          );

          if (error) {
            throw error;
          }

          return typeof data === "string" ? data : null;
        },
      });
    },
  }),
);
