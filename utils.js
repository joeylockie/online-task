// utils.js
// This file contains general utility functions for date and time formatting,
// and other helper functions that can be used across the application.

import LoggingService from './loggingService.js';

/**
 * Returns the current date as a string in YYYY-MM-DD format, respecting the user's local timezone.
 * @returns {string} Today's date.
 */
export function getTodayDateString() {
    // Hardcoded to New York time
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Converts a Date object to a string in YYYY-MM-DD format, respecting the user's local timezone.
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string.
 */
export function getDateString(date) {
    const functionName = 'getDateString'; // For logging context
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        LoggingService.warn(`[Utils] ${functionName}: Invalid date object provided. Falling back to today.`, { functionName, providedDate: date });
        return getTodayDateString(); // Fallback to today's local date
    }
    // Format as YYYY-MM-DD in NY time
    return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}


/**
 * Formats a date string or Date object into a more readable format (e.g., "Jul 30, 2025").
 * This function now correctly handles timezone offsets for YYYY-MM-DD strings.
 * @param {string|Date} dateInput - The date string (YYYY-MM-DD or full ISO) or Date object.
 * @returns {string} The formatted date string, or 'Invalid Date'/'Not set'.
 */
export function formatDate(dateInput) {
    const functionName = 'formatDate';
    if (!dateInput) return 'Not set';

    let date;
    // Check if the input is already a Date object
    if (dateInput instanceof Date) {
        // Build the date safely to avoid shifting timezones
        const year = dateInput.getFullYear();
        const month = String(dateInput.getMonth() + 1).padStart(2, '0');
        const day = String(dateInput.getDate()).padStart(2, '0');
        date = new Date(`${year}-${month}-${day}T12:00:00`);
    } else {
        // It's a string, so we extract the date part
        const dateString = typeof dateInput === 'string' ? dateInput.split('T')[0] : String(dateInput);
        date = new Date(`${dateString}T12:00:00`); // Use noon to avoid timezone shifts
    }

    if (isNaN(date.getTime())) {
        LoggingService.debug(`[Utils] ${functionName}: Received invalid dateInput.`, { functionName, dateInput });
        return 'Invalid Date';
    }

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC' 
    });
}


/**
 * Formats a time string (HH:MM) or a Date object into a 12-hour format with AM/PM.
 * @param {string|Date} timeInput - The time string in HH:MM format or a Date object.
 * @returns {string} The formatted time string, or 'Not set'.
 */
export function formatTime(timeInput) {
    const functionName = 'formatTime';
    if (!timeInput) return 'Not set';

    // Handle Date objects -> Force NY Time
    if (timeInput instanceof Date) {
        return timeInput.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'America/New_York' 
        });
    }

    // Handle HH:MM strings (unchanged, as they are literal)
    if (typeof timeInput === 'string' && timeInput.includes('T')) {
        try {
            return new Date(timeInput).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                timeZone: 'America/New_York' 
            });
        } catch (e) { 
            // Fallback if parsing fails
        }
    }

    const [hours, minutes] = String(timeInput).split(':');
    if (isNaN(parseInt(hours)) || isNaN(parseInt(minutes))) {
        LoggingService.debug(`[Utils] ${functionName}: Received invalid timeString.`, { functionName, timeInput });
        return 'Invalid Time';
    }
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHours = h % 12 || 12;
    return `${String(formattedHours)}:${String(m).padStart(2, '0')} ${ampm}`;
}


/**
 * Formats estimated hours and minutes into a readable string.
 * @param {number|string} hours - The number of hours.
 * @param {number|string} minutes - The number of minutes.
 * @returns {string} The formatted duration string.
 */
export function formatDuration(hours, minutes) {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    if (h === 0 && m === 0) return 'Not set';
    let parts = [];
    if (h > 0) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} min${m > 1 ? 's' : ''}`);
    return parts.join(' ');
}

/**
 * Converts milliseconds into a HMS (Hours:Minutes:Seconds) string format.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted HMS string.
 */
export function formatMillisecondsToHMS(ms) {
    const functionName = 'formatMillisecondsToHMS'; // For logging context
    if (ms === null || typeof ms === 'undefined' || ms < 0 || isNaN(ms)) {
        LoggingService.debug(`[Utils] ${functionName}: Invalid milliseconds value. Returning "00:00:00".`, { functionName, ms });
        return "00:00:00";
    }
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * NEW FUNCTION: Converts a Date object to a string in YYYY-MM-DD format, using UTC.
 * This prevents timezone-related date shifts when performing date math.
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted UTC date string.
 */
export function getUTCDateString(date) {
    const functionName = 'getUTCDateString';
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        LoggingService.warn(`[Utils] ${functionName}: Invalid date object provided.`, { functionName, providedDate: date });
        // Return a fallback or handle error appropriately. Here, returning empty string.
        return '';
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}