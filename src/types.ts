export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  lastInventoryAt?: any; // Timestamp
}

export interface InventoryLog {
  id: string;
  materialId: string;
  type: 'inventory_check' | 'purchase' | 'consumption';
  quantity: number;
  difference?: number;
  userId: string;
  timestamp: any; // Timestamp
}
