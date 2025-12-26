import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmartSuggestionsQueryDto } from './dto/smart-suggestions-query.dto';
import {
  BookingStatus,
  DayOfWeek,
  DoctorWorkingHours,
  DoctorBreakTime,
} from '@prisma/client';

export interface TimeSlot {
  date: string;
  dayOfWeek: string;
  time: string;
  availableSlots: number;
  score: number;
  reasons: string[];
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  maxSlotsPerHour: number;
}

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get smart time slot suggestions based on availability and preferences
   */
  async getSuggestions(queryDto: SmartSuggestionsQueryDto) {
    const {
      doctorId,
      serviceId,
      startDate,
      endDate,
      limit = 5,
      preferMorning = false,
      preferAfternoon = false,
      earliestTime,
      latestTime,
    } = queryDto;

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    if (end < start) {
      throw new BadRequestException('End date must be after start date');
    }

    // Get doctor, service info
    const [doctor, service] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: doctorId },
      }),
      this.prisma.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          maxSlotsPerHour: true,
        },
      }),
    ]);

    if (!doctor) {
      throw new BadRequestException('Doctor not found');
    }

    if (!service) {
      throw new BadRequestException('Service not found');
    }

    // Get doctor's working hours
    const workingHours = await this.prisma.doctorWorkingHours.findMany({
      where: { doctorId },
    });

    if (workingHours.length === 0) {
      return {
        suggestions: [],
        message: 'Doctor has no working hours set',
      };
    }

    // Generate all possible slots
    const allSlots = await this.generateAllSlots(
      doctorId,
      workingHours,
      start,
      end,
      service.durationMinutes,
      earliestTime,
      latestTime,
    );

    // Score each slot
    const scoredSlots = await this.scoreSlots(
      allSlots,
      doctorId,
      service,
      preferMorning,
      preferAfternoon,
    );

    // Sort by score and return top N
    const topSuggestions = scoredSlots
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      suggestions: topSuggestions,
      totalFound: scoredSlots.length,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Generate all possible time slots within date range
   */
  private async generateAllSlots(
    doctorId: string,
    workingHours: DoctorWorkingHours[],
    startDate: Date,
    endDate: Date,
    durationMinutes: number,
    earliestTime?: string,
    latestTime?: string,
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const currentDate = new Date(startDate);

    // Get break times and off days in range
    const [breakTimes, offDays] = await Promise.all([
      this.prisma.doctorBreakTime.findMany({
        where: {
          doctorId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.doctorOffDay.findMany({
        where: {
          doctorId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    // Create maps for quick lookup
    const offDaysSet = new Set(
      offDays.map((od) => od.date.toISOString().split('T')[0]),
    );

    const breakTimesMap = new Map<string, DoctorBreakTime[]>();
    breakTimes.forEach((bt) => {
      const dateKey = bt.date.toISOString().split('T')[0];
      if (!breakTimesMap.has(dateKey)) {
        breakTimesMap.set(dateKey, []);
      }
      breakTimesMap.get(dateKey)?.push(bt);
    });

    // Iterate through each day
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(currentDate);

      // Skip if off day
      if (offDaysSet.has(dateStr)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Find working hours for this day
      const dayWorkingHours = workingHours.find(
        (wh) => wh.dayOfWeek === dayOfWeek,
      );

      if (dayWorkingHours) {
        const dayBreakTimes = breakTimesMap.get(dateStr) || [];

        // Generate time slots for this day
        const daySlots = this.generateDaySlots(
          dateStr,
          dayOfWeek,
          dayWorkingHours.startTime,
          dayWorkingHours.endTime,
          durationMinutes,
          dayBreakTimes,
          earliestTime,
          latestTime,
        );

        slots.push(...daySlots);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Generate time slots for a specific day
   */
  private generateDaySlots(
    date: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    durationMinutes: number,
    breakTimes: DoctorBreakTime[],
    earliestTime?: string,
    latestTime?: string,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentTime = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    // Apply user time preferences
    if (earliestTime) {
      const earliestMinutes = this.timeToMinutes(earliestTime);
      currentTime = Math.max(currentTime, earliestMinutes);
    }

    let effectiveEnd = endMinutes;
    if (latestTime) {
      const latestMinutes = this.timeToMinutes(latestTime);
      effectiveEnd = Math.min(effectiveEnd, latestMinutes);
    }

    while (currentTime + durationMinutes <= effectiveEnd) {
      const timeStr = this.minutesToTime(currentTime);

      // Check if this time conflicts with break times
      const hasConflict = breakTimes.some((bt) => {
        const breakStart = this.timeToMinutes(bt.startTime);
        const breakEnd = this.timeToMinutes(bt.endTime);
        return (
          currentTime < breakEnd && currentTime + durationMinutes > breakStart
        );
      });

      if (!hasConflict) {
        slots.push({
          date,
          dayOfWeek,
          time: timeStr,
          availableSlots: 0, // Will be calculated in scoreSlots
          score: 0,
          reasons: [],
        });
      }

      // Move to next slot (every 30 minutes)
      currentTime += 30;
    }

    return slots;
  }

  /**
   * Score each slot based on various factors
   */
  private async scoreSlots(
    slots: TimeSlot[],
    doctorId: string,
    service: Service,
    preferMorning: boolean,
    preferAfternoon: boolean,
  ): Promise<TimeSlot[]> {
    const scoredSlots: TimeSlot[] = [];

    for (const slot of slots) {
      let score = 0;
      const reasons: string[] = [];

      // Check current bookings for this slot
      const bookingCount = await this.prisma.booking.count({
        where: {
          doctorId,
          bookingDate: new Date(slot.date),
          startTime: slot.time,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
      });

      const availableSlots = service.maxSlotsPerHour - bookingCount;

      // Skip if no slots available
      if (availableSlots <= 0) {
        continue;
      }

      slot.availableSlots = availableSlots;

      // Score based on availability
      if (availableSlots === service.maxSlotsPerHour) {
        score += 10;
        reasons.push('Fully available');
      } else if (availableSlots >= service.maxSlotsPerHour / 2) {
        score += 5;
        reasons.push('Good availability');
      } else {
        score += 2;
        reasons.push('Limited availability');
      }

      // Score based on time of day
      const timeMinutes = this.timeToMinutes(slot.time);

      // Morning preference (8:00 - 11:00)
      if (timeMinutes >= 480 && timeMinutes < 660) {
        if (preferMorning) {
          score += 5;
          reasons.push('Morning slot (preferred)');
        } else {
          score += 3;
          reasons.push('Morning slot');
        }
      }

      // Afternoon preference (14:00 - 16:00)
      if (timeMinutes >= 840 && timeMinutes < 960) {
        if (preferAfternoon) {
          score += 5;
          reasons.push('Afternoon slot (preferred)');
        } else {
          score += 2;
          reasons.push('Afternoon slot');
        }
      }

      // Penalty for near lunch (11:30 - 13:00)
      if (timeMinutes >= 690 && timeMinutes < 780) {
        score -= 2;
        reasons.push('Near lunch time');
      }

      // Penalty for end of day (after 16:30)
      if (timeMinutes >= 990) {
        score -= 2;
        reasons.push('Late in the day');
      }

      // Bonus for early morning (8:00 - 9:00)
      if (timeMinutes >= 480 && timeMinutes < 540) {
        score += 1;
        reasons.push('Early morning');
      }

      // Bonus for mid-morning (9:00 - 10:00)
      if (timeMinutes >= 540 && timeMinutes < 600) {
        score += 2;
        reasons.push('Mid-morning (optimal)');
      }

      // Day of week bonus (weekdays better than Saturday)
      if (
        ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(
          slot.dayOfWeek,
        )
      ) {
        score += 1;
      }

      // Sooner date gets slight bonus
      const daysFromNow = Math.floor(
        (new Date(slot.date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysFromNow <= 3) {
        score += 2;
        reasons.push('Available soon');
      }

      slot.score = score;
      slot.reasons = reasons;
      scoredSlots.push(slot);
    }

    return scoredSlots;
  }

  /**
   * Get day of week from date
   */
  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  /**
   * Convert time string (HH:mm) to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string (HH:mm)
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
