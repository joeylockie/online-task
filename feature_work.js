// feature_work.js
// Manages the Work Feature (View).

import LoggingService from './loggingService.js';

/**
 * Initializes the Work Feature.
 */
function initialize() {
    const functionName = 'initialize (WorkFeature)';
    LoggingService.info('[WorkFeature] Initialized.', { functionName });
}

/**
 * Updates the visibility of UI elements related to the Work feature
 * based on the feature flag.
 */
function updateUIVisibility() {
    const functionName = 'updateUIVisibility (WorkFeature)';
    if (typeof window.isFeatureEnabled !== 'function') {
        LoggingService.error("[WorkFeature] isFeatureEnabled function not available.", new Error("DependencyMissing"), { functionName });
        return;
    }
    const isActuallyEnabled = window.isFeatureEnabled('workFeature');
    
    // The button's visibility is controlled by the .work-feature-element class
    document.querySelectorAll('.work-feature-element').forEach(el => el.classList.toggle('hidden', !isActuallyEnabled));

    LoggingService.info(`[WorkFeature] UI Visibility set based on flag: ${isActuallyEnabled}`, { functionName, isEnabled: isActuallyEnabled });
}

export const WorkFeature = {
    initialize,
    updateUIVisibility
};