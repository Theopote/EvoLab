import { OpeningInspector } from "@/components/inspector/OpeningInspector";
import { ProjectInspector } from "@/components/inspector/ProjectInspector";
import { RoomInspector } from "@/components/inspector/RoomInspector";
import { WallInspector } from "@/components/inspector/WallInspector";
import { useEvoProject } from "@/lib/project-store";

export function InspectorPanel() {
  const { selectionType, selectedRoom, selectedWall, selectedOpening } = useEvoProject();

  if (selectionType === "room" && selectedRoom) {
    return <RoomInspector />;
  }

  if (selectionType === "wall" && selectedWall) {
    return <WallInspector />;
  }

  if (selectionType === "opening" && selectedOpening) {
    return <OpeningInspector />;
  }

  return <ProjectInspector />;
}
