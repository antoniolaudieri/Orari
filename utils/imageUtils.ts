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
    const width = 600; // Ridotto da 800 per migliore compatibilità mobile
    const height = 400; // Altezza leggermente ridotta
    const cardWidth = 72; // Larghezza card adattata
    const cardHeight = 180; // Altezza card adattata
    const gap = 10; // Spaziatura adattata
    const totalWidth = 7 * cardWidth + 6 * gap;
    const startX = (width - totalWidth) / 2;
    
    const dayCards = schedule.map((day, index) => {
        const dayName = weekDays[index].name.substring(0, 3);
        const dayDate = weekDays[index].date.getDate().toString().padStart(2, '0');
        const x = startX + index * (cardWidth + gap);
        
        let shiftsContent = '';
        if (day.type === 'work') {
            shiftsContent = day.shifts.map((shift, i) => 
                `<div class="shift">${shift.start} - ${shift.end}</div>`
            ).join('');
        } else if (day.type === 'rest') {
            shiftsContent = `<div class="rest-text">Riposo</div>`;
        } else {
            shiftsContent = `<div class="empty-text">-</div>`;
        }

        return `
            <div class="card ${day.type}" style="position: absolute; left: ${x}px; top: 100px; width: ${cardWidth}px; height: ${cardHeight}px;">
                <div class="day-header">
                    <span class="day-name">${dayName}</span>
                    <span class="day-date">${dayDate}</span>
                </div>
                <div class="shifts-container">
                    ${shiftsContent}
                </div>
            </div>
        `;
    }).join('');

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                    <style>
                        .container {
                            width: ${width}px;
                            height: ${height}px;
                            background-color: #0B0F19;
                            color: #E2E8F0;
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            padding: 20px;
                            box-sizing: border-box;
                            position: relative;
                        }
                        .header-text {
                            font-size: 24px; /* Ridotto */
                            font-weight: bold;
                            color: #fff;
                            margin-bottom: 5px;
                        }
                        .date-range {
                            font-size: 14px; /* Ridotto */
                            color: #94A3B8;
                            margin-bottom: 20px; /* Ridotto */
                        }
                        .card {
                            background-color: #1E293B;
                            border-radius: 10px; /* Leggermente più piccolo */
                            padding: 10px; /* Leggermente più piccolo */
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            border: 1px solid #334155;
                        }
                        .card.work {
                            border-color: #38BDF8;
                        }
                        .card.rest {
                             border-color: #2DD4BF;
                        }
                        .day-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: baseline;
                            font-weight: bold;
                            margin-bottom: 8px; /* Leggermente più piccolo */
                        }
                        .day-name {
                            font-size: 13px; /* Ridotto */
                            text-transform: capitalize;
                            color: #CBD5E1;
                        }
                        .day-date {
                            font-size: 16px; /* Ridotto */
                            color: #94A3B8;
                        }
                        .shifts-container {
                            flex-grow: 1;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            gap: 6px; /* Leggermente più piccolo */
                        }
                        .shift {
                            background-color: #0F172A;
                            color: #E2E8F0;
                            border-radius: 4px;
                            padding: 3px 6px;
                            font-size: 12px; /* Ridotto */
                            font-weight: 500;
                            width: 100%;
                            text-align: center;
                            box-sizing: border-box;
                        }
                        .rest-text {
                            font-size: 18px; /* Ridotto */
                            font-weight: bold;
                            color: #2DD4BF;
                        }
                        .empty-text {
                            font-size: 28px; /* Ridotto */
                            color: #475569;
                        }
                        .footer {
                            position: absolute;
                            bottom: 20px; /* Adattato */
                            right: 25px; /* Adattato */
                            text-align: right;
                        }
                        .footer-label {
                            font-size: 12px; /* Ridotto */
                            color: #94A3B8;
                        }
                        .footer-value {
                            font-size: 20px; /* Ridotto */
                            font-weight: bold;
                            color: #fff;
                        }
                    </style>
                    <div class="container">
                        <div class="header-text">Orario Settimanale</div>
                        <div class="date-range">${dateRange || ''}</div>
                        ${dayCards}
                        <div class="footer">
                            <div class="footer-label">Monte Ore</div>
                            <div class="footer-value">${totalHours}</div>
                        </div>
                    </div>
                </div>
            </foreignObject>
        </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svgString)}`;
};