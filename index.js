const express = require('express');
const db = require('./database.js');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const authenticateToken = require('./authMiddleware.js'); 

const app = express();
app.use(express.json());
app.use(express.static('public'));

const HTTP_PORT = 8000;
const JWT_SECRET = "your-super-secret-key"; 

db.serialize(() => {
    const SQL_CREATE_USER_TABLE = `
        CREATE TABLE IF NOT EXISTS User (
            userId INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            passwordHash TEXT,
            firstName TEXT,
            lastName TEXT,
            email TEXT UNIQUE
        );
    `;
    db.run(SQL_CREATE_USER_TABLE, (err) => {
        if (err) {
            console.error("Error creating User table:", err.message);
        } else {
            console.log("User table is ready.");
        }
    });
});


app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(HTTP_PORT, () => {
    console.log(`Server running on http://localhost:${HTTP_PORT}`);
});

// --- AUTHENTICATION ENDPOINTS ---

 // NEW: User Registration 
 
app.post('/users/register', async (req, res) => {
    const { firstName, lastName, email, username, password } = req.body;
    if (!firstName || !lastName || !email || !username || !password) {
        return res.status(400).json({ "error": "All fields are required" });
    }

    try {
        const checkUserSql = "SELECT * FROM User WHERE username = ? OR email = ?";
        db.get(checkUserSql, [username, email], async (err, row) => {
            if (err) return res.status(500).json({ "error": err.message });
            if (row) {
                const error = row.username === username ? "Username already taken" : "Email already in use";
                return res.status(400).json({ "error": error });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const insertSql = "INSERT INTO User (firstName, lastName, email, username, passwordHash) VALUES (?,?,?,?,?)";
            db.run(insertSql, [firstName, lastName, email, username, passwordHash], function(err) {
                if (err) return res.status(500).json({ "error": err.message });
                res.status(201).json({ "message": "User registered successfully", "userId": this.lastID });
            });
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});


// NEW: User Login 
 
app.post('/users/login', (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT * FROM User WHERE username = ?";
    db.get(sql, [username], async (err, user) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!user) return res.status(400).json({ "error": "Invalid username or password" });

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return res.status(400).json({ "error": "Invalid username or password" });

        const token = jwt.sign(
            { userId: user.userId, username: user.username }, 
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.status(200).json({ "message": "Login successful", "token": token });
    });
});

app.post('/users/logout', (req, res) => {
    res.status(200).json({ "message": "Logged out successfully. Please delete your token." });
});


// --- SECURE RESERVATION API ENDPOINTS ---

/*
   Event Summary 
   Endpoint: GET /reservations/
*/
app.get('/reservations', (req, res) => {
    const sql = "SELECT * FROM Event WHERE eventId = ?";
    db.get(sql, ["node-meetup-2025"], (err, row) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!row) return res.status(404).json({ "error": "Event not found" });

        const reservationCount = row.totalSeats - row.availableSeats;
        res.status(200).json({
            eventId: row.eventId,
            name: row.name,
            totalSeats: row.totalSeats,
            availableSeats: row.availableSeats,
            reservationCount: reservationCount,
        });
    });
});

/*
   Get My Reservations 
   Endpoint: GET /my-reservations/
*/
app.get('/my-reservations', authenticateToken, (req, res) => {
    
    const partnerId = req.user.username;
    
    const sql = "SELECT * FROM Reservation WHERE partnerId = ? AND status = 'confirmed'";
    db.all(sql, [partnerId], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.status(200).json(rows); 
    });
});


/*
   Reserve Seats 
   Endpoint: POST /reservations/
 */
app.post('/reservations', authenticateToken, (req, res) => {

    const { seats } = req.body;
    const partnerId = req.user.username; 
    const eventId = "node-meetup-2025";

    if (!seats || seats <= 0 || seats > 10) {
        return res.status(400).json({ "error": "Seats must be between 1 and 10" });
    }

    db.serialize(() => {
        const sqlUpdate = `
            UPDATE Event
            SET 
                availableSeats = availableSeats - ?,
                version = version + 1
            WHERE 
                eventId = ? AND availableSeats >= ?;
        `;
        db.run(sqlUpdate, [seats, eventId, seats], function(err) {

            if (err) return res.status(500).json({ "error": err.message });
            if (this.changes === 0) {
                return res.status(409).json({ "error": "Not enough seats left" });
            }

            const newReservationId = crypto.randomUUID();
            const sqlInsert = `
                INSERT INTO Reservation (reservationId, eventId, partnerId, seats, status)
                VALUES (?, ?, ?, ?, 'confirmed');
            `;

            db.run(sqlInsert, [newReservationId, eventId, partnerId, seats], (err) => {
                if (err) return res.status(500).json({ "error": err.message });
                res.status(201).json({
                    reservationId: newReservationId,
                    seats: seats,
                    status: 'confirmed'
                });
            });
        });
    });
});

/*
   Cancel Reservation
   Endpoint: DELETE /reservations/:reservationId
*/
app.delete('/reservations/:reservationId', authenticateToken, (req, res) => {
    const { reservationId } = req.params;
    const partnerId = req.user.username; 

    db.serialize(() => {
        const sqlGet = "SELECT * FROM Reservation WHERE reservationId = ? AND partnerId = ? AND status = 'confirmed'";
        
        db.get(sqlGet, [reservationId, partnerId], (err, row) => {
            if (err) return res.status(500).json({ "error": err.message });
            
            if (!row) {
                return res.status(404).json({ "error": "Reservation not found or you do not have permission to cancel it" });
            }

            const seatsToReturn = row.seats;
            const eventId = row.eventId;

            const sqlUpdateEvent = `
                UPDATE Event
                SET availableSeats = availableSeats + ?
                WHERE eventId = ?;
            `;
            db.run(sqlUpdateEvent, [seatsToReturn, eventId], (err) => {
                if (err) return res.status(500).json({ "error": err.message });

                const sqlUpdateReservation = "UPDATE Reservation SET status = 'cancelled' WHERE reservationId = ?";
                db.run(sqlUpdateReservation, [reservationId], (err) => {
                    if (err) return res.status(500).json({ "error": err.message });
                    res.status(204).send();
                });
            });
        });
    });
});