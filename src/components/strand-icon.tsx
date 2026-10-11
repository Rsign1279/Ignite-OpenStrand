import {
  Code,
  HeartPulse,
  Scale,
  Plane,
  ChefHat,
  Settings,
  HardHat,
  GraduationCap,
  BriefcaseBusiness,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  Code,
  HeartPulse,
  Scale,
  Plane,
  ChefHat,
  Settings,
  HardHat,
  GraduationCap,
  BriefcaseBusiness,
  Clapperboard,
};
export function StrandIcon({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name] ?? Code;
  return <Icon size={size} aria-hidden="true" />;
}
