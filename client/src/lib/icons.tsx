import {
  Bitcoin,
  ChartNoAxesCombined,
  Circle,
  Coins,
  Crosshair,
  Landmark,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Bitcoin,
  ChartNoAxesCombined,
  Sparkles,
  Crosshair,
  Coins,
  Landmark,
  Circle,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Circle;
}
