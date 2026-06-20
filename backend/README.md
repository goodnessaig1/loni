# Loni Backend (Node.js/Express)

This is the original Node.js based backend for Loni, using Express and Drizzle ORM.

## Tech Stack
- **Framework:** Express.js
- **Language:** TypeScript
- **Database ORM:** Drizzle ORM
- **Database:** PostgreSQL
- **Authentication:** JWT, bcryptjs
- **Storage/Media:** Cloudinary
- **Email Service:** Brevo API

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL database

### 2. Install Dependencies
Run the following command to install all the required npm packages:

```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of the project (`backend/.env`) using `.env.example` as a template. Make sure to populate the required variables:

```env
# Database configuration, Cloudinary, Brevo, JWT keys etc.
```

### 4. Database Setup
This project uses Drizzle ORM for database queries and migrations. To push the schema to your database or generate migrations:

```bash
# Generate migrations based on your schema
npm run db:generate

# Push the schema changes directly to your database
npm run db:push
```

### 5. Run the Application

To run the application in **development mode** (using nodemon for hot-reloading):
```bash
npm run dev
```

To build and run the application for **production**:
```bash
npm run build
npm start
```

### 6. API Documentation
The API documentation is provided by Swagger UI and can be accessed when the application is running, generally at:
- **Swagger UI:** [http://localhost:<PORT>/api-docs](http://localhost:3000/api-docs) *(Port may vary based on your environment variables)*
