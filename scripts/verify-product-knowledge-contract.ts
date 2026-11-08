import { allPlatformKnowledgeFieldGaps } from "../src/modules/leanai-context/product-knowledge/registry";
import { PLATFORM_KNOWLEDGE_MODULE_REGISTRY } from "../src/modules/leanai-context/product-knowledge/registry";
import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "../src/modules/leanai-context/product-knowledge/version";

function main(): void {
  const gaps = allPlatformKnowledgeFieldGaps();
  const offenders = Object.entries(gaps).filter(([, list]) => list.length > 0);

  if (offenders.length > 0) {
    const detail = offenders
      .map(([module, list]) => `${module}: ${list.join(", ")}`)
      .join("\n");
    console.error(
      `Product knowledge contract drift (${LEH_PRODUCT_KNOWLEDGE_VERSION}). Missing audited fields:\n${detail}`,
    );
    process.exit(1);
  }

  for (const entry of PLATFORM_KNOWLEDGE_MODULE_REGISTRY) {
    if (entry.articleCount < 1) {
      console.error(`Module ${entry.module} has no knowledge articles.`);
      process.exit(1);
    }
  }

  console.log(
    `Product knowledge contract OK (${LEH_PRODUCT_KNOWLEDGE_VERSION}, ${PLATFORM_KNOWLEDGE_MODULE_REGISTRY.length} modules).`,
  );
}

main();
