import LoggingService from './loggingService.js';

// --- Central Notification Service ---
// logic has been migrated to the Server (server.js) + Chrome Extension.
// This file now serves as a bridge for the frontend "Test" buttons to trigger the Server.

/**
 * Starts the service.
 * Previously this started a polling interval. Now it just logs that we are using the server.
 */
function start() {
    LoggingService.info('[CentralNotificationService] Client-side polling is DISABLED. Notifications are now handled by the Server.', { functionName: 'start' });
}

/**
 * Stops the service. (No-op now)
 */
function stop() {
    // No-op
}

/**
 * Sends a test notification via the Server (to the Extension).
 * This handles the "Test" button in the Profile Menu (and others using this service).
 */
async function fireTestNotification() {
    const functionName = 'fireTestNotification';
    LoggingService.info('[CentralNotificationService] Requesting Server to fire test notification...', { functionName });
    
    try {
        const response = await fetch('/api/notifications/test-extension', {
            method: 'POST'
        });
        
        if (response.ok) {
            LoggingService.info('[CentralNotificationService] Server successfully triggered test.', { functionName });
        } else {
            console.error('Server returned error for test notification.');
            alert('Server failed to send test notification.');
        }
    } catch (error) {
        LoggingService.error('[CentralNotificationService] Network error requesting test.', error, { functionName });
        alert('Could not reach server to send test.');
    }
}

export const CentralNotificationService = {
    initialize: start,
    stop,
    fireTestNotification
};