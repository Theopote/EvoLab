import { resolveTypologyPack } from "@/lib/typology/resolve";

export interface FewShotExample {
  title: string;
  inputSummary: string;
  outputSummary: string;
}

const HEALTHCARE_EXAMPLES: FewShotExample[] = [
  {
    title: "Outpatient clinic wing",
    inputSummary:
      "1200 sqm clinic, 2 floors, needs consultation cluster, imaging suite, and central nurse station with short egress paths.",
    outputSummary:
      "Public waiting on south perimeter; consultation rooms on east daylight edge; imaging and lab grouped with wet core; nurse station bridges circulation."
  },
  {
    title: "Emergency department slice",
    inputSummary: "Fast-track triage with ambulance entry on west and staff support core near center.",
    outputSummary:
      "Triage and trauma bays on perimeter; staff support and clean utility hug interior core; dedicated ambulance circulation separated from public waiting."
  }
];

const OFFICE_EXAMPLES: FewShotExample[] = [
  {
    title: "Open-plan workplace",
    inputSummary: "1800 sqm office, target 65% desk area, central meeting cluster, pantry near core.",
    outputSummary:
      "Open workspace on daylight perimeter; meeting rooms in middle band; pantry and copy near elevator core; reception and lobby at entry edge."
  },
  {
    title: "Core relocation",
    inputSummary: "Move core to north side while keeping open workspace and meeting rooms connected.",
    outputSummary:
      "Elevator and stairs shift north; corridors loop around core; meeting rooms remain adjacent to open office with preserved egress loops."
  }
];

const RESIDENTIAL_EXAMPLES: FewShotExample[] = [
  {
    title: "Mid-rise apartment bar",
    inputSummary: "8 units per floor, double-loaded corridor, corner units with dual aspect.",
    outputSummary:
      "Central corridor; units alternate living edges; wet stacks aligned; stair and elevator at corridor midpoint."
  },
  {
    title: "Family unit mix",
    inputSummary: "Blend 1BR and 3BR units with shared amenity at ground level.",
    outputSummary:
      "Larger units on corners; smaller units on interior corridor edges; amenity and mailroom at lobby with separate resident circulation."
  }
];

const FEW_SHOT_BY_PACK: Record<string, FewShotExample[]> = {
  healthcare: HEALTHCARE_EXAMPLES,
  office: OFFICE_EXAMPLES,
  residential: RESIDENTIAL_EXAMPLES,
  school: OFFICE_EXAMPLES
};

export function listFewShotExamples(projectType?: string): FewShotExample[] {
  const pack = resolveTypologyPack(projectType);
  return FEW_SHOT_BY_PACK[pack.id] ?? OFFICE_EXAMPLES;
}

export function buildFewShotPromptBlock(projectType?: string): string {
  const examples = listFewShotExamples(projectType);

  return examples
    .map(
      (example) =>
        `Example — ${example.title}\nUser brief: ${example.inputSummary}\nGood topology pattern: ${example.outputSummary}`
    )
    .join("\n\n");
}
