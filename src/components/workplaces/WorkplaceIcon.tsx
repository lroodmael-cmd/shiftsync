import {
  Building2,
  BriefcaseBusiness,
  Hospital,
  Warehouse,
  Utensils,
} from "lucide-react";
import type { WorkplaceIcon as IconName } from "@/lib/workplaces/types";
const icons = {
  building: Building2,
  briefcase: BriefcaseBusiness,
  hospital: Hospital,
  warehouse: Warehouse,
  restaurant: Utensils,
};
export function WorkplaceIcon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}) {
  const Icon = icons[name];
  return <Icon size={size} aria-hidden="true" />;
}
