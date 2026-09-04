export interface VariantItem {
  id?: number;
  key: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  comparePrice?: number;
  stock: number;
  // Direct primary catalog image assigned to this variant
  imageUrl?: string;
  // Multiple assigned gallery images
  imageUrls?: string[];
  // Zero-based indexes from catalog images gallery
  imageIndexes?: number[];
}

export interface ReviewItem {
  key: string;
  reviewerName: string;
  reviewerPhoto?: string;
  description?: string;
  rating: number;
}

export interface ProductImageItem {
  id: number;
  imageUrl: string;
  order: number;
  // Linked variant reference from database relation
  variantId?: number | null;
}

export interface ProductItem {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  searchKey?: string;
  categoryId: number;
  category?: { id: number; name: string };
  isFeatured?: boolean;
  variants: VariantItem[];
  reviews?: ReviewItem[];
  images?: ProductImageItem[];
  image?: string;
  createdAt: string;
}