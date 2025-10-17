# Grocery Price Comparison Frontend

Modern Next.js 14 frontend for the grocery price comparison application.

## Features

- 🎨 Modern, responsive UI with Tailwind CSS
- ⚡ Fast page loads with Next.js App Router
- 🔍 Advanced search and filtering
- 📊 Real-time price updates
- 🛒 Multi-store browsing (IGA, Woolworths, Coles)
- 📱 Mobile-first design

## Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create environment file (optional):

```bash
cp .env.example .env.local
```

Edit `.env.local` if your backend runs on a different URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run development server:

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Homepage
│   │   ├── globals.css         # Global styles
│   │   └── store/
│   │       └── [store]/
│   │           ├── page.tsx         # Store landing
│   │           └── [category]/
│   │               └── page.tsx     # Products page
│   ├── components/             # React components
│   │   ├── Navbar.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterSidebar.tsx
│   │   ├── Pagination.tsx
│   │   ├── PriceUpdateButton.tsx
│   │   └── LoadingSkeleton.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useProducts.ts
│   │   └── useScraping.ts
│   └── lib/                    # Utilities
│       ├── api.ts              # API client
│       ├── types.ts            # TypeScript types
│       └── utils.ts            # Helper functions
├── public/                     # Static assets
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

## Key Pages

- `/` - Homepage with store selection
- `/store/[store]` - Store landing with categories (e.g., `/store/IGA`)
- `/store/[store]/[category]` - Products listing with filters

## Components

### ProductCard
Displays individual product with image, price, and live update button.

### ProductGrid
Grid layout for displaying multiple products with responsive columns.

### PriceUpdateButton
Triggers live price scraping with loading states and status updates.

### SearchBar
Search input with clear button and debouncing.

### FilterSidebar
Brand filter and price sorting options.

### Pagination
Page navigation with smart page number display.

## API Integration

The frontend communicates with the FastAPI backend via the `apiClient`:

```typescript
import { apiClient } from '@/lib/api';

// Get products
const products = await apiClient.getProducts({
  store: 'IGA',
  category: 'Drinks',
  page: 1,
  limit: 30
});

// Scrape price
const result = await apiClient.scrapePrice(productId);
```

## Styling

- **Framework:** Tailwind CSS
- **Color Scheme:** Blue primary (#3b82f6)
- **Store Colors:**
  - IGA: Green (#10b981)
  - Woolworths: Orange (#f59e0b)
  - Coles: Red (#ef4444)

## Development Tips

### Adding New Pages

Create a new file in `src/app/`:

```typescript
// src/app/about/page.tsx
export default function AboutPage() {
  return <div>About</div>;
}
```

### Adding New Components

Create in `src/components/`:

```typescript
// src/components/MyComponent.tsx
export default function MyComponent() {
  return <div>My Component</div>;
}
```

### Environment Variables

Next.js environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Troubleshooting

### API Connection Issues

If the frontend can't connect to the backend:

1. Ensure backend is running on http://localhost:8000
2. Check CORS settings in backend `config.py`
3. Verify `next.config.js` rewrites are correct

### Build Errors

If you encounter build errors:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Image optimization with Next.js Image component
- Lazy loading for images
- Skeleton loaders for better UX
- Client-side caching with React Query (can be added)

## Future Enhancements

- [ ] Add comparison mode (side-by-side products)
- [ ] Shopping list feature
- [ ] Price history charts
- [ ] User preferences (localStorage)
- [ ] PWA support
- [ ] Dark mode

## License

MIT
