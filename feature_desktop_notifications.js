// feature_desktop_notifications.js
// Manages the Desktop Notifications Feature settings.
// Now strictly manages SERVER-SIDE notification settings (Extension).

import LoggingService from './loggingService.js';
import EventBus from './eventBus.js';
import AppStore from './store.js';
// Import the Central Service to use its "Test" function
import { CentralNotificationService } from './centralNotificationService.js';

// --- DOM Element References ---
let settingsDesktopNotificationsBtnEl;
let enableNotificationsToggleEl;
let testPhoneNotificationBtnEl;
let notifyOnTaskDueToggleEl;
let notifyMinutesBeforeDueEl;
let testNotificationBtnEl;
let notificationPermissionStatusTextEl;
let homeAssistantWebhookInputEl;

// --- Default Settings ---
const defaultDesktopNotificationSettings = {
    notificationsEnabled: false,
    notifyOnTaskDue: true,
    notifyMinutesBeforeDue: 5,
};

// --- Internal State ---
let currentSettings = { ...defaultDesktopNotificationSettings };

// --- Private Helper Functions ---

function _loadSettings() {
    const functionName = '_loadSettings (DesktopNotificationsFeature)';
    if (!AppStore || typeof AppStore.getUserPreferences !== 'function') {
        return;
    }
    try {
        const allUserPreferences = AppStore.getUserPreferences();
        const storedNotificationSettings = allUserPreferences.taskNotifications;

        if (storedNotificationSettings && typeof storedNotificationSettings === 'object') {
            currentSettings = { ...defaultDesktopNotificationSettings, ...storedNotificationSettings };
        } else {
            currentSettings = { ...defaultDesktopNotificationSettings };
        }
    } catch (error) {
        LoggingService.error('[DesktopNotificationsFeature] Error loading settings.', error, { functionName });
    }
}

async function _saveSettings() {
    const functionName = '_saveSettings (DesktopNotificationsFeature)';
    if (!AppStore || typeof AppStore.setUserPreferences !== 'function') {
        return;
    }
    try {
        const prefs = AppStore.getUserPreferences();
        await AppStore.saveUserPreferences({ ...prefs, taskNotifications: { ...currentSettings } });
        LoggingService.info('[DesktopNotificationsFeature] Settings saved.', { functionName, savedSettings: currentSettings });
    } catch (error) {
        LoggingService.error('[DesktopNotificationsFeature] Error saving settings.', error, { functionName });
    }
}

function _updateSettingsUI() {
    const functionName = '_updateSettingsUI';
    
    // Refresh Elements
    if (!enableNotificationsToggleEl) enableNotificationsToggleEl = document.getElementById('enableNotificationsToggle');
    if (!notifyOnTaskDueToggleEl) notifyOnTaskDueToggleEl = document.getElementById('notifyOnTaskDueToggle');
    if (!notifyMinutesBeforeDueEl) notifyMinutesBeforeDueEl = document.getElementById('notifyMinutesBeforeDue');
    if (!notificationPermissionStatusTextEl) notificationPermissionStatusTextEl = document.getElementById('notificationPermissionStatusText');
    if (!testNotificationBtnEl) testNotificationBtnEl = document.getElementById('testNotificationBtn');
    if (!homeAssistantWebhookInputEl) homeAssistantWebhookInputEl = document.getElementById('homeAssistantWebhookInput');

    // Update Text to reflect Server/Extension control
    if (notificationPermissionStatusTextEl) {
        notificationPermissionStatusTextEl.innerHTML = `Controls <span class="font-medium text-blue-400">Lockie Extension</span> & Phone.`;
    }

    // Update Toggles (No permission checks anymore, just settings)
    if (enableNotificationsToggleEl) {
        enableNotificationsToggleEl.checked = currentSettings.notificationsEnabled;
    }

    const controlsShouldBeDisabled = !currentSettings.notificationsEnabled;

    if (notifyOnTaskDueToggleEl) {
        notifyOnTaskDueToggleEl.checked = currentSettings.notifyOnTaskDue;
        notifyOnTaskDueToggleEl.disabled = controlsShouldBeDisabled;
    }
    if (notifyMinutesBeforeDueEl) {
        notifyMinutesBeforeDueEl.value = currentSettings.notifyMinutesBeforeDue;
        notifyMinutesBeforeDueEl.disabled = controlsShouldBeDisabled || !currentSettings.notifyOnTaskDue;
    }
    if (testNotificationBtnEl) {
        testNotificationBtnEl.disabled = controlsShouldBeDisabled;
    }
    if (homeAssistantWebhookInputEl) {
        homeAssistantWebhookInputEl.value = currentSettings.homeAssistantWebhook || '';
    }
}

function initialize() {
    const functionName = 'initialize (DesktopNotificationsFeature)';
    
    if (!document.getElementById('settingsModal')) return;
    
    _loadSettings();

    settingsDesktopNotificationsBtnEl = document.getElementById('settingsManageNotificationsBtn');
    enableNotificationsToggleEl = document.getElementById('enableNotificationsToggle');
    notifyOnTaskDueToggleEl = document.getElementById('notifyOnTaskDueToggle');
    notifyMinutesBeforeDueEl = document.getElementById('notifyMinutesBeforeDue');
    testNotificationBtnEl = document.getElementById('testNotificationBtn');
    homeAssistantWebhookInputEl = document.getElementById('homeAssistantWebhookInput');
    notificationPermissionStatusTextEl = document.getElementById('notificationPermissionStatusText');
    testPhoneNotificationBtnEl = document.getElementById('testPhoneNotificationBtn');

    // 1. Master Toggle (Just saves true/false now)
    if (enableNotificationsToggleEl) {
        enableNotificationsToggleEl.addEventListener('change', async (event) => {
            currentSettings.notificationsEnabled = event.target.checked;
            await _saveSettings();
            _updateSettingsUI();
        });
    }

    // 2. Test Phone Button (Stays the same - calls Webhook endpoint)
    if (testPhoneNotificationBtnEl) {
        testPhoneNotificationBtnEl.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/notifications/test-webhook', { method: 'POST' });
                const data = await response.json();
                if (response.ok && data.success) {
                    EventBus.publish('displayUserMessage', { text: 'Phone notification sent!', type: 'success' });
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            } catch (error) {
                EventBus.publish('displayUserMessage', { text: `Failed: ${error.message}`, type: 'error' });
            }
        });
    }
    
    // 3. Other Toggles
    if (notifyOnTaskDueToggleEl) {
        notifyOnTaskDueToggleEl.addEventListener('change', async (event) => {
            currentSettings.notifyOnTaskDue = event.target.checked;
            await _saveSettings();
            _updateSettingsUI();
        });
    }

    if (notifyMinutesBeforeDueEl) {
        notifyMinutesBeforeDueEl.addEventListener('change', async (event) => {
            currentSettings.notifyMinutesBeforeDue = parseInt(event.target.value, 10) || 0;
            await _saveSettings();
            _updateSettingsUI();
        });
    }
    if (homeAssistantWebhookInputEl) {
        homeAssistantWebhookInputEl.addEventListener('change', async (event) => {
            currentSettings.homeAssistantWebhook = event.target.value.trim();
            await _saveSettings();
        });
    }

    // 4. Test Desktop Button (UPDATED: Calls Server via Central Service)
    if (testNotificationBtnEl) {
        testNotificationBtnEl.addEventListener('click', () => {
            LoggingService.info('[DesktopNotificationsFeature] Test button clicked. Calling Server...');
            CentralNotificationService.fireTestNotification();
            EventBus.publish('displayUserMessage', { text: 'Server signal sent to Extension.', type: 'info' });
        });
    }

    // Listen for preference changes from other tabs
    EventBus.subscribe('userPreferencesChanged', (allPreferences) => {
        if (allPreferences && allPreferences.taskNotifications) {
            currentSettings = { ...defaultDesktopNotificationSettings, ...allPreferences.taskNotifications };
            _updateSettingsUI();
        }
    });

    LoggingService.info('[DesktopNotificationsFeature] Initialized (Server Mode).', { functionName });
}

function updateUIVisibility() {
    // Always show the button if the feature is "enabled" in the code, 
    // even if the user has toggled notifications off.
    const isActuallyEnabled = window.isFeatureEnabled('desktopNotificationsFeature');
    
    if (!settingsDesktopNotificationsBtnEl) settingsDesktopNotificationsBtnEl = document.getElementById('settingsManageNotificationsBtn');

    if (settingsDesktopNotificationsBtnEl) {
        settingsDesktopNotificationsBtnEl.classList.toggle('hidden', !isActuallyEnabled);
    }

    if (isActuallyEnabled) {
        _loadSettings();
        _updateSettingsUI();
    }
}

function refreshSettingsUIDisplay() {
    _loadSettings();
    _updateSettingsUI();
}

export const DesktopNotificationsFeature = {
    initialize,
    updateUIVisibility,
    refreshSettingsUIDisplay
};