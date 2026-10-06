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
