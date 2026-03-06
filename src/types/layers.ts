import type { LanguageId } from "../analyzer/engines/types.js";

/** Definition of a single architecture layer */
export interface LayerDefinition {
  /** Unique layer name (used as path prefix: "Backend/worker.py") */
  name: string;
  /** Target directory to analyze (relative to project root) */
  targetDir: string;
  /** Language for this layer (auto-detected if omitted) */
  language?: LanguageId;
  /** Exclude patterns specific to this layer */
  exclude?: string[];
  /** Display color (CSS color, e.g. "#58a6ff"). Auto-assigned if omitted. */
  color?: string;
  /** Optional description shown in the viewer */
  description?: string;
}

/**
 * Layer configuration schema (.archtracker/layers.json).
 * The `connections` field is reserved for future cross-layer edge support.
 */
export interface LayerConfig {
  version: "1.0";
  layers: LayerDefinition[];
  /** Reserved for future cross-layer connection definitions */
  connections?: CrossLayerConnection[];
}

/** Reserved for future cross-layer edge support */
export interface CrossLayerConnection {
  fromLayer: string;
  fromFile: string;
  toLayer: string;
  toFile: string;
  type: "api-call" | "event" | "data-flow" | "manual";
  label?: string;
}
