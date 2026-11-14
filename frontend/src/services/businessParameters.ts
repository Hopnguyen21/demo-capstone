import { useEffect, useState } from 'react';
import { apiClient } from './api';

/** Tham số nghiệp vụ do Admin cấu hình (platform_settings); web chỉ hiển thị/tính theo đúng giá trị server. */
export interface BusinessParameters {
  depositPercent: number;
  rainGuardThresholdPercent: number;
  repeatPurchaseDiscountPercent: number;
  renewalDiscountPercent: number;
}

/** Chỉ dùng tạm khi chưa tải xong hoặc server không trả lời; khớp giá trị mặc định ở backend. */
export const FALLBACK_BUSINESS_PARAMETERS: BusinessParameters = {
  depositPercent: 30,
  rainGuardThresholdPercent: 70,
  repeatPurchaseDiscountPercent: 15,
  renewalDiscountPercent: 10,
};

let cached: BusinessParameters | null = null;
let inflight: Promise<BusinessParameters> | null = null;

export const fetchBusinessParameters = async (force = false): Promise<BusinessParameters> => {
  if (cached && !force) return cached;
  if (!inflight || force) {
    inflight = apiClient
      .get('/api/v1/platform/business-parameters')
      .then(res => {
        const d = res.data ?? {};
        cached = {
          depositPercent: Number(d.depositPercent ?? FALLBACK_BUSINESS_PARAMETERS.depositPercent),
          rainGuardThresholdPercent: Number(d.rainGuardThresholdPercent ?? FALLBACK_BUSINESS_PARAMETERS.rainGuardThresholdPercent),
          repeatPurchaseDiscountPercent: Number(d.repeatPurchaseDiscountPercent ?? FALLBACK_BUSINESS_PARAMETERS.repeatPurchaseDiscountPercent),
          renewalDiscountPercent: Number(d.renewalDiscountPercent ?? FALLBACK_BUSINESS_PARAMETERS.renewalDiscountPercent),
        };
        return cached;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Giá trị hiện hành; đọc lại mỗi lần component mount để Admin đổi xong có hiệu lực ngay. */
export const useBusinessParameters = (): BusinessParameters => {
  const [params, setParams] = useState<BusinessParameters>(cached ?? FALLBACK_BUSINESS_PARAMETERS);
  useEffect(() => {
    let alive = true;
    fetchBusinessParameters(true).then(p => { if (alive) setParams(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return params;
};

/** "30" thay vì "30.0"; giữ phần lẻ nếu có ("32.5"). */
export const formatPercent = (v: number): string => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));

/** Nhãn tỷ lệ tạm ứng và phần còn lại (vd. "30%" / "70%") theo cấu hình Platform của Admin. */
export const depositLabels = (p: BusinessParameters): { deposit: string; remaining: string } => ({
  deposit: `${formatPercent(p.depositPercent)}%`,
  remaining: `${formatPercent(100 - p.depositPercent)}%`,
});

/** Giá trị đang lưu trong bộ nhớ (hoặc mặc định) cho code ngoài React, như service. */
export const getCachedBusinessParameters = (): BusinessParameters => cached ?? FALLBACK_BUSINESS_PARAMETERS;

/**
 * Tỷ lệ cọc ĐÃ áp cho một hợp đồng, suy ra từ số tiền backend trả (cọc ÷ tổng). Đổi tỷ lệ ở cấu hình Platform chỉ áp cho hợp đồng
 * chưa cọc (backend tính lại khi đọc/ký); hợp đồng đã cọc hoặc đã nghiệm thu giữ số đã chốt nên nhãn không đổi.
 */
export const contractDepositPercent = (
  contract: { deposit30Percent?: number; totalAmount?: number } | null | undefined,
  fallback: number,
): number => {
  const total = Number(contract?.totalAmount ?? 0);
  const deposit = Number(contract?.deposit30Percent ?? 0);
  return total > 0 && deposit > 0 ? Number(((deposit / total) * 100).toFixed(2)) : fallback;
};
