import React from 'react';
import { ServiceRequest } from '../../types';
import { StatusBadge } from './BaseUI';

export const serviceStatusLabels: Record<string, string> = {
  OPEN: 'Mới tạo', ASSIGNED: 'Đã giao', IN_PROGRESS: 'Đang xử lý',
  DIAGNOSED: 'Đã chẩn đoán', WORK_COMPLETED: 'Đã làm xong',
  VERIFIED: 'Đã kiểm tra', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng',
};
const deploymentLabels: Record<string, string> = {
  Draft: 'Nháp', Submitted: 'Đã gửi', Accepted: 'Đã tiếp nhận',
  Surveyed: 'Đã khảo sát', PlanConfirmed: 'Đã xác nhận kế hoạch',
  Installing: 'Đang lắp đặt', Completed: 'Hoàn tất triển khai',
  MaintenanceRequired: 'Cần bảo trì', Cancelled: 'Đã hủy',
};
const quotationLabels: Record<string, string> = {
  Draft: 'Nháp', SentToOwner: 'Đã gửi báo giá', SignedByOwner: 'Đã ký và cọc 30%',
  DepositPaid: 'Đã cọc 30%', Completed: 'Đã nghiệm thu và thanh toán đủ',
};
export function ServiceRequestStatus({ request }: { request: ServiceRequest }) {
  return <span className="inline-flex flex-wrap gap-2">
    <StatusBadge status={request.status} label={`Dịch vụ: ${serviceStatusLabels[request.status] ?? request.status}`} />
    {request.deploymentStatus && <StatusBadge status={request.deploymentStatus}
      label={`Triển khai: ${deploymentLabels[request.deploymentStatus] ?? request.deploymentStatus}`} />}
    {request.quotationStatus && <StatusBadge status={request.quotationStatus}
      label={`Hợp đồng: ${quotationLabels[request.quotationStatus] ?? request.quotationStatus}`} />}
    {request.deploymentLinkInvalid && <span className="text-red-700 text-xs">Liên kết triển khai sai farm/zone — cần kiểm tra</span>}
  </span>;
}
