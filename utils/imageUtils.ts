import type { DaySchedule } from '../types.js';

export const createImageThumbnail = (
  file: File,
  maxWidth: number,
  maxHeight: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      if (!event.target?.result) {
        return reject(new Error('Failed to read file for thumbnail creation.'));
      }
      img.src = event.target.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Get the data URL and remove the prefix
        const dataUrl = canvas.toDataURL(file.type, 0.85); // 0.85 quality for JPEG/WebP
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};


export const generateScheduleSvg = (
    schedule: DaySchedule[],
    weekDays: { name: string; date: Date }[],
    totalHours: string,
    dateRange: string | undefined
): string => {
    const width = 800;
    const height = 400;
    const cardWidth = 90;
    const cardHeight = 180;
    const gap = 10;
    const totalWidth = 7 * cardWidth + 6 * gap;
    const startX = (width - totalWidth) / 2;
    const startY = 90;

    // Funzione di utilità per eseguire l'escape dei caratteri speciali XML/HTML
    const escapeXml = (unsafe: string) => {
        if (typeof unsafe !== 'string') return '';
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    };

    const dayCards = schedule.map((day, index) => {
        const dayName = weekDays[index].name.substring(0, 3);
        const dayDate = weekDays[index].date.getDate().toString().padStart(2, '0');
        const x = startX + index * (cardWidth + gap);
        
        let shiftsContent = '';
        let cardBorderColor = '#334155';
        
        if (day.type === 'work') {
            cardBorderColor = '#38BDF8';
            shiftsContent = day.shifts.map((shift, i) => {
                const shiftY = 70 + i * 26;
                const shiftText = escapeXml(`${shift.start} - ${shift.end}`);
                return `
                    <g>
                        <rect x="10" y="${shiftY}" width="${cardWidth - 20}" height="20" rx="4" fill="#0F172A" />
                        <text x="${cardWidth / 2}" y="${shiftY + 14}" class="shift-text" text-anchor="middle">${shiftText}</text>
                    </g>
                `;
            }).join('');
        } else if (day.type === 'rest') {
            cardBorderColor = '#2DD4BF';
            shiftsContent = `<text x="${cardWidth / 2}" y="${cardHeight / 2 + 10}" class="rest-text" text-anchor="middle">Riposo</text>`;
        } else {
            shiftsContent = `<text x="${cardWidth / 2}" y="${cardHeight / 2 + 10}" class="empty-text" text-anchor="middle">-</text>`;
        }

        return `
            <g transform="translate(${x}, ${startY})">
                <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="#1E293B" stroke="${cardBorderColor}" stroke-width="1.5" />
                <text x="12" y="25" class="day-name">${escapeXml(dayName)}</text>
                <text x="${cardWidth - 12}" y="25" class="day-date" text-anchor="end">${escapeXml(dayDate)}</text>
                ${shiftsContent}
            </g>
        `;
    }).join('');

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
                .main-title { font-size: 26px; font-weight: bold; fill: #FFFFFF; }
                .sub-title { font-size: 15px; fill: #94A3B8; }
                .day-name { font-size: 14px; font-weight: 500; fill: #CBD5E1; text-transform: capitalize; }
                .day-date { font-size: 16px; fill: #94A3B8; }
                .shift-text { font-family: monospace; font-size: 12px; font-weight: 500; fill: #E2E8F0; }
                .rest-text { font-size: 18px; font-weight: bold; fill: #2DD4BF; }
                .empty-text { font-size: 30px; fill: #475569; }
                .footer-label { font-size: 13px; font-weight: 500; fill: #94A3B8; }
                .footer-value { font-size: 22px; font-weight: bold; fill: #FFFFFF; }
            </style>
            
            <g class="root">
                <rect width="100%" height="100%" fill="#0B0F19" />
                
                <text x="${width / 2}" y="45" class="main-title" text-anchor="middle">Orario Settimanale</text>
                <text x="${width / 2}" y="68" class="sub-title" text-anchor="middle">${escapeXml(dateRange || '')}</text>
                
                ${dayCards}
                
                <g transform="translate(${width - 40}, ${height - 50})">
                    <text x="0" y="0" class="footer-label" text-anchor="end">Monte Ore</text>
                    <text x="0" y="28" class="footer-value" text-anchor="end">${escapeXml(totalHours)}</text>
                </g>
            </g>
        </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svgString)}`;
};