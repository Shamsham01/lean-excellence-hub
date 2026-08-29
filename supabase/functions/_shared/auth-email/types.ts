export type SendEmailHookPayload = {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string;
    old_phone?: string;
    provider?: string;
    factor_type?: string;
  };
};

export type AuthEmailDelivery = {
  subject: string;
  html: string;
  text: string;
  confirmUrl: string;
};

export type AuthEmailBuildResult =
  | { ok: true; delivery: AuthEmailDelivery }
  | {
      ok: false;
      reason: "unsupported_action" | "missing_token_hash" | "invalid_origin";
    };
