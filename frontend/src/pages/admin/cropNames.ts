// Chuẩn hóa tên cây trồng ghi trong phạm vi áp dụng của tài liệu (khớp CropNames.cs ở backend).
// Tài liệu ghi cùng một cây theo nhiều cách: có/không dấu, tiếng Anh, tên giống, kèm nhóm trong ngoặc.
import { foldVietnamese } from './vietGapCompleteness';

/** Tên chuẩn → các cách viết khác (đã bỏ dấu, chữ thường). Tên giống (Batavia, Hana...) gộp về cây. */
export const CROP_ALIASES: Record<string, string[]> = {
  'Cà chua': ['ca chua', 'tomato', 'ca chua beefsteak', 'ca chua cherry'],
  'Xà lách': ['xa lach', 'lettuce', 'batavia', 'lolo', 'xa lach cuon', 'xa lach thuy canh', 'xa lach lolo'],
  'Dưa leo': ['dua leo', 'dua chuot', 'cucumber', 'dua leo mau', 'dua leo baby'],
  'Ớt chuông': ['ot chuong', 'ot ngot', 'capsicum', 'sweet pepper', 'bell pepper'],
  'Ớt': ['ot', 'ot cay', 'chili'],
  'Dâu tây': ['dau tay', 'strawberry', 'hana', 'tochiotome'],
  'Dưa lưới': ['dua luoi', 'melon', 'cantaloupe'],
  'Cải bẹ xanh': ['cai be xanh', 'mustard green', 'mustard'],
};

const ALIAS_TO_CROP = new Map<string, string>(
  Object.entries(CROP_ALIASES).flatMap(([crop, aliases]) => [[foldVietnamese(crop), crop], ...aliases.map(a => [a, crop] as [string, string])]),
);

/**
 * Tên chuẩn của một mục cây trồng; null nếu không phải tên cây (nhóm như "Rau ăn lá" hay tiêu đề tài liệu).
 * Danh mục cây trồng trong hệ thống được dùng thêm để nhận cây chưa có trong bảng tên gọi.
 */
export function canonicalCrop(raw: string, catalog: string[] = []): string | null {
  const cleaned = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const key = foldVietnamese(cleaned);
  const alias = ALIAS_TO_CROP.get(key);
  if (alias) return alias;
  const fromCatalog = catalog.find(c => foldVietnamese(c.replace(/\([^)]*\)/g, '').trim()) === key);
  return fromCatalog ? fromCatalog.replace(/\([^)]*\)/g, '').trim() : null;
}
