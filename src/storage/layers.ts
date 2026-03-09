import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { LANGUAGE_IDS } from "../analyzer/engines/types.js";
import type { LayerConfig } from "../types/layers.js";

const ARCHTRACKER_DIR = ".archtracker";
const LAYERS_FILE = "layers.json";

const LayerDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Layer name must be alphanumeric (hyphens/underscores allowed)",
    ),
  targetDir: z.string().min(1),
  language: z.enum(LANGUAGE_IDS).optional(),
  exclude: z.array(z.string()).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

const CrossLayerConnectionSchema = z.object({
  fromLayer: z.string(),
  fromFile: z.string(),
  toLayer: z.string(),
  toFile: z.string(),
  type: z.enum(["api-call", "event", "data-flow", "manual"]),
  label: z.string().optional(),
});

export const LayerConfigSchema = z.object({
  version: z.literal("1.0"),
  layers: z
    .array(LayerDefinitionSchema)
    .min(1)
    .refine(
      (layers) => {
        const names = layers.map((l) => l.name);
        return new Set(names).size === names.length;
      },
      { message: "Layer names must be unique" },
    ),
  connections: z.array(CrossLayerConnectionSchema).optional(),
});

/**
 * Load layers.json from .archtracker/ if it exists.
 * Returns null if no config file found.
 */
export async function loadLayerConfig(
  projectRoot: string,
): Promise<LayerConfig | null> {
  const filePath = join(projectRoot, ARCHTRACKER_DIR, LAYERS_FILE);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }

  const result = LayerConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .slice(0, 5)
      .join("\n");
    throw new Error(`layers.json validation failed:\n${issues}`);
  }

  return result.data as LayerConfig;
}

/**
 * Save a LayerConfig to .archtracker/layers.json.
 */
export async function saveLayerConfig(
  projectRoot: string,
  config: LayerConfig,
): Promise<void> {
  const dirPath = join(projectRoot, ARCHTRACKER_DIR);
  const filePath = join(dirPath, LAYERS_FILE);
  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
