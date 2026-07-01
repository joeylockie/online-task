// database.js
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs'; // Use local path if you have downloaded it

const db = new Dexie('LockieMediaTaskManager');

// Define the database schema. 
// Only index the fields you plan to search or filter by.
db.version(1).stores({
    tasks: '++id, completed, dueDate, priority, label',
    // You can add your other stores here later (habits, calendar_events, etc.)
    userPreferences: 'id',
    userProfile: 'id'
});

export default db;