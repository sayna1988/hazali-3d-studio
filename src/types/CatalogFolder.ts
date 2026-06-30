export interface CatalogFolder {
  id?: number;
  cloudId?: string;
  syncKey?: string;
  syncPending?: boolean;
  name: string;
  parentId: number | null;
  parentCloudId?: string | null;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number;
  backgroundColor?: string;
  iconImage?: string;
}
