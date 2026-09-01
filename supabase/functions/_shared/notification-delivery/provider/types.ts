export type OperationalEmailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type OperationalEmailSendResult = {
  providerMessageId: string;
};

export type OperationalEmailProvider = {
  send: (
    message: OperationalEmailMessage,
    idempotencyKey: string,
  ) => Promise<OperationalEmailSendResult>;
};

export class OperationalEmailProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode?: number | undefined;
  readonly providerErrorName?: string | undefined;

  constructor(
    code: string,
    message: string,
    options: {
      retryable: boolean;
      statusCode?: number;
      providerErrorName?: string;
    },
  ) {
    super(message);
    this.name = "OperationalEmailProviderError";
    this.code = code;
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
    this.providerErrorName = options.providerErrorName;
  }
}
