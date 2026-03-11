import { ProductGridSkeleton } from '@/components/ui/Skeletons';

export default function LoadingSkeleton({ count = 8 }: { count?: number }) {
  return <ProductGridSkeleton count={count} />;
}

