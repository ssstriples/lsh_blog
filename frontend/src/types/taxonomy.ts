export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}
