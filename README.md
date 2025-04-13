# Students Expense Tracker

![Expense Tracker Screenshot](https://github.com/user-attachments/assets/f29c7033-c1f1-4682-8d8d-b47c87089447)

A full-stack web application designed to help students track their expenses efficiently. Built with Node.js, Express, PostgreSQL (hosted on Supabase), and a responsive vanilla JavaScript frontend featuring Chart.js for visualization.

**🚀 Live Websites:**                                                                                                                                                                                    
🌐 Railway Deployment: https://expense-tracker-2-production.up.railway.app                                                                                                                                  
🌐 Render Deployment: https://expense-tracker-2-k92j.onrender.com<!-- <<< REPLACE THIS URL -->

## Features

*   **Add Expenses:** Easily record new expenses with description, amount, category, and date.
*   **View History:** See a chronological list of all recorded expenses.
*   **Edit Expenses:** Modify details of existing expenses via a modal form.
*   **Delete Expenses:** Remove expenses with a confirmation step.
*   **Filtering:** Filter the expense history by category.
*   **Searching:** Search expenses by description text.
*   **Summary:** View the total amount of expenses displayed/filtered.
*   **Category Chart:** Visualize the proportion of spending across different categories using a doughnut chart (updates with filters).
*   **Data Persistence:** All expense data is securely stored in a PostgreSQL database (Supabase).
*   **Responsive UI:** Adapts to different screen sizes (desktop, tablet, mobile).
*   **User Feedback:** Provides visual feedback for loading states, successful actions, and errors.

## Tech Stack

*   **Backend:**
    *   Node.js
    *   Express.js
    *   PostgreSQL (via Supabase)
    *   `pg` (node-postgres client)
    *   `dotenv` (for local environment variables)
*   **Frontend:**
    *   HTML5
    *   CSS3 (including CSS Variables, Flexbox, Grid, Media Queries)
    *   Vanilla JavaScript (ES6+)
    *   Chart.js (for data visualization)
    *   Font Awesome (for icons)
*   **Database:**
    *   Supabase (Cloud-hosted PostgreSQL)
*   **Deployment:**
    *   Render

## Project Structure
EXPENSE-TRACKER-2/                                                                                                                                          
├── .git/ # Git tracking folder (hidden)                                                                                                                    
├── node_modules/ # Project dependencies (ignored by Git)
├── src/ # Main source code folder                                                                                                                          
│ ├── backend/ # Backend specific files                                                                                                                     
│ │ ├── .env # Local environment variables (ignored by Git)                                                                                                 
│ │ └── server.js # Express server logic, API routes                                                                                                        
│ └── frontend/ # Frontend specific files                                                                                                                   
│ ├── css/ # CSS styles                                                                                                                                     
│ │ └── style.css                                                                                                                                           
│ ├── js/ # JavaScript files                                                                                                                                
│ │ └── script.js                                                                                                                                           
│ └── index.html # Main HTML page                                                                                                                           
├── .gitignore # Specifies intentionally untracked files                                                                                                    
├── package-lock.json # Exact dependency versions                                                                                                           
├── package.json # Root project config, dependencies, scripts                                                                                               
└── README.md # This file                                                                                                                                   

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   **Node.js & npm:** Make sure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org/). (Version 18.x or later recommended).
*   **Git:** Required for cloning the repository. Download from [git-scm.com](https://git-scm.com/).
*   **Supabase Account & Database:**
    *   Create a free account at [supabase.com](https://supabase.com/).
    *   Create a new project.
    *   Navigate to your project's Database settings and find your Connection String (usually under "Connection pooling" -> "URI"). You'll need this!

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/[Your GitHub Username]/EXPENSE-TRACKER-2.git
    cd EXPENSE-TRACKER-2
    ```
    *(Replace `[Your GitHub Username]`)*

2.  **Install dependencies:** Install the required packages listed in the root `package.json`. Run this command from the **root** (`EXPENSE-TRACKER-2`) directory:
    ```bash
    npm install
    ```

## Running the Application Locally

### Environment Variables

The backend needs your database connection string to connect to Supabase. For local development:

1.  Create a file named `.env` inside the `src/backend/` directory (`src/backend/.env`).
2.  Add your Supabase connection string to this file:
    ```dotenv
    # src/backend/.env
    DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:[YOUR-PORT]/postgres
    ```
    *(Replace the placeholder with your **actual** Supabase connection string, including your database password).*
3.  **Important:** The `.gitignore` file is configured to prevent this `.env` file from being committed to Git, keeping your password safe.

### Start the Server

1.  Make sure you are in the **root** directory (`EXPENSE-TRACKER-2`) of the project in your terminal.
2.  Run the start script defined in the root `package.json`:
    ```bash
    npm start
    ```
3.  The terminal should show messages indicating the server is running and connected to the database:
    ```
    Connected to the PostgreSQL database via pool.
    Expenses table checked/created successfully.
    Initial database client released.
    Server listening on port 3000
    Access locally at: http://localhost:3000
    ```
4.  Open your web browser and navigate to `http://localhost:3000`.

## API Endpoints

The backend provides the following API endpoints under the `/api` prefix:

*   `GET /api/expenses`: Retrieves all expenses, ordered by date descending.
*   `POST /api/expenses`: Adds a new expense. Expects a JSON body with `description`, `amount`, `category`, `date`.
*   `PUT /api/expenses/:id`: Updates an existing expense by its ID. Expects a JSON body with `description`, `amount`, `category`, `date`.
*   `DELETE /api/expenses/:id`: Deletes an expense by its ID.

## Deployment

This application is deployed and running live on **Render**.

*   **Live URL:** [https://expense-tracker-2-k92j.onrender.com] <!-- <<< REPLACE THIS URL -->
*   **Render Configuration (via Dashboard):**
    *   **Root Directory:** (Blank - uses repository root)
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start` (or `node src/backend/server.js`)
    *   **Environment Variable:** `DATABASE_URL` set securely via Render's environment settings.

## License

This project is currently unlicensed. It is open source freeware.

---

*Developed by [Prashant Singh]* <!-- Optional: Add your name/link -->
