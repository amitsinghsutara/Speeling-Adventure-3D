import generated from "./content/curriculum.generated.json";
import { parseCurriculum, type Curriculum } from "./curriculum";

let cached: Curriculum | null = null;

/** Bundled curriculum, validated once per process. Never touches the network. */
export function loadCurriculum(): Curriculum {
  cached ??= parseCurriculum(generated);
  return cached;
}
