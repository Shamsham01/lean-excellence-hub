import { expect, type Page } from "@playwright/test";

const SCOPE_ENTITIES_RPC_PATH =
  "/rest/v1/rpc/list_maturity_assessment_scope_entities";

type ScopeEntityRow = {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string;
};

function isScopeEntitiesRpcResponse(url: string, method: string): boolean {
  return url.includes(SCOPE_ENTITIES_RPC_PATH) && method === "POST";
}

async function readScopeEntityDiagnostics(page: Page): Promise<string> {
  const frameworkValue = await page.locator("#modelVersionId").inputValue();
  const scopeValue = await page.locator("#assessmentScopeType").inputValue();
  const scopeDisabled = await page.locator("#assessmentScopeType").isDisabled();
  const entitySelect = page.getByTestId("scope-entity-select");
  const entityDisabled = await entitySelect.isDisabled();
  const placeholder =
    (await entitySelect.locator("option").first().textContent())?.trim() ?? "";
  const alertCount = await page.getByRole("alert").count();
  const alertText =
    alertCount > 0
      ? ((await page.getByRole("alert").first().textContent()) ?? "").trim()
      : "";

  return [
    `frameworkSelected=${frameworkValue.length > 0} (value=${frameworkValue || "empty"})`,
    `scopeSelected=${scopeValue.length > 0} (value=${scopeValue || "empty"})`,
    `scopeDisabled=${scopeDisabled}`,
    `entitySelectDisabled=${entityDisabled}`,
    `entityPlaceholder="${placeholder}"`,
    alertText ? `formAlert="${alertText}"` : "formAlert=none",
  ].join("; ");
}

async function waitForScopeEntitiesRpc(
  page: Page,
  timeout = 30_000,
): Promise<ScopeEntityRow[]> {
  const response = await page.waitForResponse(
    (candidate) =>
      isScopeEntitiesRpcResponse(candidate.url(), candidate.request().method()),
    { timeout },
  );

  if (!response.ok()) {
    const diagnostics = await readScopeEntityDiagnostics(page);
    throw new Error(
      `Scope entities RPC failed with HTTP ${response.status()}. ${diagnostics}`,
    );
  }

  const entities = (await response.json()) as ScopeEntityRow[];
  if (!Array.isArray(entities)) {
    const diagnostics = await readScopeEntityDiagnostics(page);
    throw new Error(
      `Scope entities RPC returned a non-array payload. ${diagnostics}`,
    );
  }

  return entities;
}

export async function selectFrameworkVersion(
  page: Page,
  selection:
    | "first-enabled"
    | { value: string }
    | { label: string | RegExp } = "first-enabled",
) {
  const select = page.locator("#modelVersionId");

  await expect
    .poll(async () => select.locator("option:not([disabled])").count(), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);

  if (selection === "first-enabled") {
    const value = await select
      .locator("option:not([disabled])")
      .first()
      .getAttribute("value");
    if (!value) {
      throw new Error("No selectable framework version option was found.");
    }
    await select.selectOption(value);
  } else if ("value" in selection) {
    await select.selectOption(selection.value);
  } else {
    const matchingOption = select.locator("option").filter({
      hasText: selection.label,
    });
    await expect
      .poll(async () => matchingOption.count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
    const value = await matchingOption.first().getAttribute("value");
    if (!value) {
      throw new Error(
        `No framework version option matched label ${String(selection.label)}.`,
      );
    }
    await select.selectOption(value);
  }

  await expect(select).not.toHaveValue("", { timeout: 5_000 });
  await expect(page.locator("#assessmentScopeType")).toBeEnabled({
    timeout: 5_000,
  });
}

export async function selectAssessmentScopeAndWaitForEntities(
  page: Page,
  scopeType: string,
  options?: { expectedEntityName?: string | RegExp },
) {
  const scopeSelect = page.locator("#assessmentScopeType");
  const entitySelect = page.getByTestId("scope-entity-select");
  const frameworkValue = await page.locator("#modelVersionId").inputValue();

  if (!frameworkValue) {
    throw new Error(
      "Framework version must be selected before choosing assessment scope.",
    );
  }

  const currentScope = await scopeSelect.inputValue();
  let entities: ScopeEntityRow[] | null = null;

  if (currentScope !== scopeType) {
    const responsePromise = waitForScopeEntitiesRpc(page);
    await scopeSelect.selectOption(scopeType);
    entities = await responsePromise;
    if (entities.length === 0) {
      throw new Error(
        `Scope entities RPC returned empty for scope "${scopeType}". ${await readScopeEntityDiagnostics(page)}`,
      );
    }
  }

  await expect(scopeSelect).toHaveValue(scopeType, { timeout: 5_000 });

  try {
    await expect(entitySelect).toBeEnabled({ timeout: 30_000 });
    await expect(entitySelect.locator("option").first()).not.toHaveText(
      "No eligible entities for this scope",
      { timeout: 5_000 },
    );
  } catch (error) {
    const diagnostics = await readScopeEntityDiagnostics(page);
    const rpcSummary =
      entities === null
        ? "rpcObserved=framework-default-scope"
        : `rpcEntityCount=${entities.length}`;
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} (${rpcSummary}; ${diagnostics})`,
    );
  }

  if (options?.expectedEntityName) {
    await expect(entitySelect).toContainText(options.expectedEntityName);
  }
}

export async function selectFirstScopeEntity(page: Page) {
  const entitySelect = page.getByTestId("scope-entity-select");
  await expect(entitySelect).toBeEnabled({ timeout: 5_000 });

  const value = await entitySelect
    .locator("option:not([disabled])")
    .filter({ hasNotText: "Select entity" })
    .first()
    .getAttribute("value");

  if (!value) {
    throw new Error(
      `No selectable scope entity found. ${await readScopeEntityDiagnostics(page)}`,
    );
  }

  await entitySelect.selectOption(value);
  return value;
}
