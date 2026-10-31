// Tên cây trong phạm vi áp dụng của tài liệu đã được backend chuẩn hóa khi lưu (CropNames.NormalizeScope),
// nên frontend không giữ bảng tên gọi riêng: chỉ làm sạch và so khớp không dấu với danh mục để hiển thị.
import { foldVietnamese } from './vietGapCompleteness';

const clean = (raw: string) => raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

/** Tên cây để nhóm/hiển thị; null nếu mục rỗng. Trùng tên danh mục (không dấu) thì dùng tên danh mục. */
export function canonicalCrop(raw: string, catalog: string[] = []): string | null {
  const cleaned = clean(raw);
  if (!cleaned) return null;
  const key = foldVietnamese(cleaned);
  const fromCatalog = catalog.map(clean).find(c => foldVietnamese(c) === key);
  const name = fromCatalog ?? cleaned;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
