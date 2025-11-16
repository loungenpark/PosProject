# Restaurant POS System

A comprehensive, offline-first Point of Sale (POS) application for restaurants, built with React, Node.js (Express), and PostgreSQL. It's designed for a touch-friendly experience and supports essential restaurant operations.

## Features

-   **Hybrid Database System**:
    -   **IndexedDB (Client-side)**: Ensures the application is fully functional without an internet connection (Offline-First).
    -   **PostgreSQL (Server-side)**: Provides a centralized, persistent data store for backup and multi-client synchronization.
-   **Automatic Data Sync**: Offline transactions are automatically synced to the central server when the connection is restored.
-   **User Roles**:
    -   **Admin**: Full access to manage menu items, categories, users, and view sales reports.
    -   **Cashier**: Process orders and payments.
-   **Core POS Functionality**:
    -   Table management.
    -   Order taking and modification.
    -   Receipt printing.
    -   Sales dashboard and transaction history.
-   **Menu & Stock Management**:
    -   Create and manage menu categories and items.
    -   Track stock levels for items and receive low-stock warnings.

## Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **Backend**: Node.js, Express.js
-   **Databases**:
    -   PostgreSQL (remote)
    -   IndexedDB (local)
-   **API Communication**: REST API

## Setup and Installation

Follow these steps to set up and run the project on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or later recommended)
-   [PostgreSQL](https://www.postgresql.org/download/)

### 1. Database Setup

1.  Make sure your PostgreSQL server is running.
2.  Create a new database. You can use a tool like `psql` or a GUI like pgAdmin.

    ```sql
    CREATE DATABASE pos_db;
    ```

3.  Connect to your new database and run the schema script to create the necessary tables.

    ```bash
    # Using psql
    psql -d pos_db -a -f server/schema.sql
    ```

### 2. Backend Server Setup

1.  **Clone the repository** (or download and extract the source code).

2.  **Install dependencies**: Navigate to the project's root directory and run:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    -   Create a file named `.env` in the root directory of the project.
    -   Copy the contents from `.env.example` into your new `.env` file.
    -   Update the `.env` file with your actual PostgreSQL database connection details (username, password, database name, etc.).

### 3. Running the Application

Once the database and environment variables are configured, you can start the server:

```bash
npm start
```

This will start the backend server and serve the frontend application.

### 4. Accessing the App

Open your web browser and navigate to one of the URLs printed in your terminal, for example:

-   `http://localhost:3001`

The default PINs are:
-   **Admin**: `1234`
-   **Kamarier (Cashier)**: `0000`

---
That's it! Your Restaurant POS system should now be up and running.
