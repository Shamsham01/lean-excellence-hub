import { z } from "zod";

const attentionOrganisationSchema = z.object({
  billing_state: z.string().nullable().optional(),
  code: z.string(),
  created_at: z.string(),
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

const countSchema = z.coerce.number().int();

export const platformOverviewSchema = z.object({
  active_sites: countSchema,
  attention: z.object({
    failed_billing: z.array(attentionOrganisationSchema),
    failed_billing_count: countSchema,
    incomplete_onboarding: z.array(attentionOrganisationSchema),
    incomplete_onboarding_count: countSchema,
    no_subscription: z.array(attentionOrganisationSchema),
    no_subscription_count: countSchema,
  }),
  confirmed_founders: countSchema,
  confirmed_identities: countSchema,
  notification_delivery_enabled: z.boolean(),
  notification_recipient: z.string(),
  organisations: z.object({
    active: countSchema,
    closed: countSchema,
    provisioning: countSchema,
    suspended: countSchema,
  }),
  plans: z.array(
    z.object({
      billing_interval: z.string(),
      earliest_period_end: z.string().nullable(),
      organisations: countSchema,
      plan_code: z.string(),
      subscribed_sites: countSchema,
    }),
  ),
  recent_access: z.array(
    z.object({
      action: z.string(),
      occurred_at: z.string(),
      outcome: z.string(),
      request_path: z.string().nullable(),
    }),
  ),
  registered_identities: countSchema,
  subscribed_site_capacity: countSchema,
  unconfirmed_founder_bindings: countSchema,
  verified_customers: countSchema,
  verified_customers_live_mode: countSchema,
  verified_customers_mode_unknown: countSchema,
  verified_customers_test_mode: countSchema,
});

export const directoryRowSchema = z.object({
  active_site_count: countSchema,
  billing_interval: z.string().nullable(),
  billing_state: z.string().nullable(),
  cancel_at_period_end: z.boolean().nullable(),
  checkout_open: z.boolean().nullable(),
  code: z.string(),
  country_code: z.string().nullable(),
  created_at: z.string(),
  current_period_end: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  onboarding_required: z.boolean(),
  owner_display_name: z.string().nullable(),
  owner_email: z.string().nullable(),
  plan_code: z.string().nullable(),
  provider_customer_id: z.string().nullable(),
  provider_subscription_id: z.string().nullable(),
  site_quantity: countSchema.nullable(),
  status: z.string(),
  stripe_livemode: z.boolean().nullable(),
  subscription_provider: z.string().nullable(),
  verified_customer: z.boolean(),
});

export const platformDirectorySchema = z.object({
  limit: countSchema,
  offset: countSchema,
  rows: z.array(directoryRowSchema),
  total: countSchema,
});

export const platformOrganisationDetailSchema = z.object({
  access: z
    .object({
      billing_state: z.string().nullable(),
      checkout_open: z.boolean().nullable(),
      onboarding_required: z.boolean(),
      organisation_status: z.string(),
      verified_customer: z.boolean(),
    })
    .optional(),
  billing: z
    .object({
      account_provider: z.string().nullable(),
      billing_interval: z.string().nullable(),
      billing_state: z.string().nullable(),
      cancel_at_period_end: z.boolean().nullable(),
      checkout_open: z.boolean().nullable(),
      current_period_end: z.string().nullable(),
      current_period_start: z.string().nullable(),
      grace_expires_at: z.string().nullable(),
      intended_site_quantity: countSchema.nullable(),
      plan_code: z.string().nullable(),
      provider_customer_id: z.string().nullable(),
      provider_subscription_id: z.string().nullable(),
      site_quantity: countSchema.nullable(),
      stripe_livemode: z.boolean().nullable(),
      stripe_mode_observed_at: z.string().nullable(),
      subscription_provider: z.string().nullable(),
    })
    .optional(),
  found: z.boolean(),
  notifications: z
    .array(
      z.object({
        attempt_count: countSchema,
        created_at: z.string(),
        event_kind: z.string(),
        id: z.string(),
        last_error: z.string().nullable(),
        sent_at: z.string().nullable(),
        status: z.string(),
        suppressed_reason: z.string().nullable(),
      }),
    )
    .optional(),
  organisation: z
    .object({
      code: z.string(),
      country_code: z.string().nullable(),
      created_at: z.string(),
      id: z.string(),
      locale: z.string(),
      multi_site_intent: z.string().nullable(),
      name: z.string(),
      onboarding_required: z.boolean(),
      owner_display_name: z.string().nullable(),
      owner_email: z.string().nullable(),
      status: z.string(),
      status_changed_at: z.string(),
      status_reason: z.string().nullable(),
      time_zone: z.string(),
    })
    .optional(),
  security_events: z
    .array(
      z.object({
        action: z.string(),
        occurred_at: z.string(),
        outcome: z.string(),
      }),
    )
    .optional(),
  sites: z
    .array(
      z.object({
        code: z.string(),
        id: z.string(),
        name: z.string(),
        status: z.string(),
      }),
    )
    .optional(),
  webhooks: z
    .array(
      z.object({
        event_type: z.string(),
        last_error: z.string().nullable(),
        processed_at: z.string().nullable(),
        processing_state: z.string(),
        provider: z.string(),
        provider_event_id: z.string(),
        received_at: z.string(),
      }),
    )
    .optional(),
});

export const platformNotificationHistorySchema = z.object({
  delivery_enabled: z.boolean(),
  limit: countSchema,
  offset: countSchema,
  recipient_email: z.string(),
  rows: z.array(
    z.object({
      attempt_count: countSchema,
      created_at: z.string(),
      event_kind: z.string(),
      id: z.string(),
      idempotency_key: z.string(),
      last_error: z.string().nullable(),
      next_attempt_at: z.string(),
      organisation_id: z.string().nullable(),
      organisation_name: z.string().nullable(),
      payload: z.record(z.string(), z.unknown()),
      sent_at: z.string().nullable(),
      source_event_id: z.string().nullable(),
      status: z.string(),
      suppressed_reason: z.string().nullable(),
    }),
  ),
  total: countSchema,
});

export type PlatformOverview = z.infer<typeof platformOverviewSchema>;
export type PlatformDirectory = z.infer<typeof platformDirectorySchema>;
export type PlatformOrganisationDetail = z.infer<
  typeof platformOrganisationDetailSchema
>;
export type PlatformNotificationHistory = z.infer<
  typeof platformNotificationHistorySchema
>;
