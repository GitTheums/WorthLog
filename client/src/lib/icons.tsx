import {
  Bitcoin,
  ChartNoAxesCombined,
  Circle,
  Coins,
  Crosshair,
  Gem,
  Landmark,
  Layers,
  LineChart,
  PiggyBank,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON_OPTIONS = [
  'Bitcoin',
  'ChartNoAxesCombined',
  'Sparkles',
  'Crosshair',
  'Coins',
  'Landmark',
  'Circle',
  'Wallet',
  'PiggyBank',
  'Gem',
  'Layers',
  'LineChart',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

const ICON_MAP: Record<string, LucideIcon> = {
  Bitcoin,
  ChartNoAxesCombined,
  Sparkles,
  Crosshair,
  Coins,
  Landmark,
  Circle,
  Wallet,
  PiggyBank,
  Gem,
  Layers,
  LineChart,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Circle;
}
