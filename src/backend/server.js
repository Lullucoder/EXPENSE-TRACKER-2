// src/backend/server.js

// Load environment variables from .env in this directory
// Ensure path.resolve(__dirname, '.env') is correctly closed
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') }); // Added closing parenthesis for resolve if missing

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For session tokens (JWT)

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10; // Cost factor for bcrypt hashing
const jwtSecret = process.env.JWT_SECRET; // Get JWT secret from env

// --- Database Setup ---
const connectionString = process.env.DATABASE_URL;

// Check connectionString and jwtSecret
if (!connectionString) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
    console.error("Ensure the variable is set in your deployment environment (Render)");
    console.error("or you have a .env file in 'src/backend/' for local development.");
    process.exit(1);
}
if (!jwtSecret) {
    console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
    console.error("Ensure the variable is set in your deployment environment (Render)");
    console.error("or you have a .env file in 'src/backend/' for local development.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    // ssl: { rejectUnauthorized: false } // Uncomment if needed
});

// Async function to initialize DB
async function initializeDatabase() {
    let client; // Declared here to be accessible in finally
    try { // Ensure try block is present
        client = await pool.connect();
        console.log("Connected to the PostgreSQL database via pool.");
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                date DATE NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE -- Added FK directly here for simplicity if table users exists
            );
        `);
         await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
         `);
         // Add user_id column and constraint separately if tables might be created out of order or modified later
          try {
             await client.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id INTEGER');
             await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'expenses_user_id_fkey' AND conrelid = 'expenses'::regclass
                    ) THEN
                        ALTER TABLE expenses
                        ADD CONSTRAINT expenses_user_id_fkey
                        FOREIGN KEY (user_id) REFERENCES users(user_id)
                        ON DELETE CASCADE;
                    END IF;
                END
                $$;
             `);
             await client.query('CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses (user_id)');
         } catch (alterError) {
             // Ignore errors if column/constraint already exists from initial CREATE TABLE
             // console.warn("Alter table warning (might be expected if run before):", alterError.message);
         }

        console.log("Users and Expenses tables checked/created successfully.");
    } catch (err) { // Added catch block
        console.error("Error initializing database:", err.stack);
    } finally { // Correct finally block
        if (client) {
            client.release();
            console.log("Initial database client released.");
        }
    }
} // Added closing brace for function

initializeDatabase(); // Run initialization on start

// --- Middleware ---
app.use(express.json()); // Parse JSON bodies

// Serve static files from the 'src/frontend' directory
const frontendPath = path.join(__dirname, '../frontend');
console.log(`Serving static files from: ${frontendPath}`);
app.use(express.static(frontendPath));

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.log('Auth Error: No token provided');
        return res.status(401).json({ error: 'Authentication token required' }); // 401 Unauthorized
    }

    jwt.verify(token, jwtSecret, (err, userPayload) => { // Correct parenthesis for callback
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ error: 'Token is invalid or expired' }); // 403 Forbidden
        }
        // Add user payload (containing userId) to the request object
        req.user = userPayload; // userPayload should contain { userId: ..., username: ... }
        console.log(`User Authenticated: ID=${req.user.userId}`); // Log authenticated user ID
        next(); // Proceed to the next middleware or route handler
    }); // Correct closing parenthesis and semicolon
}; // Added closing brace for function


// --- API Routes ---

// --- Authentication Routes ---
// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
         return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try { // Ensure try block exists
        const userCheck = await pool.query('SELECT user_id FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' }); // 409 Conflict
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUserResult = await pool.query( // Renamed variable to avoid conflict
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING user_id, username, created_at',
            [username, hashedPassword]
        );
        const newUser = newUserResult.rows[0]; // Extract the user data

        console.log(`User registered: ${newUser.username}`);
        // Correct JSON response structure
        res.status(201).json({
            message: 'User registered successfully!',
            user: {
                userId: newUser.user_id,
                username: newUser.username,
                createdAt: newUser.created_at
            } // Correct closing brace for user object
        }); // Correct closing parenthesis for json call

    } catch (err) { // Added catch block
        console.error("Registration error:", err.stack);
        res.status(500).json({ error: 'Server error during registration' });
    }
}); // Correct closing parenthesis for route handler

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try { // Ensure try block exists
        const result = await pool.query('SELECT user_id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Login failed: User not found - ${username}`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            const payload = { userId: user.user_id, username: user.username };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

            console.log(`User logged in: ${user.username} (ID: ${user.user_id})`);
            res.json({ // Correct JSON structure
                message: 'Login successful!',
                token: token,
                user: {
                     userId: user.user_id,
                     username: user.username
                } // Correct closing brace for user object
             }); // Correct closing parenthesis for json call
        } else {
            console.log(`Login failed: Incorrect password for user - ${username}`);
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (err) { // Added catch block
        console.error("Login error:", err.stack);
        res.status(500).json({ error: 'Server error during login' });
    }
}); // Correct closing parenthesis for route handler

// --- Expense Routes (Now PROTECTED and USER-SPECIFIC) ---

// GET /api/expenses - Retrieve expenses for the logged-in user
app.get('/api/expenses', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Get user ID from middleware
    // Declare sql and params locally for this route
    const sql = "SELECT id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp FROM expenses WHERE user_id = $1 ORDER BY date DESC, timestamp DESC";
    const params = [userId];
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching expenses for user ${userId}:`, err.stack);
        res.status(500).json({ error: "Database error: Failed to retrieve expenses" });
    }
}); // Correct closing parenthesis

// POST /api/expenses - Add a new expense for the logged-in user
app.post('/api/expenses', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Use userId from middleware
    const { description, amount, category, date } = req.body;
    // Validation...
    if (!description || amount == null || !category || !date) return res.status(400).json({ error: "Missing required fields" });
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "Invalid amount (must be > 0)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });
    if (isNaN(new Date(date).getTime())) return res.status(400).json({ error: "Invalid date value" });

    // Declare sql and params locally
    const sql = `INSERT INTO expenses (description, amount, category, date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp`;
    const params = [description, parsedAmount, category, date, userId];
    try {
        const result = await pool.query(sql, params);
        if (result.rows.length > 0) {
             console.log(`Expense added for user ${userId}: ID=${result.rows[0].id}`);
            res.status(201).json(result.rows[0]);
        } else {
             console.error("Insert successful but RETURNING failed.");
             res.status(500).json({ error: "Failed to confirm expense addition" });
        }
    } catch (err) {
        console.error("Error adding expense:", err.stack);
        if (err.code === '23514') return res.status(400).json({ error: "Amount constraint violated" });
        res.status(500).json({ error: "Database error: Failed to add expense" });
    }
}); // Correct closing parenthesis

// PUT /api/expenses/:id - Update an expense owned by the logged-in user
app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Use userId from middleware
    const id = parseInt(req.params.id, 10);
    const { description, amount, category, date } = req.body;
    // Validation...
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });
    if (!description || amount == null || !category || !date) return res.status(400).json({ error: "Missing required fields for update" });
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "Invalid amount for update" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format for update" });
    if (isNaN(new Date(date).getTime())) return res.status(400).json({ error: "Invalid date value for update" });

    // Declare sql and params locally. Ensure SQL string is terminated correctly.
    const sql = `
        UPDATE expenses
        SET description = $1, amount = $2, category = $3, date = $4
        WHERE id = $5 AND user_id = $6
        RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp
    `; // Terminating backtick for template literal
    const params = [description, parsedAmount, category, date, id, userId];
    try {
        const result = await pool.query(sql, params);
        if (result.rows.length === 0) {
             console.log(`Update failed: Expense ${id} not found or not owned by user ${userId}`);
            return res.status(404).json({ error: "Expense not found or permission denied" });
        }
        console.log(`Expense updated for user ${userId}: ID=${result.rows[0].id}`);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error updating expense:", err.stack);
        if (err.code === '23514') return res.status(400).json({ error: "Amount constraint violated" });
        res.status(500).json({ error: "Database error: Failed to update expense" });
    }
}); // Correct closing parenthesis

// DELETE /api/expenses/:id - Delete an expense owned by the logged-in user
app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Use userId from middleware
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });

    // Declare sql and params locally
    const sql = "DELETE FROM expenses WHERE id = $1 AND user_id = $2";
    const params = [id, userId];
    try {
        const result = await pool.query(sql, params);
        if (result.rowCount === 0) {
             console.log(`Delete failed: Expense ${id} not found or not owned by user ${userId}`);
             return res.status(404).json({ error: "Expense not found or permission denied" });
        }
        console.log(`Expense deleted for user ${userId}: ID=${id}`);
        res.status(200).json({ message: `Expense ${id} deleted` }); // Or res.sendStatus(204);
    } catch (err) {
        console.error("Error deleting expense:", err.stack);
        res.status(500).json({ error: "Database error: Failed to delete expense" });
    }
}); // Correct closing parenthesis


// --- Catch-all Route ---
// MUST be after API routes and static middleware
app.get('*', (req, res) => {
  const indexPath = path.resolve(__dirname, '../frontend', 'index.html');
  console.log(`Catch-all: Serving index.html for request path: ${req.path}`);
  res.sendFile(indexPath, (err) => {
      if (err) {
          console.error(`Error sending index.html for ${req.path}:`, err.message || err);
          if (err.code === 'ENOENT') {
               res.status(404).send('Page not found.');
          } else {
               res.status(500).send('Error loading application page.');
          }
      }
  });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => { // Ensure 4 arguments for error handling
  console.error("Unhandled application error:", err.stack || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// --- Server Start ---
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Access locally at: http://localhost:${port}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Closing HTTP server...`);
    server.close(async () => { // Make callback async to await pool.end()
        console.log('HTTP server closed.');
        try {
            await pool.end(); // Ensure pool closes before exiting
            console.log('Database pool connection closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error closing database pool:', err.stack);
            process.exit(1);
        }
    });
};
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));