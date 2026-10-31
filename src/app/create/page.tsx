import { ScenarioCreator } from "@/components/scenario-creator";
export const metadata = { title: "Scenario Studio · PERSONA LAB" };
export const dynamic = "force-dynamic";
export default function CreatePage() {
  return <ScenarioCreator mode={process.env.AI_PROVIDER ?? "mock"} />;
}
