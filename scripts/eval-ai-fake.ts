import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AiProposalType } from "../src/platform/ai/types";
import { FakeAIProvider } from "../src/platform/ai/providers/fake";

type EvalFixture = {
  id: string;
  mode: string;
  userMessage: string;
  expect: {
    messageContains?: string[];
    observationCountMin?: number;
    allowedProposalTypes?: string[];
    forbiddenProposalTypes?: string[];
  };
};

const fixtureDir = join(process.cwd(), "tests/evals/problem-solving");
const fixtures = [
  "challenge-assumptions.json",
  "hypothesis-test-proposal.json",
];

async function runFixture(fileName: string): Promise<void> {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDir, fileName), "utf8"),
  ) as EvalFixture;
  const provider = new FakeAIProvider();
  const response = await provider.createResponse({
    model: "fake-model",
    systemPrompt: "Eval harness",
    messages: [{ role: "user", content: fixture.userMessage }],
    tools: [],
    maxOutputTokens: 512,
    timeoutMs: 30_000,
  });

  const envelope = response.structuredOutput;
  if (!envelope) {
    throw new Error(`${fixture.id}: missing structured envelope`);
  }

  for (const token of fixture.expect.messageContains ?? []) {
    if (!envelope.message.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`${fixture.id}: message missing token "${token}"`);
    }
  }

  if (
    fixture.expect.observationCountMin !== undefined &&
    envelope.observations.length < fixture.expect.observationCountMin
  ) {
    throw new Error(`${fixture.id}: expected more observations`);
  }

  const proposalTypes = envelope.proposals.map((item) => item.proposal_type);
  for (const forbidden of fixture.expect.forbiddenProposalTypes ?? []) {
    if (proposalTypes.includes(forbidden as AiProposalType)) {
      throw new Error(`${fixture.id}: forbidden proposal type ${forbidden}`);
    }
  }

  if (fixture.expect.allowedProposalTypes?.length) {
    const allowed = fixture.expect.allowedProposalTypes;
    if (!proposalTypes.some((type) => allowed.includes(type))) {
      throw new Error(`${fixture.id}: expected one of ${allowed.join(", ")}`);
    }
  }

  console.log(`ok ${fixture.id}`);
}

async function main(): Promise<void> {
  for (const fileName of fixtures) {
    await runFixture(fileName);
  }
  console.log(`eval:ai:fake passed (${fixtures.length} fixtures)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
