export interface CatalogFolder {
  id?: number;
  name: string;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number;
  backgroundColor?: string;
  iconImage?: string;
}
