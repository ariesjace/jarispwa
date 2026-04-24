const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toObjectOrEmpty = (value) => (isPlainObject(value) ? value : {});

const toStringOrEmpty = (value) =>
  value === null || value === undefined ? "" : String(value);

const resolveRawImageValue = (product) => {
  if (product?.rawImageFile !== undefined && product?.rawImageFile !== null) {
    return product.rawImageFile;
  }
  if (Array.isArray(product?.rawImage)) return product.rawImage[0] ?? null;
  if (product?.rawImage !== undefined && product?.rawImage !== null) {
    return product.rawImage;
  }
  return null;
};

export const TASKFLOW_SCHEMA_KEYS = [
  "itemDescription",
  "itemCodes",
  "specValues",
  "mainImageFile",
  "rawImageFile",
  "images",
  "dimensionalDrawingImageFile",
  "recommendedMountingHeightImageFile",
  "driverCompatibilityImageFile",
  "baseImageFile",
  "illuminanceLevelImageFile",
  "wiringDiagramImageFile",
  "installationImageFile",
  "wiringLayoutImageFile",
  "terminalLayoutImageFile",
  "accessoriesImageFile",
  "regPrice",
  "salePrice",
  "websites",
];

export function buildTaskflowSchemaPayload(product) {
  return {
    itemDescription: toStringOrEmpty(product?.itemDescription),
    itemCodes: toObjectOrEmpty(product?.itemCodes),
    specValues: toObjectOrEmpty(product?.specValues),
    mainImageFile: product?.mainImageFile ?? null,
    rawImageFile: resolveRawImageValue(product),
    images: Array.isArray(product?.images) ? product.images : [],
    dimensionalDrawingImageFile: product?.dimensionalDrawingImageFile ?? null,
    recommendedMountingHeightImageFile:
      product?.recommendedMountingHeightImageFile ?? null,
    driverCompatibilityImageFile: product?.driverCompatibilityImageFile ?? null,
    baseImageFile: product?.baseImageFile ?? null,
    illuminanceLevelImageFile: product?.illuminanceLevelImageFile ?? null,
    wiringDiagramImageFile: product?.wiringDiagramImageFile ?? null,
    installationImageFile: product?.installationImageFile ?? null,
    wiringLayoutImageFile: product?.wiringLayoutImageFile ?? null,
    terminalLayoutImageFile: product?.terminalLayoutImageFile ?? null,
    accessoriesImageFile: product?.accessoriesImageFile ?? null,
    regPrice: toStringOrEmpty(product?.regPrice),
    salePrice: toStringOrEmpty(product?.salePrice),
    websites: ["Taskflow"],
  };
}
