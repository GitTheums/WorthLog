import type { AppSettings, DashboardData } from '../api/types';

export const settingsFixture: AppSettings = {
  currency: 'EUR',
  defaultRange: '3m',
};

export const emptyDashboardFixture: DashboardData = {
  range: '3m',
  currentTotalCents: 0,
  previousTotalCents: null,
  changeCents: null,
  changePercent: null,
  firstTotalCents: null,
  changeSinceFirstCents: null,
  latestDate: null,
  timeSeries: [],
  categoryTimeSeries: [],
  latestAllocation: [],
  latestCategoryValues: [],
  historyRows: [],
};

export const dashboardFixture: DashboardData = {
  range: '3m',
  currentTotalCents: 12_000,
  previousTotalCents: 8_000,
  changeCents: 4_000,
  changePercent: 50,
  firstTotalCents: 4_000,
  changeSinceFirstCents: 8_000,
  latestDate: '2026-03-01',
  timeSeries: [
    { date: '2026-01-01', totalValueCents: 4_000 },
    { date: '2026-02-01', totalValueCents: 8_000 },
    { date: '2026-03-01', totalValueCents: 12_000 },
  ],
  categoryTimeSeries: [
    {
      categoryId: 'cat-crypto',
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
      points: [
        { date: '2026-01-01', amountCents: 1_000 },
        { date: '2026-02-01', amountCents: 2_000 },
        { date: '2026-03-01', amountCents: 3_000 },
      ],
    },
  ],
  latestAllocation: [
    {
      categoryId: 'cat-crypto',
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
      amountCents: 3_000,
      percent: 25,
    },
    {
      categoryId: 'cat-stocks',
      name: 'Stocks',
      color: '#2563EB',
      icon: 'ChartNoAxesCombined',
      amountCents: 3_000,
      percent: 25,
    },
    {
      categoryId: 'cat-pokemon',
      name: 'Pokémon',
      color: '#F59E0B',
      icon: 'Sparkles',
      amountCents: 3_000,
      percent: 25,
    },
    {
      categoryId: 'cat-skins',
      name: 'CS2 Skins',
      color: '#EF4444',
      icon: 'Crosshair',
      amountCents: 3_000,
      percent: 25,
    },
  ],
  latestCategoryValues: [
    {
      categoryId: 'cat-crypto',
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
      amountCents: 3_000,
    },
    {
      categoryId: 'cat-stocks',
      name: 'Stocks',
      color: '#2563EB',
      icon: 'ChartNoAxesCombined',
      amountCents: 3_000,
    },
    {
      categoryId: 'cat-pokemon',
      name: 'Pokémon',
      color: '#F59E0B',
      icon: 'Sparkles',
      amountCents: 3_000,
    },
    {
      categoryId: 'cat-skins',
      name: 'CS2 Skins',
      color: '#EF4444',
      icon: 'Crosshair',
      amountCents: 3_000,
    },
  ],
  historyRows: [
    {
      date: '2026-03-01',
      note: 'Latest',
      totalValueCents: 12_000,
      values: [
        { categoryId: 'cat-crypto', amountCents: 3_000 },
        { categoryId: 'cat-stocks', amountCents: 3_000 },
        { categoryId: 'cat-pokemon', amountCents: 3_000 },
        { categoryId: 'cat-skins', amountCents: 3_000 },
      ],
    },
    {
      date: '2026-02-01',
      note: null,
      totalValueCents: 8_000,
      values: [
        { categoryId: 'cat-crypto', amountCents: 2_000 },
        { categoryId: 'cat-stocks', amountCents: 2_000 },
        { categoryId: 'cat-pokemon', amountCents: 2_000 },
        { categoryId: 'cat-skins', amountCents: 2_000 },
      ],
    },
  ],
};
