import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTaskflowSchemaPayload,
  TASKFLOW_SCHEMA_KEYS,
} from "./taskflowSchemaTransform.js";

test("buildTaskflowSchemaPayload returns only the whitelisted schema keys", () => {
  const legacyProduct = {
    itemDescription: "LED POOL LIGHT 12VDC 12W WARMWHITE",
    itemCodes: { ECOSHIFT: "PLL-12W-WW-028" },
    specValues: { "LAMP POWER": "12 WATTS" },
    rawImage:
      " https://res.cloudinary.com/dvmpn8mjh/image/upload/v1777017605/fdglst6otjocee9kcf2x.png ",
    slug: "led-pool-light-12vdc-12w-warmwhite",
    seo: { title: "legacy" },
    mainImage:
      "https://res.cloudinary.com/dvmpn8mjh/image/upload/v1777017605/h1kn4rlltffzkgfxr8gh.png",
    technicalSpecs: [{ specGroup: "LAMP DETAILS", specs: [] }],
    websites: ["Taskflow", "Shopify"],
    website: ["Taskflow"],
    status: "draft",
    randomField: "should-be-removed",
  };

  const payload = buildTaskflowSchemaPayload(legacyProduct);

  assert.deepEqual(
    Object.keys(payload).sort(),
    [...TASKFLOW_SCHEMA_KEYS].sort(),
  );
  assert.deepEqual(payload.websites, ["Taskflow"]);
  assert.equal("slug" in payload, false);
  assert.equal("seo" in payload, false);
  assert.equal("mainImage" in payload, false);
  assert.equal("technicalSpecs" in payload, false);
  assert.equal("website" in payload, false);
  assert.equal("randomField" in payload, false);
});

test("raw image URL remains rawImageFile and is not moved to mainImageFile", () => {
  const rawImageUrl =
    " https://res.cloudinary.com/dvmpn8mjh/image/upload/v1777017605/fdglst6otjocee9kcf2x.png ";

  const payload = buildTaskflowSchemaPayload({
    rawImage: rawImageUrl,
    mainImage:
      "https://res.cloudinary.com/dvmpn8mjh/image/upload/v1777017605/h1kn4rlltffzkgfxr8gh.png",
  });

  assert.equal(payload.rawImageFile, rawImageUrl);
  assert.equal(payload.mainImageFile, null);
});
