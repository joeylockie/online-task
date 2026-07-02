// app_logic.js
// This file now primarily contains theme management.
// Other core logic has been moved to services (store.js, utils.js, taskService.js, projectService.js, viewManager.js, bulkActionService.js).

// --- Theme Management ---
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (localStorage.getItem('theme') !== (event.matches ? 'dark' : 'light')) {
        if (event.matches) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }
});