import type { Zone } from '../types';

/** Cây/giống hiện tại chỉ là thuộc tính của Zone. Không suy ra từ vụ mùa, tên Zone, ghi chú hay giá trị mặc định. */
export const NO_CROP_LABEL = 'Chưa gán cây';

export function zoneCropLabel(z?: Pick<Zone, 'currentCrop' | 'seasonStatus' | 'plannedCrop'> | null): string {
  if (z?.currentCrop) return z.currentCrop;
  if (z?.seasonStatus === 'PlannedOnly' && z.plannedCrop) return `${NO_CROP_LABEL} (vụ dự kiến: ${z.plannedCrop})`;
  return NO_CROP_LABEL;
}

/** Giai đoạn chỉ có khi vụ đang canh tác cùng cây với Zone. */
export function zoneStageLabel(z?: Pick<Zone, 'currentStage' | 'seasonStatus' | 'seasonCropName'> | null): string {
  switch (z?.seasonStatus) {
    case 'InProgress': return z.currentStage || 'Chưa xác định giai đoạn';
    case 'Mismatch': return `Vụ đang chạy thuộc cây khác (${z.seasonCropName ?? 'không rõ'}) — cần cập nhật cây của Zone hoặc vụ mùa`;
    case 'PlannedOnly': return 'Chưa có vụ đang canh tác (có vụ dự kiến)';
    default: return 'Chưa có vụ đang canh tác';
  }
}
