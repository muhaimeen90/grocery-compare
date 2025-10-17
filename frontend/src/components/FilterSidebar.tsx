'use client';

type SortOption = 'name' | 'price_low' | 'price_high';

interface FilterSidebarProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export default function FilterSidebar({ currentSort, onSortChange }: FilterSidebarProps) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Sort By</h3>
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="input"
      >
        <option value="name">Name (A-Z)</option>
        <option value="price_low">Price: Low to High</option>
        <option value="price_high">Price: High to Low</option>
      </select>
    </div>
  );
}
