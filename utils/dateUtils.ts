import type { Shift } from '../types.js';

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getWeekStartDate = (date: Date): Date => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
};

export const getWeekDays = (startDate: Date): { name: string; date: Date }[] => {
  const days = [];
  const start = getWeekStartDate(new Date(startDate));
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    days.push({
      name: currentDate.toLocaleDateString('it-IT', { weekday: 'long' }),
      date: currentDate,
    });
  }
  return days;
};

export const timeToMinutes = (timeStr: string): number => {
    if (typeof timeStr !== 'string' || !timeStr) return 0;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0], 10) || 0;
    const minute = parseInt(parts[1], 10) || 0;
    return hour * 60 + minute;
};

export const calculateHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  try {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    let diff = endMinutes - startMinutes;
    if (diff < 0) { // Overnight shift
        diff += 24 * 60;
    }
    
    return diff / 60;
  } catch (e) {
    console.error("Error calculating hours:", e);
    return 0;
  }
};

export const formatDecimalHours = (hoursDecimal: number): string => {
  if (typeof hoursDecimal !== 'number' || isNaN(hoursDecimal)) {
    return '0h 0m';
  }
  const totalMinutes = Math.round(hoursDecimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export const formatDateRange = (startDate: Date): string => {
    const start = getWeekStartDate(new Date(startDate));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('it-IT', { month: 'long' });
    const endMonth = end.toLocaleDateString('it-IT', { month: 'long' });
    const year = end.getFullYear();

    if (startMonth === endMonth) {
        return `${startDay} - ${endDay} ${startMonth} ${year}`;
    } else {
        const startYear = start.getFullYear();
        if (startYear !== year) {
             return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${year}`;
        }
        return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
    }
};


export const getMonthGrid = (date: Date): { date: Date; isCurrentMonth: boolean }[] => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const grid: { date: Date; isCurrentMonth: boolean }[] = [];

  // Get start day of week (Monday is 1, Sunday is 0)
  const firstDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  // Days from previous month
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDay = new Date(firstDayOfMonth);
    prevMonthDay.setDate(firstDayOfMonth.getDate() - (firstDayOfWeek - i));
    grid.push({ date: prevMonthDay, isCurrentMonth: false });
  }

  // Days of current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    grid.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Days from next month
  const lastDayOfWeek = lastDayOfMonth.getDay() === 0 ? 6 : lastDayOfMonth.getDay() - 1;
  for (let i = 1; i < 7 - lastDayOfWeek; i++) {
    const nextMonthDay = new Date(lastDayOfMonth);
    nextMonthDay.setDate(lastDayOfMonth.getDate() + i);
    grid.push({ date: nextMonthDay, isCurrentMonth: false });
  }
  
  // Ensure the grid has 35 or 42 cells
  while (grid.length < 35) {
      const lastDate: Date = grid[grid.length - 1].date;
      const nextDate: Date = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + 1);
      grid.push({ date: nextDate, isCurrentMonth: false });
  }

  if (grid.length > 35) {
      while(grid.length < 42) {
        const lastDate: Date = grid[grid.length - 1].date;
        const nextDate: Date = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1);
        grid.push({ date: nextDate, isCurrentMonth: false });
      }
  }


  return grid;
};