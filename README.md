# 🎫 TicketBoss: Event Ticketing API

## 🧠 Summary
  • TicketBoss is a secure event ticketing API designed for external partners to reserve seats in real-time for the 500-seat Node.js Meet-up. <br><br>
	•	The application ensures zero overselling by utilizing Atomic Database Updates—a superior concurrency technique—which guarantees an instant accept or deny response for every booking request. <br><br>	•	Furthermore, the API is secured using JWT authentication for all partner actions. <br><br>

## 🛠️ 1. Setup Instructions

### Installation

#### 1️⃣ Clone the repository
```bash
git clone https://github.com/your-username/TicketBoss-Powerplay.git
cd TicketBoss-Powerplay
```
#### 2️⃣ Install dependencies

```bash
npm init -y
```

```bash
npm install express sqlite
```

```bash
npm install nodemon --save-dev
```

```bash
npm install bcryptjs jsonwebtoken
```

```bash
npm install jest axios --save-dev
```

#### 3️⃣ Run the application
```bash
npm run dev
```
The server will take user to login page:
👉 http://localhost:8000

## 2. API Documentation 📋

### 🧑‍💻 A. Authentication Endpoints

| Endpoint | Method | Description | Request Body | Response (200/201) |
|-----------|---------|--------------|---------------|---------------------|
| `/users/register` | `POST` | Creates a new user account. | `{ "firstName": "...", "username": "...", "password": "..." }` | **201 Created** |
| `/users/login` | `POST` | Authenticates the user and returns a JWT token. | `{ "username": "...", "password": "..." }` | **200 OK** + `{ "token": "..." }` |
| `/users/logout` | `POST` | Client-side logout (token deletion). | None | **200 OK** |


***

### Event Bootstrap (Startup Seeding)

The application fulfills Event Bootstrap (Startup Seeding) by seeding the initial event data automatically. The **`database.js`** file handles this process on the first run, ensuring the `Event` table contains the required `node-meetup-2025` data with 500 total and available seats. If the event already exists, the seeding process is skipped.

***

### 🎟️ B. Core Ticketing Endpoints

| Endpoint | Method | Security | Description | Parameters / Body | Successful Response | Error Responses |
|-----------|---------|-----------|--------------|--------------------|----------------------|------------------|
| `/reservations` | `GET` | Public | Returns current seat availability. | None | **200 OK** | 404 Not Found |
| `/reservations` | `POST` | Token Required | Reserves seats for the authenticated user (max 10 seats per request). | `{ "seats": 3 }` | **201 Created** + Reservation JSON | 400 Bad Request (Invalid seat count), 409 Conflict (Not enough seats left) |
| `/reservations/:reservationId` | `DELETE` | Token Required | Cancels a reservation (only by the creator). Returns seats to pool. | `:reservationId` (in URL) | **204 No Content** | 404 Not Found (Invalid ID or unauthorized user) |
| `/my-reservations` | `GET` | Token Required | Fetch all confirmed reservations of the logged-in user. | None | **200 OK** + User’s reservations | — |

---


---


## ⚙️ 3. Technical Decisions & Architecture

### C. Technical Decisions

| Decision | Explanation |
| :--- | :--- |
| **Atomic Updates for Concurrent Booking Requests** |  We implemented **Atomic Updates** using SQLite's transactional `UPDATE ... WHERE availableSeats >= ?` logic. This technique is superior to traditional optimistic locking for ticketing because it guarantees both **accuracy and speed** without forcing clients to retry.<br><br>When multiple users book concurrently: <br><br> (1) **Both requests succeed instantly** if total seats are available. <br><br>(2) **Overselling is impossible:** If only 8 seats are left, the first successful booking (e.g., User A for 6 seats) will consume the seats, causing the second booking (User B for 3 seats) to instantly fail with a **409 Conflict** because the conditional check ($2 \not\ge 3$) fails. This fulfills the "instant accept/deny" requirement. <br><br> (3) **Overselling is impossible:** If only 8 seats are left, the first successful booking (e.g., User A for 6 seats) will consume the seats, causing the second booking (User B for 3 seats) to instantly fail with a **409 Conflict** because the conditional check ($2 \not\ge 3$) fails. This fulfills the "instant accept/deny" requirement. |
| **Node.js/Express** | Chosen to meet the explicit project structure requirement. |
| **Storage Method** | **SQLite3** is used for persistence. All database operations are wrapped in `db.run` or `db.serialize` to ensure thread safety and transactionality. |
| **Authentication** | **JSON Web Tokens (JWT)** are used for stateless authentication. This allows the system to easily scale without managing server-side sessions. |
| **Security Assumption** | The `partnerId` required by the original API is derived from the verified JWT token (`req.user.username`). This eliminates security risks associated with users manually providing their identity. |

## 🧪 C. Testing

The application includes a testing file (api.test.js) using Jest and Axios to prove the concurrency logic:

Atomic Success Test: Verifies two concurrent valid bookings (4 and 6 seats) both succeed.

Oversell Prevention Test: Verifies that when capacity is exceeded (10 seats requested, 8 available), only one transaction succeeds, and the other is correctly rejected with a 409 Conflict.

Run tests using the below command when the server is Running (Use Another Terminal):

```bash
npm test
```

Command to Reset the Database:

```bash
 node reset-db.js   
 ```

⸻

Built using Node.js, Express, SQLite, JWT, and bcrypt.















