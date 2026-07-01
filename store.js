// store.js
import EventBus from './eventBus.js';
import LoggingService from './loggingService.js';
import db from './database.js';

// --- Internal State Variables ---
let _tasks = [];
let _userPreferences = {};
let _userProfile = {};
let _uniqueLabels = [];

// --- Cross-Tab Sync ---
const syncChannel = new BroadcastChannel('lockiemedia_sync');
syncChannel.onmessage = (event) => {
    if (event.data.type === 'DATA_UPDATED') {
        LoggingService.info('[Store] Detected data update from another tab. Refreshing...', { functionName: 'syncChannel' });
        AppStore.initializeStore(); 
    }
};

// --- Private Helper Functions ---
function _publish(eventName, data) {
    if (EventBus && typeof EventBus.publish === 'function') {
        EventBus.publish(eventName, data);
    }
}

function _updateUniqueLabels() {
    const labels = new Set();
    _tasks.forEach(task => {
        if (task.label && task.label.trim() !== '') {
            labels.add(task.label.trim());
        }
    });
    _uniqueLabels = Array.from(labels).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    _publish('labelsChanged', [..._uniqueLabels]);
}

const AppStore = {
    // --- GETTERS ---
    getTasks: () => [..._tasks],
    getUniqueLabels: () => [..._uniqueLabels],
    getUserPreferences: () => ({ ..._userPreferences }),
    getUserProfile: () => ({ ..._userProfile }),

    // --- SETTERS ---
    setTasks: (newTasksArray) => {
        _tasks = newTasksArray;
        _updateUniqueLabels();
        _publish('tasksChanged', [..._tasks]);
    },
    setUserPreferences: (newPreferences) => {
        _userPreferences = newPreferences;
        _publish('userPreferencesChanged', { ..._userPreferences });
    },
    setUserProfile: (newProfile) => {
       _userProfile = newProfile;
       _publish('userProfileChanged', { ..._userProfile });
    },

    // --- DATA OPERATIONS (Local DB) ---
    saveUserPreferences: async (newPreferences) => {
        try {
            await db.userPreferences.put({ id: 1, ...newPreferences });
            AppStore.setUserPreferences(newPreferences);
            syncChannel.postMessage({ type: 'DATA_UPDATED' });
        } catch (error) {
            LoggingService.error('[Store] Failed to save UserPreferences to local DB.', error);
        }
    },

    saveUserProfile: async (newProfile) => {
        try {
            await db.userProfile.put({ id: 1, ...newProfile });
            AppStore.setUserProfile(newProfile);
            syncChannel.postMessage({ type: 'DATA_UPDATED' });
        } catch (error) {
            LoggingService.error('[Store] Failed to save UserProfile to local DB.', error);
        }
    },

    // --- INITIALIZATION (From Local DB) ---
    initializeStore: async () => {
        const functionName = 'initializeStore (AppStore)';
        LoggingService.info('[AppStore] Initializing store from Local IndexedDB...', { functionName });

        try {
            // Load data from Dexie
            const tasksData = await db.tasks.toArray();
            const prefsData = await db.userPreferences.get(1);
            const profileData = await db.userProfile.get(1);
            
            _tasks = tasksData || [];
            _updateUniqueLabels(); 
            
            _userProfile = profileData || { displayName: 'User' };
            _userPreferences = prefsData || {};

            LoggingService.info("[AppStore] Store initialized with data from Local DB.", { functionName });

            // Publish events so the UI updates
            _publish('storeInitialized');
            _publish('tasksChanged', [..._tasks]);
            _publish('userProfileChanged', { ..._userProfile });
            _publish('userPreferencesChanged', { ..._userPreferences });

        } catch (error) {
            LoggingService.critical('[AppStore] Could not load data from Local DB.', error, { functionName });
            _publish('displayUserMessage', { text: 'Fatal: Cannot load application data from local storage.', type: 'error' });
        }
    }
};

export default AppStore;