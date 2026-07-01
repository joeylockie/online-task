// timeTrackerService.js
// Manages logic for the time tracker feature.
// Active timers are client-side (localStorage).
// All permanent data (activities, logs) is on the server via API.

import LoggingService from './loggingService.js';
import AppStore from './store.js';
import EventBus from './eventBus.js'; // Import EventBus
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

const ACTIVE_TIMERS_KEY = 'timeTracker_active_timers_v2';

// --- Internal State ---
let _activeTimers = []; // Now an array

// --- NEW API Helper Function ---
async function _apiCall(url, options = {}) {
    const functionName = '_apiCall (TimeTrackerService)';
    
    if (!options.headers) {
        options.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] === 'application/json') {
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json();
            LoggingService.error(`[TimeTrackerService] API call failed for ${url}`, errorData.error || response.statusText, { functionName, url, status: response.status });
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        
        if (response.status === 204) { // Handle "No Content" for deletes
            return { success: true, data: null };
        }

        return await response.json(); // { success: true, data: ... }

    } catch (error) {
        LoggingService.error(`[TimeTrackerService] Network error during API call to ${url}`, error, { functionName, url });
        throw error;
    }
}


// --- Private Helper Functions (for active timer) ---
function _loadActiveTimers() {
    try {
        // --- MIGRATION LOGIC ---
        const oldTimerKey = 'timeTracker_active_timer_v1';
        const oldTimerData = localStorage.getItem(oldTimerKey);
        if (oldTimerData) {
            const oldTimer = JSON.parse(oldTimerData);
            if (oldTimer && oldTimer.activityId) {
                _activeTimers = [oldTimer];
                localStorage.setItem(ACTIVE_TIMERS_KEY, JSON.stringify(_activeTimers));
                localStorage.removeItem(oldTimerKey);
                LoggingService.info('[TimeTrackerService] Migrated old active timer to new multi-timer format.');
            }
        }
        // --- END MIGRATION LOGIC ---

        const storedTimers = localStorage.getItem(ACTIVE_TIMERS_KEY);
        _activeTimers = storedTimers ? JSON.parse(storedTimers) : [];
        _activeTimers.forEach(timer => {
            if (timer.startTime) timer.startTime = new Date(timer.startTime);
            if (timer.pauseTime) timer.pauseTime = new Date(timer.pauseTime);
        });
    } catch (error) {
        LoggingService.error('[TimeTrackerService] Error loading active timers from localStorage.', error);
        _activeTimers = [];
    }
}

function _saveActiveTimers() {
    try {
        localStorage.setItem(ACTIVE_TIMERS_KEY, JSON.stringify(_activeTimers));
    } catch (error) {
        LoggingService.error('[TimeTrackerService] Error saving active timers to localStorage.', error);
    }
}

// --- Public API ---

// REFACTORED: Reads from AppStore cache instead of DB
function getTodaysTotalTrackedMs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all logs from the AppStore cache
    const allEntries = AppStore.getTimeLogEntries();
    
    const todaysEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.s || entry.startTime);
        return entryDate >= today;
    });

    // Calculate duration on the fly
    return todaysEntries.reduce((total, entry) => {
        const startTime = new Date(entry.s || entry.startTime).getTime();
        const endTime = new Date(entry.e || entry.endTime).getTime();
        return total + (endTime - startTime);
    }, 0);
}


// REFACTORED: Uses API
async function addActivity(activityData) {
    const newActivity = { ...activityData, createdAt: new Date().toISOString() };
    
    try {
        const response = await _apiCall('/api/time/activities', {
            method: 'POST',
            body: newActivity
        });
        const addedActivity = response.data; // Get the activity back with its new ID

        const allActivities = [...AppStore.getTimeActivities(), addedActivity];
        AppStore.setTimeActivities(allActivities);
    } catch (error) {
        LoggingService.error('[TimeTrackerService] Error adding activity via API', error);
    }
}

// REFACTORED: Uses API
async function deleteActivity(activityId) {
    try {
        await _apiCall(`/api/time/activities/${activityId}`, {
            method: 'DELETE'
        });
        
        // Refresh cache and publish changes
        const allActivities = AppStore.getTimeActivities().filter(a => a.id !== activityId);
        const allLogEntries = AppStore.getTimeLogEntries().filter(log => log.a !== activityId);
        
        AppStore.setTimeActivities(allActivities);
        AppStore.setTimeLogEntries(allLogEntries);
    } catch (error) {
        LoggingService.error(`[TimeTrackerService] Error deleting activity ${activityId} via API`, error);
    }
}

// REFACTORED: Uses API
async function stopTracking(activityId) {
    const timerIndex = _activeTimers.findIndex(t => t.activityId === activityId);
    if (timerIndex === -1) return;

    const timerToStop = _activeTimers[timerIndex];
    try {
        const endTime = timerToStop.isPaused ? timerToStop.pauseTime : new Date();
        const newLogEntry = {
            a: timerToStop.activityId,
            s: timerToStop.startTime,
            e: endTime,
            n: timerToStop.notes || '',
            m: false,
        };

        // 1. Save the new log to the server
        const response = await _apiCall('/api/time/logs', {
            method: 'POST',
            body: newLogEntry
        });
        const savedLogEntry = response.data; // Get the log back with its new ID

        // 2. Update local state (remove active timer)
        _activeTimers.splice(timerIndex, 1);
        _saveActiveTimers();
        EventBus.publish('activeTimerChanged', getActiveTimers());

        // 3. Update AppStore cache
        const allEntries = [...AppStore.getTimeLogEntries(), savedLogEntry];
        AppStore.setTimeLogEntries(allEntries);

    } catch (error) {
        LoggingService.error('[TimeTrackerService] Error in stopTracking.', error);
    }
}

// REFACTORED: Uses API
async function addLogEntry(logData) {
    const newLog = {
        a: parseInt(logData.activityId),
        s: new Date(logData.startTime),
        e: new Date(logData.endTime),
        n: logData.notes || '',
        m: true
    };
    
    try {
        const response = await _apiCall('/api/time/logs', {
            method: 'POST',
            body: newLog
        });
        const savedLogEntry = response.data;
        
        const allEntries = [...AppStore.getTimeLogEntries(), savedLogEntry];
        AppStore.setTimeLogEntries(allEntries);
    } catch (error) {
        LoggingService.error('[TimeTrackerService] Error in addLogEntry.', error);
    }
}

// REFACTORED: Uses API
async function updateLogEntry(logId, updatedData) {
    const updatePayload = {
        a: parseInt(updatedData.activityId),
        n: updatedData.notes || '',
        s: new Date(updatedData.startTime),
        e: new Date(updatedData.endTime)
    };
    
    try {
        const response = await _apiCall(`/api/time/logs/${logId}`, {
            method: 'PUT',
            body: updatePayload
        });
        const updatedLogEntry = response.data;
        
        const allEntries = AppStore.getTimeLogEntries().map(log => 
            log.id === logId ? updatedLogEntry : log
        );
        AppStore.setTimeLogEntries(allEntries);
    } catch (error) {
        LoggingService.error(`[TimeTrackerService] Error in updateLogEntry ${logId}.`, error);
    }
}

// REFACTORED: Uses API
async function deleteLogEntry(logId) {
    try {
        await _apiCall(`/api/time/logs/${logId}`, {
            method: 'DELETE'
        });
        
        const allEntries = AppStore.getTimeLogEntries().filter(log => log.id !== logId);
        AppStore.setTimeLogEntries(allEntries);
    } catch (error) {
        LoggingService.error(`[TimeTrackerService] Error in deleteLogEntry ${logId}.`, error);
    }
}

// --- UNCHANGED Functions (Read from AppStore or LocalStorage) ---

function getActivities() { return AppStore ? AppStore.getTimeActivities() : []; }

function getLogEntries() {
    if (!AppStore) return [];
    // Transform new compact format to old UI format
    return AppStore.getTimeLogEntries().map(entry => {
        // If it's already in the old format (from a failed migration, etc.), just return it
        if (entry.startTime) return entry;
        
        // Transform the new format to the old one for the UI
        return {
            id: entry.id,
            activityId: entry.a,
            startTime: entry.s,
            endTime: entry.e,
            notes: entry.n,
            manuallyAdded: entry.m,
            durationMs: new Date(entry.e).getTime() - new Date(entry.s).getTime()
        };
    });
}

function getActiveTimers() { return [..._activeTimers]; }

async function startTracking(activityId) {
    const existingTimer = _activeTimers.find(t => t.activityId === activityId);
    if (existingTimer) {
        if (existingTimer.isPaused) {
            resumeTracking(activityId);
        }
        return; 
    }

    // Check AppStore cache instead of db
    const activity = AppStore.getTimeActivities().find(a => a.id === activityId);
    if (!activity) {
        LoggingService.warn('[TimeTrackerService] Attempted to start tracking for non-existent activity ID:', { activityId });
        return;
    }

    _activeTimers.push({
        activityId: activityId,
        startTime: new Date(),
        isPaused: false,
        pauseTime: null,
        totalPausedMs: 0
    });
    _saveActiveTimers();
    EventBus.publish('activeTimerChanged', getActiveTimers());
}

function pauseTracking(activityId) {
    const timer = _activeTimers.find(t => t.activityId === activityId);
    if (!timer || timer.isPaused) return;
    timer.isPaused = true;
    timer.pauseTime = new Date();
    _saveActiveTimers();
    EventBus.publish('activeTimerChanged', getActiveTimers());
}

function resumeTracking(activityId) {
    const timer = _activeTimers.find(t => t.activityId === activityId);
    if (!timer || !timer.isPaused) return;
    const pausedMs = new Date().getTime() - timer.pauseTime.getTime();
    timer.totalPausedMs += pausedMs;
    timer.startTime = new Date(timer.startTime.getTime() + pausedMs);
    timer.isPaused = false;
    timer.pauseTime = null;
    _saveActiveTimers();
    EventBus.publish('activeTimerChanged', getActiveTimers());
}

// --- NEW: Update Active Timer Start Time ---
function updateActiveTimerStartTime(activityId, newTimeString) {
    const timer = _activeTimers.find(t => t.activityId === activityId);
    if (!timer) return false;

    // newTimeString is expected in "HH:MM" format
    const [hours, minutes] = newTimeString.split(':').map(Number);
    
    const newStartDate = new Date(timer.startTime);
    newStartDate.setHours(hours, minutes, 0, 0);

    // Prevent setting start time in the future
    if (newStartDate.getTime() > Date.now()) {
        alert("Start time cannot be in the future.");
        return false;
    }

    timer.startTime = newStartDate;
    _saveActiveTimers();
    
    // We intentionally DO NOT publish the 'activeTimerChanged' event here.
    // If we do, the UI completely destroys and re-renders the DOM, which breaks 
    // the user's focus on the input box while they are typing. 
    return true;
}

// --- NEW: Global Automation Listeners (Twitch & Work & Webhooks) ---
let globalSocket = null;

function setupAutomations() {
    if (globalSocket) return; // Prevent opening multiple connections
    globalSocket = io();

    // --- NEW: HOME ASSISTANT WEBHOOK LISTENER ---
    globalSocket.on('remote-timer-command', async (data) => {
        const { action, activityName } = data;
        LoggingService.info(`[TimeTrackerService] Received remote command: ${action} ${activityName}`);

        const activities = getActivities();
        // Match by exact name (case-insensitive)
        const targetActivity = activities.find(a => a.name.toLowerCase() === activityName.toLowerCase());

        if (!targetActivity) {
            LoggingService.warn(`[TimeTrackerService] Webhook failed: Could not find activity named "${activityName}"`);
            return;
        }

        if (action === 'start') {
            await startTracking(targetActivity.id);
        } else if (action === 'stop') {
            await stopTracking(targetActivity.id);
        }
    });

    // 1. Twitch: Real-Time Listener
    globalSocket.on('twitch-stream-status', async (data) => {
        LoggingService.info('[TimeTrackerService] Received real-time Twitch status:', data);
        await applyTwitchTimerState(data.isLive);
    });

    // 2. Wake-Up Sync (Checks both when tab wakes up)
    globalSocket.on('connect', async () => {
        LoggingService.info('[TimeTrackerService] Socket connected. Syncing automations...');
        await syncTwitchState();
        await syncWorkState();
    });

    // 3. The 60-Second Fallback (Checks both every minute)
    setInterval(async () => {
        await syncTwitchState();
        await syncWorkState();
    }, 60 * 1000);
}

// --- TWITCH LOGIC ---
async function syncTwitchState() {
    try {
        const toggleRes = await fetch('/api/app_state/feature_twitch_time_tracking');
        const toggleJson = await toggleRes.json();
        if (!toggleJson.success || !toggleJson.data) return;

        const stateRes = await fetch('/api/app_state/stream_monitor_state');
        const stateJson = await stateRes.json();
        const streamState = (stateJson.success && stateJson.data) ? stateJson.data : { isLive: false };
        
        await applyTwitchTimerState(streamState.isLive === true);
    } catch (e) {
        console.error('Failed to sync Twitch timer state:', e);
    }
}

async function applyTwitchTimerState(isLive) {
    const activities = getActivities();
    const twitchActivity = activities.find(a => a.name.toLowerCase().includes('twitch'));
    if (!twitchActivity) return;

    const isTimerRunning = _activeTimers.some(t => t.activityId === twitchActivity.id);

    if (isLive && !isTimerRunning) {
        LoggingService.info('Twitch Sync: Auto-starting timer globally...');
        await startTracking(twitchActivity.id);
    } else if (!isLive && isTimerRunning) {
        LoggingService.info('Twitch Sync: Auto-stopping timer globally...');
        await stopTracking(twitchActivity.id);
    }
}

// --- WORK LOGIC ---
async function syncWorkState() {
    try {
        // Check if the user has the switch turned ON
        const toggleRes = await fetch('/api/app_state/feature_work_time_tracking');
        const toggleJson = await toggleRes.json();
        if (!toggleJson.success || !toggleJson.data) return; // Stop if switch is OFF

        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
        const hours = now.getHours(); // 0 to 23 (Military Time)
        const minutes = now.getMinutes();

        // Is it Monday (1) through Friday (5)?
        const isWorkDay = day >= 1 && day <= 5;
        
        // Is it after 9:00 AM?
        const isAfterStart = (hours > 9) || (hours === 9 && minutes >= 0);
        // Is it before 5:30 PM (17:30)?
        const isBeforeEnd = (hours < 17) || (hours === 17 && minutes < 30);
        
        // It is Work Hours IF it's a workday, and between our start/end times
        const isWorkHours = isWorkDay && isAfterStart && isBeforeEnd;

        await applyWorkTimerState(isWorkHours);
    } catch (e) {
        console.error('Failed to sync Work timer state:', e);
    }
}

async function applyWorkTimerState(isWorkHours) {
    const activities = getActivities();
    const workActivity = activities.find(a => a.name.toLowerCase().includes('work'));
    if (!workActivity) return;

    const isTimerRunning = _activeTimers.some(t => t.activityId === workActivity.id);

    if (isWorkHours && !isTimerRunning) {
        LoggingService.info('Work Sync: Work hours started! Auto-starting timer...');
        await startTracking(workActivity.id);
    } else if (!isWorkHours && isTimerRunning) {
        LoggingService.info('Work Sync: Work hours ended! Auto-stopping timer...');
        await stopTracking(workActivity.id);
    }
}

function initialize() {
    _loadActiveTimers();
    setupAutomations();
    LoggingService.info('[TimeTrackerService] Initialized.');
}

const TimeTrackerService = {
    initialize,
    getActivities,
    getLogEntries,
    getActiveTimers,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    updateActiveTimerStartTime,
    addLogEntry,
    updateLogEntry,
    deleteLogEntry,
    addActivity,
    deleteActivity,
    getTodaysTotalTrackedMs,
};

export default TimeTrackerService;