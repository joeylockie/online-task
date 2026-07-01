import AppStore from './store.js';
import EventBus from './eventBus.js';
import LoggingService from './loggingService.js';
import {
    settingsManageSmartViewsBtn, manageSmartViewsModal, closeManageSmartViewsModalBtn,
    closeManageSmartViewsSecondaryBtn, addNewSmartViewForm, newSmartViewNameInput,
    newSmartViewLabelInput, newSmartViewIconInput, existingSmartViewsList, renderCustomSmartViewButtons
} from './tasks_ui_rendering.js';

export const CustomSmartViewsFeature = {
    initialize: () => {
        // We turn this flag on in tasks_main.js
        if (!window.isFeatureEnabled || !window.isFeatureEnabled('customSmartViewsFeature')) {
            return;
        }
        LoggingService.debug('[CustomSmartViews] Initializing custom smart views feature...');
        bindEvents();
        refreshCustomViewsUI();
    }
};

function bindEvents() {
    // 1. Open the Modal when clicking the button in settings
    if (settingsManageSmartViewsBtn) {
        settingsManageSmartViewsBtn.addEventListener('click', () => {
            manageSmartViewsModal.classList.remove('hidden');
            // Small delay for animation
            setTimeout(() => {
                document.getElementById('modalDialogManageSmartViews').classList.remove('scale-95', 'opacity-0');
                document.getElementById('modalDialogManageSmartViews').classList.add('scale-100', 'opacity-100');
            }, 10);
            refreshCustomViewsUI();
        });
    }

    // 2. Handle Closing the Modal
    const closeModal = () => {
        document.getElementById('modalDialogManageSmartViews').classList.remove('scale-100', 'opacity-100');
        document.getElementById('modalDialogManageSmartViews').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            manageSmartViewsModal.classList.add('hidden');
        }, 300);
    };

    if (closeManageSmartViewsModalBtn) closeManageSmartViewsModalBtn.addEventListener('click', closeModal);
    if (closeManageSmartViewsSecondaryBtn) closeManageSmartViewsSecondaryBtn.addEventListener('click', closeModal);

    // 3. Handle Submitting the "Add New View" form
    if (addNewSmartViewForm) {
        addNewSmartViewForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop the page from reloading
            const name = newSmartViewNameInput.value.trim();
            const label = newSmartViewLabelInput.value.trim().toLowerCase(); // Labels are lowercase
            
            // NEW: Get the selected icon from the dropdown
            const icon = newSmartViewIconInput ? newSmartViewIconInput.value : 'fas fa-hashtag';
            
            if (!name || !label) {
                EventBus.publish('displayUserMessage', { text: 'Name and Target Label are required.', type: 'error' });
                return;
            }

            // Get current preferences
            const prefs = AppStore.getUserPreferences();
            const currentViews = prefs.customSmartViews || [];
            
            // Prevent duplicates by label
            if (currentViews.some(v => v.label === label)) {
                EventBus.publish('displayUserMessage', { text: 'A custom view for this label already exists.', type: 'error' });
                return;
            }

            // Add the new view (now including the chosen icon!)
            currentViews.push({ id: Date.now().toString(), name, label, icon });
            
            try {
                // Save it back to the server via the AppStore
                await AppStore.saveUserPreferences({ ...prefs, customSmartViews: currentViews });
                
                // Clear the form
                newSmartViewNameInput.value = '';
                newSmartViewLabelInput.value = '';
                if (newSmartViewIconInput) newSmartViewIconInput.selectedIndex = 0; // Reset dropdown to top option
                
                EventBus.publish('displayUserMessage', { text: 'Smart view added successfully.', type: 'success' });
                refreshCustomViewsUI();
            } catch (error) {
                LoggingService.error('[CustomSmartViews] Error saving new view', error);
            }
        });
    }

    // 4. Listen for changes in preferences (e.g. initial load) and redraw
    EventBus.subscribe('userPreferencesChanged', () => {
        refreshCustomViewsUI();
    });
}

// Handle clicking the Trash Can icon to delete a view
function deleteCustomView(viewId) {
    const prefs = AppStore.getUserPreferences();
    const currentViews = prefs.customSmartViews || [];
    
    // Filter out the one we want to delete
    const newViews = currentViews.filter(v => v.id !== viewId);
    
    // Save updated list
    AppStore.saveUserPreferences({ ...prefs, customSmartViews: newViews })
        .then(() => {
            EventBus.publish('displayUserMessage', { text: 'Smart view deleted.', type: 'success' });
            // The 'userPreferencesChanged' event will auto-trigger a UI refresh
        })
        .catch(err => {
            LoggingService.error('[CustomSmartViews] Error deleting view', err);
        });
}

// Read from preferences and draw the UI
function refreshCustomViewsUI() {
    const prefs = AppStore.getUserPreferences();
    const customViews = prefs.customSmartViews || [];

    // 1. Update the list inside the pop-up modal
    if (existingSmartViewsList) {
        existingSmartViewsList.innerHTML = '';
        if (customViews.length === 0) {
            existingSmartViewsList.innerHTML = '<li class="text-sm text-slate-500 italic">No custom views created yet.</li>';
        } else {
            customViews.forEach(view => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center p-2 mb-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg';
                
                const iconClass = view.icon || 'fas fa-hashtag'; // Fallback
                
                li.innerHTML = `
                    <div class="flex items-center gap-3">
                        <i class="${iconClass} text-slate-500 dark:text-slate-400 text-lg w-5 text-center"></i>
                        <div class="flex flex-col">
                            <span class="font-medium text-slate-800 dark:text-slate-200">${view.name}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Target label: <strong>${view.label}</strong></span>
                        </div>
                    </div>
                    <button class="delete-view-btn text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" aria-label="Delete view" data-id="${view.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                existingSmartViewsList.appendChild(li);
            });

            // Make the delete buttons work
            existingSmartViewsList.querySelectorAll('.delete-view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const viewId = e.currentTarget.dataset.id;
                    deleteCustomView(viewId);
                });
            });
        }
    }

    // 2. Call the UI Rendering function to draw the buttons on the sidebar
    if (typeof renderCustomSmartViewButtons === 'function') {
        renderCustomSmartViewButtons(customViews);
    }
}