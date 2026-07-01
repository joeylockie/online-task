// labelService.js
// This service handles logic related to managing labels on tasks.
// It now interacts with the server-side API instead of IndexedDB.

import AppStore from './store.js';
import EventBus from './eventBus.js';
import LoggingService from './loggingService.js';

// --- NEW API Helper Function ---
/**
 * A simple helper function for API calls specific to this service.
 * @param {string} url - The API endpoint to call (e.g., '/api/labels/delete')
 * @param {object} options - The options for fetch() (e.g., method, headers, body)
 */
async function _apiCall(url, options = {}) {
    const functionName = '_apiCall (LabelService)';
    
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
            LoggingService.error(`[LabelService] API call failed for ${url}`, errorData.error || response.statusText, { functionName, url, status: response.status });
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        
        if (response.status === 204) { // Handle "No Content"
            return { success: true, data: null };
        }

        return await response.json(); // { success: true, data: ... }

    } catch (error) {
        LoggingService.error(`[LabelService] Network error during API call to ${url}`, error, { functionName, url });
        throw error;
    }
}


/**
 * Deletes a label from all tasks that use it by calling the server API.
 * @param {string} labelNameToDelete - The name of the label to delete.
 */
export async function deleteLabelUsageFromTasks(labelNameToDelete) {
    const functionName = 'deleteLabelUsageFromTasks';
    if (!labelNameToDelete || typeof labelNameToDelete !== 'string') {
        LoggingService.warn("[LabelService] Invalid label name provided.", { functionName, receivedName: labelNameToDelete });
        return false; // Return false on failure
    }

    try {
        // 1. Call the server API to update all tasks with this label
        const response = await _apiCall('/api/labels/delete', {
            method: 'POST',
            body: { labelName: labelNameToDelete }
        });

        const updatedCount = response.data.updatedCount;

        if (updatedCount > 0) {
            // 2. Refresh the entire AppStore to get the updated task list
            // This is the simplest way to ensure the UI reflects the server state.
            await AppStore.initializeStore(); 

            LoggingService.info(`[LabelService] Label "${labelNameToDelete}" removed from ${updatedCount} tasks via API.`, { functionName });
            EventBus.publish('displayUserMessage', { text: `Label "${labelNameToDelete}" removed.`, type: 'success' });
            return true; // Return true on success
        } else {
            LoggingService.info(`[LabelService] Label "${labelNameToDelete}" not found on any tasks.`, { functionName });
            return true; // Still a "success" as no error occurred
        }
    } catch (error) {
        LoggingService.error(`[LabelService] Error deleting label from tasks via API.`, error, { functionName });
        EventBus.publish('displayUserMessage', { text: 'Error removing label.', type: 'error' });
        return false; // Return false on failure
    }
}

/**
 * This function is a check, not a database operation. It verifies if a label can be conceptually added.
 * Its logic remains the same as it checks the AppStore cache, which is always up-to-date.
 * @param {string} labelName - The name of the label to check.
 * @returns {boolean} True if the label name is valid and not a duplicate.
 */
export function addConceptualLabel(labelName) {
    const functionName = 'addConceptualLabel';
    const trimmedLabelName = labelName.trim();

    if (trimmedLabelName === '') {
        EventBus.publish('displayUserMessage', { text: 'Label name cannot be empty.', type: 'error' });
        return false;
    }

    // The unique labels list is derived from the tasks in AppStore's cache.
    let currentUniqueLabels = AppStore.getUniqueLabels();
    if (currentUniqueLabels.some(l => l.toLowerCase() === trimmedLabelName.toLowerCase())) {
        EventBus.publish('displayUserMessage', { text: `Label "${trimmedLabelName}" already exists.`, type: 'info' });
        return false;
    }

    LoggingService.info(`[LabelService] Label "${trimmedLabelName}" is valid for creation.`, { functionName });
    return true;
}