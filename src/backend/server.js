// src/backend/server.js

// Load environment variables from .env in this directory
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
// Use hosting provider's PORT or 3000 locally
const port = process.env.PORT || 3000;

// --- Database Setup ---
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
    console.error("Ensure the variable is set in your deployment environment (Render)");
    console.error("or you have a .env file in 'src/backend/' for local development.");
    process.exit(1); // Stop if DB URL is missing
}

const pool = new Pool({
    connectionString: connectionString,
    // Add SSL configuration if required by your provider and not handled by the string
    // ssl: { rejectUnauthorized: false } // Example, check provider docs
});

// Async function to initialize DB connection and table
async function initializeDatabase() {
    let client;
    try {
        client = await pool.connect();
        console.log("Connected to the PostgreSQL database via pool.");
        // Create table if it doesn't exist
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
        // Consider exiting if DB init fails critically
        // process.exit(1);
    } finally {
        if (client) {
            client.release(); // Always release client
            console.log("Initial database client released.");
        }
    }
}

initializeDatabase(); // Run initialization on start

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies

// Serve static files (HTML, CSS, JS) from src/frontend
const frontendPath = path.join(__dirname, '../frontend');
console.log(`Attempting to serve static files from: ${frontendPath}`); // Debug log
app.use(express.static(frontendPath));

// --- API Routes ---

// GET /api/expenses - Retrieve all expenses
app.get('/api/expenses', async (req, res) => {
    const sql = "SELECT id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp FROM expenses ORDER BY date DESC, timestamp DESC";
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching expenses:", err.stack);
        res.status(500).json({ error: "Database error: Failed to retrieve expenses" });
    }
});

// POST /api/expenses - Add a new expense
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category, date } = req.body;
    // Validation
    if (!description || amount == null || !category || !date) return res.status(400).json({ error: "Missing required fields" });
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "Invalid amount (must be > 0)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });
    if (isNaN(new Date(date).getTime())) return res.status(400).json({ error: "Invalid date value" });

    const sql = `INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp`;
    const params = [description, parsedAmount, category, date];
    try {
        const result = await pool.query(sql, params);
        if (result.rows.length > 0) {
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
});

// PUT /api/expenses/:id - Update an existing expense
app.put('/api/expenses/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { description, amount, category, date } = req.body;
    // Validation
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });
    if (!description || amount == null || !category || !date) return res.status(400).json({ error: "Missing required fields for update" });
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "Invalid amount for update" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format for update" });
    if (isNaN(new Date(date).getTime())) return res.status(400).json({ error: "Invalid date value for update" });

    const sql = `UPDATE expenses SET description = $1, amount = $2, category = $3, date = $4 WHERE id = $5 RETURNING id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date, timestamp`;
    const params = [description, parsedAmount, category, date, id];
    try {
        const result = await pool.query(sql, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Expense not found for update" });
        }
        res.status(200).json(result.rows[0]); // Send back updated object
    } catch (err) {
        console.error("Error updating expense:", err.stack);
        if (err.code === '23514') return res.status(400).json({ error: "Amount constraint violated" });
        res.status(500).json({ error: "Database error: Failed to update expense" });
    }
});

// DELETE /api/expenses/:id - Delete an expense
app.delete('/api/expenses/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid expense ID" });
    const sql = "DELETE FROM expenses WHERE id = $1";
    const params = [id];
    try {
        const result = await pool.query(sql, params);
        if (result.rowCount === 0) {
             return res.status(404).json({ error: "Expense not found" });
        }
        res.status(200).json({ message: `Expense ${id} deleted` }); // Or res.sendStatus(204);
    } catch (err) {
        console.error("Error deleting expense:", err.stack);
        res.status(500).json({ error: "Database error: Failed to delete expense" });
    }
});


// --- Catch-all Route for SPA/Frontend ---
// MUST be after API routes and static middleware
app.get('*', (req, res) => {
  const indexPath = path.resolve(__dirname, '../frontend', 'index.html');
  console.log(`Catch-all: Serving index.html for request path: ${req.path}`); // Debug log
  res.sendFile(indexPath, (err) => {
      if (err) {
          // Log the error but avoid sending detailed path back to client
          console.error(`Error sending index.html for ${req.path}:`, err.message || err);
          // Send a generic 404 or 500 based on the error type if possible
          if (err.code === 'ENOENT') { // ENOENT means file not found
               res.status(404).send('Page not found.');
          } else {
               res.status(500).send('Error loading application page.');
          }
      }
  });
});

// --- Global Error Handler ---
// Catches errors passed via next(err) or uncaught sync errors in route handlers
app.use((err, req, res, next) => {
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
    server.close(async () => {
        console.log('HTTP server closed.');
        try {
            await pool.end();
            console.log('Database pool connection closed.');
            process.exit(0); // Exit cleanly
        } catch (err) {
            console.error('Error closing database pool:', err.stack);
            process.exit(1); // Exit with error
        }
    });
};
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Render stop signal