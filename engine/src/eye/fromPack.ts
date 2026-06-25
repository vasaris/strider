import type { Pack } from "../pack/pack.js";
import { type EyeConfig, deriveEyeConfig } from "./config.js";

/** Build the EyeConfig from a loaded, verified pack. */
export function eyeConfigFromPack(pack: Pack): EyeConfig {
  return deriveEyeConfig(pack.requireById("kv.solo.eye_of_mordor").raw);
}
