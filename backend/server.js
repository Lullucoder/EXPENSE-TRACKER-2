// backend/server.js

// Load environment variables from .env file in the 'backend' folder
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // Use the Pool class from the 'pg' module
const path = require('path');

const app = express();
// Use the PORT environment variable provided by Vercel, default to 3000 locally
const port = process.env.PORT || 3000;

// --- Database Setup (PostgreSQL using Pool) ---
const connectionString = process.env.DATABASE_URL;

// Crucial check: Ensure the DATABASE_URL is set in the environment variables
if (!connectionString) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
    console.error("Ensure you have a .env file in the 'backend' directory with DATABASE_URL='your_connection_string'");
    console.error("Or that the DATABASE_URL environment variable is set in your deployment environment (like Vercel).");
    process.exit(1); // Exit the application if the database URL is missing
}

const pool = new Pool({
    connectionString: connectionString,
    // Supabase typically uses SSL, and the connection string usually handles it.
    // Add SSL config only if you encounter connection issues:
    // ssl: {
    //   rejectUnauthorized: false // Use with caution, check Supabase recommendations
    // }
});

// Async function to initialize DB connection and create table if needed
async function initializeDatabase() {
    let client; // Declare client outside try block for potential use in finally
    try {
        client = await pool.connect(); // Get a client from the pool
        console.log("Connected to the PostgreSQL database via pool.");

        // PostgreSQL syntax for table creation:
        // - SERIAL: Auto-incrementing integer primary key
        // - NUMERIC(10, 2): Precise decimal type for money (adjust precision/scale if needed)
        // - DATE: Standard SQL date type
        // - TIMESTAMPTZ: Timestamp with timezone (recommended)
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                date DATE NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Expenses table checked/created successfully.");

    } catch (err) {
        console.error("Error initializing database:", err.stack);
        // Depending on the error, you might want the app to exit or retry
        // For now, we'll let it continue, but requests might fail.
    } finally {
        if (client) {
            client.release(); // IMPORTANT: Always release the client back to the pool
            console.log("Database client released.");
        }
    }
}

initializeDatabase(); // Run the database initialization


// --- Middleware ---
app.use(express.json()); // Middleware to parse JSON request bodies

// **IMPORTANT**: Update static path to point to the 'frontend' directory
// It goes up one level ('../') from 'backend' to the project root, then into 'frontend'
app.use(express.static(path.join(__dirname, '../frontend')));


// --- API Routes (Updated for PostgreSQL and async/await) ---


// PUT (Update) an existing expense
// Add this route to backend/server.js
app.put('/api/expenses/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { description, amount, category, date } = req.body;

    // --- Server-Side Validation ---
    if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid expense ID format." });
    }
    if (!description || amount == null || !category || !date) {
        return res.status(400).json({ error: "Missing required fields for update." });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount for update." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD) for update." });
    }
     if (isNaN(new Date(date).getTime())) {
         return res.status(400).json({ error: "Invalid date value for update." });
    }
    // --- End Validation ---

    const sql = `
        UPDATE expenses
        SET description = $1, amount = $2, category = $3, date = $4
        WHERE id = $5
        RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp
    `;
    const params = [description, parsedAmount, category, date, id];

    try {
        const result = await pool.query(sql, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Expense not found for update." });
        }
        res.status(200).json(result.rows[0]); // Send back the updated expense object
    } catch (err) {
        console.error("Error updating expense:", err.stack);
         if (err.code === '23514') { // Check constraint violation
             return res.status(400).json({ error: "Amount constraint violated (must be > 0)." });
         }
        res.status(500).json({ error: "Failed to update expense." });
    }
});

// GET all expenses
app.get('/api/expenses', async (req, res) => {
    // Use TO_CHAR to ensure date is returned as 'YYYY-MM-DD' string, matching frontend expectation
    const sql = "SELECT id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp FROM expenses ORDER BY date DESC, timestamp DESC";
    try {
        const result = await pool.query(sql);
        res.json(result.rows); // pg results object has a 'rows' property containing the data array
    } catch (err) {
        console.error("Error fetching expenses:", err.stack);
        res.status(500).json({ error: "Failed to retrieve expenses" });
    }
});

// POST a new expense
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category, date } = req.body;

    // --- Server-Side Validation ---
    if (!description || amount == null || !category || !date) { // Check amount for null/undefined
        return res.status(400).json({ error: "Missing required fields (description, amount, category, date)" });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }
    // Validate if the date string represents a real date
    if (isNaN(new Date(date).getTime())) {
         return res.status(400).json({ error: "Invalid date value." });
    }
    // --- End Validation ---

    // Use parameterized queries ($1, $2, ...) to prevent SQL injection
    // Use RETURNING to get the newly inserted row back from PostgreSQL
    const sql = `
        INSERT INTO expenses (description, amount, category, date)
        VALUES ($1, $2, $3, $4)
        RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp
    `;
    const params = [description, parsedAmount, category, date]; // Ensure types match (number for amount, string for date)

    try {
        const result = await pool.query(sql, params);
        if (result.rows.length > 0) {
            res.status(201).json(result.rows[0]); // Send the complete new expense object back
        } else {
             console.error("Insert successful but RETURNING clause did not return data.");
             res.status(500).json({ error: "Failed to add expense - confirmation error." });
        }
    } catch (err) {
        console.error("Error adding expense:", err.stack);
        // Check for specific PostgreSQL error codes if needed
        if (err.code === '23514') { // Check constraint violation (e.g., amount > 0)
             return res.status(400).json({ error: "Amount constraint violated (must be > 0)." });
        }
        // Add other specific error code checks if necessary
        res.status(500).json({ error: "Failed to add expense due to database error." });
    }
});

// DELETE an expense
app.delete('/api/expenses/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10); // Always parse ID to integer for safety

    // Validate ID
    if (isNaN(id)) {
         return res.status(400).json({ error: "Invalid expense ID format." });
    }

    const sql = "DELETE FROM expenses WHERE id = $1";
    const params = [id];

    try {
        const result = await pool.query(sql, params);
        // result.rowCount gives the number of rows affected (deleted)
        if (result.rowCount === 0) {
             return res.status(404).json({ error: "Expense not found." });
        }
        // Successfully deleted
        res.status(200).json({ message: `Expense ${id} deleted successfully` });
        // Or use 204 No Content for successful deletions with no body:
        // res.status(204).send();
    } catch (err) {
        console.error("Error deleting expense:", err.stack);
        res.status(500).json({ error: "Failed to delete expense" });
    }
});


// --- Catch-all for Frontend Routing ---
// This route should come AFTER your API routes
// It ensures that any request not matched by API routes or static files
// will serve the main frontend HTML file, allowing client-side routing to work.
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend', 'index.html'));
});


// --- Basic Error Handling & Server Start ---

// Optional: More specific 404 for API routes if needed, but the '*' route handles non-API 404s now.
// app.use('/api/*', (req, res) => {
//     res.status(404).json({ error: 'API endpoint not found' });
// });


// Global error handler middleware (Must have 4 arguments: err, req, res, next)
app.use((err, req, res, next) => {
  console.error("Unhandled application error:", err.stack); // Log the full error stack
  res.status(500).json({ error: 'Something went wrong on the server!' }); // Send generic error to client
});


const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Frontend should be accessible via the server URL`);
});

// --- Graceful Shutdown Handling ---
// Function to handle shutdown signal
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} signal received. Closing application...`);
    server.close(() => {
        console.log('HTTP server closed.');
    });

    try {
        await pool.end(); // Close the database pool connections
        console.log('Database pool has ended successfully.');
        process.exit(0); // Exit cleanly
    } catch (err) {
        console.error('Error closing database pool:', err.stack);
        process.exit(1); // Exit with error code
    }
};

// Listen for common termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Termination signal from OS/Process Manager