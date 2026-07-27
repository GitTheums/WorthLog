import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVACY_STORAGE_KEY } from '../lib/privacy';
import { dashboardFixture } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { setViewportWidth } from '../test/viewport';
import { AllocationChart } from './AllocationChart';
import { CategoryCards } from './CategoryCards';
import { HistoryTable } from './HistoryTable';
import { TotalValueChart } from './TotalValueChart';

const expectedOrder = ['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins'];

function requireElement<T>(value: T | null | undefined, label: string): T {
  if (value == null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

describe('dashboard category display order', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1440);
  });

  it('renders chart legend in canonical order and does not reshuffle on hide', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TotalValueChart
        data={dashboardFixture}
        currency="EUR"
        range="3m"
        onRangeChange={vi.fn()}
      />,
    );

    const legend = screen.getByRole('group', { name: 'Category visibility' });
    const buttons = within(legend).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(expectedOrder);

    const firstButton = requireElement(buttons[0], 'first legend button');
    await user.click(firstButton);
    expect(firstButton).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(legend)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(expectedOrder);
  });

  it('renders allocation legend and category cards in canonical order', () => {
    const { unmount } = renderWithProviders(
      <AllocationChart data={dashboardFixture} currency="EUR" />,
    );

    const allocation = screen.getByLabelText('Current allocation');
    const legendItems = within(allocation).getAllByRole('listitem');
    expect(
      legendItems.map((item) =>
        within(item).getByText(/Crypto|Stocks|Pokémon|CS2 Skins/).textContent,
      ),
    ).toEqual(expectedOrder);

    const firstLegendItem = requireElement(legendItems[0], 'first legend item');
    expect(
      within(firstLegendItem).getByText('Crypto').previousElementSibling,
    ).toHaveStyle({ background: '#7C5CFC' });
    unmount();

    renderWithProviders(
      <CategoryCards data={dashboardFixture} currency="EUR" />,
    );
    const cards = screen.getByLabelText('Category values');
    expect(
      within(cards)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(expectedOrder);
  });

  it('uses canonical order for desktop history columns and historical cells', () => {
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent.trim());
    expect(headers.slice(2, 6)).toEqual(expectedOrder);

    const firstDataRow = requireElement(
      within(table).getAllByRole('row')[1],
      'first history data row',
    );
    const cells = within(firstDataRow).getAllByRole('cell');
    expect(cells[0]?.textContent).toContain('€120.00');
    expect(cells[1]?.textContent).toContain('€83.10');
    expect(cells[2]?.textContent).toContain('€22.80');
    expect(cells[3]?.textContent).toContain('€12.10');
    expect(cells[4]?.textContent).toContain('€2.00');
  });

  it('uses canonical order for mobile history category rows', () => {
    setViewportWidth(375);
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const firstCard = requireElement(
      screen.getAllByRole('listitem')[0],
      'first history card',
    );
    const categoryNames = within(firstCard)
      .getAllByText(/Crypto|Stocks|Pokémon|CS2 Skins/)
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter((name) => expectedOrder.includes(name));
    expect(categoryNames).toEqual(expectedOrder);
  });

  it('does not change category order when privacy mode hides amounts', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    renderWithProviders(
      <>
        <TotalValueChart
          data={dashboardFixture}
          currency="EUR"
          range="3m"
          onRangeChange={vi.fn()}
        />
        <CategoryCards data={dashboardFixture} currency="EUR" />
      </>,
    );

    const legend = screen.getByRole('group', { name: 'Category visibility' });
    expect(
      within(legend)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(expectedOrder);
    expect(
      within(screen.getByLabelText('Category values'))
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(expectedOrder);
  });
});
