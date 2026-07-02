export type SortKey = "newest" | "highest" | "lowest";

export type Review = {
  id: number | string;
  authorName: string;
  rating: number;
  comment?: string;
  photos?: string[];
  createdAt: string;
};

export type ReviewsData = {
  avgRating: number;
  totalReviews: number;
  ratingBreakdown: Record<string, number>;
  reviews: Review[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type PhotoItem = {
  id: string;
  previewUrl: string;
  url?: string;
  status: "uploading" | "done" | "error";
};
