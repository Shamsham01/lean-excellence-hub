export async function fetchLatestEmailHref(
  email: string,
  hrefIncludes: string,
) {
  const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Unable to read Mailpit messages: ${response.status}`);
  }

  const payload = (await response.json()) as {
    messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
  };

  const message = [...(payload.messages ?? [])]
    .reverse()
    .find((entry) =>
      entry.To?.some((recipient) => recipient.Address === email),
    );

  if (!message?.ID) {
    throw new Error(`No email found for ${email}`);
  }

  const detailResponse = await fetch(
    `${mailpitUrl}/api/v1/message/${message.ID}`,
  );
  if (!detailResponse.ok) {
    throw new Error(`Unable to read Mailpit message ${message.ID}`);
  }

  const detail = (await detailResponse.json()) as {
    HTML?: string;
    Text?: string;
  };
  const body = detail.HTML ?? detail.Text ?? "";
  const hrefs = [...body.matchAll(/href="([^"]+)"/gi)].map((match) =>
    match[1]?.replace(/&amp;/g, "&"),
  );
  const href = hrefs.find((value) => value?.includes(hrefIncludes));
  if (!href) {
    throw new Error(`No ${hrefIncludes} link was found in the email body`);
  }

  return href;
}

type MailpitListEntry = {
  ID: string;
  Subject?: string;
  Snippet?: string;
  To?: Array<{ Address: string }>;
};

async function loadMailpitMessages() {
  const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Unable to read Mailpit messages: ${response.status}`);
  }

  const payload = (await response.json()) as {
    messages?: MailpitListEntry[];
  };
  return { mailpitUrl, messages: payload.messages ?? [] };
}

async function loadMailpitMessageBodies(mailpitUrl: string, messageId: string) {
  const detailResponse = await fetch(
    `${mailpitUrl}/api/v1/message/${messageId}`,
  );
  if (!detailResponse.ok) {
    throw new Error(`Unable to read Mailpit message ${messageId}`);
  }

  const detail = (await detailResponse.json()) as {
    HTML?: string;
    Text?: string;
    Subject?: string;
  };

  return {
    html: detail.HTML ?? "",
    text: detail.Text ?? "",
    subject: detail.Subject ?? "",
  };
}

export async function fetchLatestEmailBodies(email: string) {
  const { mailpitUrl, messages } = await loadMailpitMessages();
  const message = [...messages]
    .reverse()
    .find((entry) =>
      entry.To?.some((recipient) => recipient.Address === email),
    );

  if (!message?.ID) {
    throw new Error(`No email found for ${email}`);
  }

  return loadMailpitMessageBodies(mailpitUrl, message.ID);
}

export async function fetchEmailBodiesMatchingRecipient(
  email: string,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const { mailpitUrl, messages } = await loadMailpitMessages();
      const candidates = [...messages]
        .reverse()
        .filter((entry) =>
          entry.To?.some((recipient) => recipient.Address === email),
        );

      for (const entry of candidates) {
        if (!entry.ID) {
          continue;
        }
        const bodies = await loadMailpitMessageBodies(mailpitUrl, entry.ID);
        const fullHaystack = `${bodies.subject}\n${bodies.text}\n${bodies.html}`;
        if (matcher.test(fullHaystack)) {
          return bodies;
        }
      }

      throw new Error(
        `No email to ${email} matched ${matcher} (saw ${candidates.length} message(s))`,
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for email to ${email} matching ${matcher}`);
}

export async function fetchLatestEmailHrefWithRetry(
  email: string,
  hrefIncludes: string,
  timeoutMs = 20_000,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await fetchLatestEmailHref(email, hrefIncludes);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${hrefIncludes} email to ${email}`);
}
