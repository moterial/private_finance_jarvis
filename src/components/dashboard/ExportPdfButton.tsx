'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { Download, Loader2 } from 'lucide-react';

export default function ExportPdfButton() {
  const { locale } = useI18n();
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const [html2canvas, { jsPDF }] = await Promise.all([
        import('html2canvas').then(m => m.default),
        import('jspdf'),
      ]);

      const el = document.getElementById('dashboard-content');
      if (!el) return;

      const canvas = await html2canvas(el, {
        backgroundColor: '#0a0a0f',
        scale: 1.5,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);

      const date = new Date().toISOString().split('T')[0];
      pdf.save(`jarvis-report-${date}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={exportPdf}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700/50 hover:bg-gray-600/50 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50"
      title={locale === 'zh' ? '匯出PDF報告' : 'Export PDF Report'}
    >
      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {locale === 'zh' ? '匯出PDF' : 'Export PDF'}
    </button>
  );
}
