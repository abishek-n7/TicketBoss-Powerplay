const db = require('./database.js');

console.log('Attempting to reset the database...');

const sqlResetEvent = `
    UPDATE Event
    SET
        availableSeats = 500,
        totalSeats = 500,
        version = 0
    WHERE
        eventId = 'node-meetup-2025';
`;

const sqlDeleteReservations = `
    DELETE FROM Reservation;
`;

db.serialize(() => {
    
    db.run(sqlResetEvent, function(err) {
        if (err) {
            console.error("Error resetting event:", err.message);
        } else if (this.changes > 0) {
            console.log('Event "node-meetup-2025" successfully reset to 500 seats.');
        } else {
            console.log('Event "node-meetup-2025" not found or already reset.');
        }
    });

    db.run(sqlDeleteReservations, function(err) {
        if (err) {
            console.error("Error deleting reservations:", err.message);
        } else {
            console.log(`Successfully deleted ${this.changes} reservations.`);
        }
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database reset complete. Connection closed.');
        }
    });
});