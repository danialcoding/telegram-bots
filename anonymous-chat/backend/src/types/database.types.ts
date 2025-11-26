/**
 * انواع Helper برای Database queries
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Helper برای ساخت نتیجه Pagination
 */
export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
