const axios = require('axios');
const db = require('./database');

const API_URL = 'http://localhost:8000';


// Function to register a user (returns true on success)
async function registerUser(userData) {
    try {
        await axios.post(`${API_URL}/users/register`, userData);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 400 && error.response.data.error.includes('already')) {
            return true;
        }
        console.error(`Registration failed for ${userData.username}:`, error.response ? error.response.data : error.message);
        return false;
    }
}

// Function to log in a user (returns the auth token)
async function loginUser(username, password) {
    try {
        const response = await axios.post(`${API_URL}/users/login`, { username, password });
        return response.data.token;
    } catch (error) {
        console.error(`Login failed for ${username}:`, error.response ? error.response.data : error.message);
        return null;
    }
}

// Function to reset the event state in the database
function resetEventState(availableSeats = 500) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("DELETE FROM Reservation WHERE partnerId LIKE 'test_user_%'", (err) => {
                 if (err) return reject(err);
            });
            db.run("UPDATE Event SET availableSeats = ?, version = 0 WHERE eventId = ?",
                   [availableSeats, "node-meetup-2025"],
                   function(err) {
                       if (err) return reject(err);
                       console.log(`\n---\nEvent reset to ${availableSeats} available seats.`);
                       resolve();
                   });
        });
    });
}

// --- Jest Test Suite ---

describe('TicketBoss API Concurrency Tests', () => {

    let userAToken;
    let userBToken;

    beforeAll(async () => {
        const userA = { username: 'test_user_A', password: 'password', firstName: 'A', lastName: 'Test', email: 'a@test.com' };
        const userB = { username: 'test_user_B', password: 'password', firstName: 'B', lastName: 'Test', email: 'b@test.com' };

        await registerUser(userA);
        await registerUser(userB);

        userAToken = await loginUser(userA.username, userA.password);
        userBToken = await loginUser(userB.username, userB.password);

        expect(userAToken).toBeTruthy();
        expect(userBToken).toBeTruthy();
    });

    // --- Test 1: Atomic Success (4 + 6 seats) ---
    test('should allow two concurrent valid bookings when seats are available', async () => {
        await resetEventState(400);

        const seatsA = 4;
        const seatsB = 6;
        const expectedFinalSeats = 400 - seatsA - seatsB; 

        const bookingA = axios.post(`${API_URL}/reservations`, { seats: seatsA }, {
            headers: { 'Authorization': `Bearer ${userAToken}` }
        });
        const bookingB = axios.post(`${API_URL}/reservations`, { seats: seatsB }, {
            headers: { 'Authorization': `Bearer ${userBToken}` }
        });

        const results = await Promise.allSettled([bookingA, bookingB]);

        console.log("Atomic success test results:", results.map(r => ({
            status: r.status,
            code: r.status === 'fulfilled' ? r.value.status : r.reason.response?.status,
            data: r.status === 'fulfilled' ? r.value.data : r.reason.response?.data
        })));

        expect(results[0].status).toBe('fulfilled');
        expect(results[0].value.status).toBe(201);
        expect(results[1].status).toBe('fulfilled');
        expect(results[1].value.status).toBe(201);

        const summaryResponse = await axios.get(`${API_URL}/reservations`);
        expect(summaryResponse.status).toBe(200);
        expect(summaryResponse.data.availableSeats).toBe(expectedFinalSeats);

        console.log(`Atomic success test finished. Final available seats: ${summaryResponse.data.availableSeats}`);
    });

    // --- Test 2: Oversell Prevention (6 + 4 seats, 8 available) ---
    test('should prevent overselling with concurrent requests exceeding availability', async () => {
        await resetEventState(8); 

        const seatsA = 6;
        const seatsB = 4;
        const expectedFinalSeatsIfAWins = 8 - seatsA; 
        const expectedFinalSeatsIfBWins = 8 - seatsB;

        const bookingA = axios.post(`${API_URL}/reservations`, { seats: seatsA }, {
            headers: { 'Authorization': `Bearer ${userAToken}` }
        });
        const bookingB = axios.post(`${API_URL}/reservations`, { seats: seatsB }, {
            headers: { 'Authorization': `Bearer ${userBToken}` }
        });

        let results;
        try {
            results = await Promise.all([bookingA, bookingB]);
        } catch (error) {
            results = await Promise.allSettled([bookingA, bookingB]);
        }

        const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : r.reason.response.status);

        console.log("Oversell test results:", results.map(r => ({
            status: r.status,
            code: r.status === 'fulfilled' ? r.value.status : r.reason.response?.status,
            data: r.status === 'fulfilled' ? r.value.data : r.reason.response?.data
        })));

        expect(statuses).toContain(201);
        expect(statuses).toContain(409);
        expect(statuses.length).toBe(2);

        const summaryResponse = await axios.get(`${API_URL}/reservations`);
        expect(summaryResponse.status).toBe(200);
        expect([expectedFinalSeatsIfAWins, expectedFinalSeatsIfBWins]).toContain(summaryResponse.data.availableSeats);

        console.log(`Oversell prevention test finished. Final available seats: ${summaryResponse.data.availableSeats}`);
    });

});