import React from 'react';

interface GraduationCertificateProps {
  result: {
    studentName: string;
    certificateId: string;
    completedAt: string;
    score: number;
  };
  onRetake: () => void;
}

export const GraduationCertificate: React.FC<GraduationCertificateProps> = ({ result, onRetake }) => {
  return (
    <div>
      <div className="certificate-container" id="printable-cert">
        <div className="cert-watermark">🦷</div>
        <div className="cert-header">CHỨNG CHỈ TỐT NGHIỆP XUẤT SẮC</div>
        <h2 className="cert-title">eSmiles Backend Master Engineer</h2>
        <div className="cert-recipient-label">Chứng nhận cấp cho Kỹ sư:</div>
        <div className="cert-student-name">{result.studentName || 'Đại Ca Kỹ Sư'}</div>
        <p className="cert-body-text">
          Đã hoàn thành xuất sắc toàn bộ <strong>6 Sprint</strong> đào tạo chuyên sâu về kiến trúc{' '}
          <strong>NestJS 11, Prisma 7 Multi-tenancy, Dynamic CASL Permissions, Queue BullMQ & Tooling Bruno</strong>{' '}
          trên mã nguồn thực tế của hệ thống Nha Khoa Số eSmiles.
        </p>
        <div className="cert-footer-row">
          <div>
            <div className="cert-seal">🏅</div>
            <div style={{ fontWeight: 700, color: '#f8fafc' }}>
              eSmiles Core Architecture Committee
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="cert-meta-item">Mã chứng chỉ: {result.certificateId}</div>
            <div className="cert-meta-item">
              Ngày cấp: {new Date(result.completedAt).toLocaleDateString('vi-VN')}
            </div>
            <div className="cert-meta-item">Điểm tốt nghiệp: {result.score}%</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          🖨️ In / Xuất PDF Chứng Chỉ
        </button>
        <button
          className="btn btn-primary"
          style={{ marginLeft: '12px' }}
          onClick={onRetake}
        >
          Thi lại để cải thiện điểm
        </button>
      </div>
    </div>
  );
};
