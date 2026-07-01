// tasks_main.js
// Main entry point for the Task Manager application.

import EventBus from './eventBus.js';
import AppStore from './store.js';
import { setupEventListeners, applyActiveFeatures, setFilter } from './tasks_ui_event_handlers.js';
import ViewManager from './viewManager.js';
import { ReminderFeature } from './feature_reminder.js';
import { AdvancedRecurrenceFeature } from './feature_advanced_recurrence.js';
import { ShoppingListFeature } from './feature_shopping_list.js';
import { WorkFeature } from './feature_work.js';
import LoggingService from './loggingService.js';
import { DesktopNotificationsFeature } from './feature_desktop_notifications.js';
import * as uiRendering from './tasks_ui_rendering.js';
import { refreshTaskView } from './tasks_ui_rendering.js';
import * as ModalInteractions from './tasks_modal_interactions.js';

// NEW: Import our custom smart views feature!
import { CustomSmartViewsFeature } from './feature_custom_smart_views.js';

// --- Feature Handling ---
// This function determines which features are active for the Task Manager.
function isFeatureEnabled(featureName) {
    const features = {
        // Active Features
        reminderFeature: true,
        advancedRecurrence: true,
        desktopNotificationsFeature: true,
        shoppingListFeature: true,
        workFeature: true,
        userRoleFeature: true,
        debugMode: true,
        
        // NEW: Turn on our custom smart views feature!
        customSmartViewsFeature: true 
    };
    // If the feature isn't in the list, it defaults to false.
    return features[featureName] || false;
}

// --- Global Error Handling ---
let showCriticalErrorImported = (message, errorId) => {
    const fallbackErrorMsg = `CRITICAL ERROR (display): ${message}, ID: ${errorId}. UI for errors not yet loaded.`;
    console.error(fallbackErrorMsg);
    alert(fallbackErrorMsg);
};

window.onerror = function(message, source, lineno, colno, error) {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    LoggingService.critical(String(message), error || new Error(String(message)), {
        source, lineno, colno, errorId, type: 'window.onerror'
    });
    showCriticalErrorImported(`An unexpected error occurred. Please report ID: ${errorId}`, errorId);
    return true;
};

window.onunhandledrejection = function(event) {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    let errorReason = event.reason;
    if (!(errorReason instanceof Error)) {
        const reasonString = (typeof errorReason === 'object' && errorReason !== null) ?
                             JSON.stringify(errorReason) :
                             String(errorReason || 'Unknown promise rejection reason');
        errorReason = new Error(reasonString);
    }
    LoggingService.critical('Global unhandled promise rejection:', errorReason, {
        errorId, type: 'window.onunhandledrejection'
    });
    showCriticalErrorImported(`An operation failed unexpectedly. Please report ID: ${errorId}`, errorId);
    event.preventDefault();
};

// --- Main Application Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    document.body.style.visibility = 'visible';
    LoggingService.info("[TasksMain] Starting Task Manager application initialization...");
    
    // Phase 1: Initialize UI elements and core services
    uiRendering.initializeDOMElements();
    if (uiRendering.showCriticalError) {
        showCriticalErrorImported = uiRendering.showCriticalError;
    }
    
    // Phase 2: Load data from the local IndexedDB
    if (AppStore && AppStore.initializeStore) {
        await AppStore.initializeStore();
        LoggingService.info("[TasksMain] Initial data load from local storage complete.");
    } else {
        LoggingService.critical('[TasksMain] AppStore.initializeStore is not available. Cannot load data.', new Error('DataLoadFailed'));
        return;
    }

    // Phase 3: Initialize all feature modules relevant to the Task Manager
    window.AppFeatures = {
        LoggingService, EventBus, AppStore, ViewManager, ModalInteractions,
        ReminderFeature, AdvancedRecurrenceFeature,
        ShoppingListFeature,
        WorkFeature,
        DesktopNotificationsFeature,
        
        // NEW: Register the feature here so it gets started!
        CustomSmartViewsFeature, 
        
        isFeatureEnabled
    };
    
    uiRendering.initializeUiRenderingSubscriptions();
    setupEventListeners();

    for (const featureKey in window.AppFeatures) {
        if (window.AppFeatures.hasOwnProperty(featureKey) && typeof window.AppFeatures[featureKey]?.initialize === 'function') {
            try {
                LoggingService.debug(`[TasksMain] Initializing feature module: ${featureKey}`);
                window.AppFeatures[featureKey].initialize();
            } catch (e) {
                LoggingService.error(`[TasksMain] Error initializing feature ${featureKey}:`, e);
            }
        }
    }
    
    // Phase 4: Initial Render
    applyActiveFeatures();
    setFilter(ViewManager.getCurrentFilter());
    uiRendering.setSidebarMinimized(localStorage.getItem('sidebarState') === 'minimized');
    refreshTaskView();
    LoggingService.info("[TasksMain] Initial UI render complete.");
    
    LoggingService.info("---------------------------------------------------------");
    LoggingService.info("     LockieMedia Task Manager Initialization Complete ✓");
    LoggingService.info("---------------------------------------------------------");
});

// Expose our new local isFeatureEnabled globally for any modules that might need it
if (typeof window.isFeatureEnabled === 'undefined') {
    window.isFeatureEnabled = isFeatureEnabled;
}
if (typeof window.LoggingService === 'undefined') {
    window.LoggingService = LoggingService;
}