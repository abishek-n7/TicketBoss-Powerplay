const sqlite3 = require('sqlite3').verbose();

const DBSOURCE = "ticketboss.db";

// SQL statement to create the Event table
const SQL_CREATE_EVENT_TABLE = `
    CREATE TABLE IF NOT EXISTS Event (
        eventId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        totalSeats INTEGER NOT NULL,
        availableSeats INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 0
    );
`;

// SQL statement to create the Reservation table
const SQL_CREATE_RESERVATION_TABLE = `
    CREATE TABLE IF NOT EXISTS Reservation (
        reservationId TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        partnerId TEXT NOT NULL,
        seats INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        FOREIGN KEY (eventId) REFERENCES Event(eventId)
    );
`;

const SQL_SEED_EVENT = `
    INSERT OR IGNORE INTO Event (eventId, name, totalSeats, availableSeats, version)
    VALUES (?, ?, ?, ?, ?);
`;

const SEED_DATA = [
    "node-meetup-2025", 
    "Node.js Meet-up", 
    500, 
    500, 
    0
];

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        
        db.serialize(() => {
            db.run(SQL_CREATE_EVENT_TABLE, (err) => {
                if (err) {
                    console.error("Error creating Event table:", err.message);
                } else {
                    console.log("Event table is ready.");
                }
            });
            
            db.run(SQL_CREATE_RESERVATION_TABLE, (err) => {
                if (err) {
                    console.error("Error creating Reservation table:", err.message);
                } else {
                    console.log("Reservation table is ready.");
                }
            });

            db.run(SQL_SEED_EVENT, SEED_DATA, function(err) {
                if (err) {
                    console.error("Error seeding event:", err.message);
                } else if (this.changes > 0) {
                    console.log('Database seeded with "Node.js Meet-up" event.');
                } else {
                    console.log('Event "node-meetup-2025" already exists.');
                }
            });
        });
    }
});

module.exports = db;
