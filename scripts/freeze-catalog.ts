import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dataPort, snapshot } from "../apps/playground/src/data";
import { catalog } from "../packages/core/src/index";
const content = {
  snapshot,
  datasets: dataPort.listDatasets(),
  records: Object.fromEntries(
    dataPort
      .listDatasets()
      .map((dataset) => [dataset.id, dataPort.getSnapshot(dataset.id).records]),
  ),
  catalog,
};
writeFileSync(
  "docs/evidence/catalog-freeze.json",
  JSON.stringify(
    {
      frozenAt: new Date().toISOString(),
      sha256: createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex"),
      ...content,
    },
    null,
    2,
  ) + "\n",
);
