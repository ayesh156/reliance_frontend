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