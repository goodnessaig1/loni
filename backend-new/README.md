# Loni Backend (FastAPI)

Welcome to the modern Loni Backend built with FastAPI.

## Tech Stack
- **Framework:** FastAPI
- **Language:** Python 3
- **Database ORM:** SQLAlchemy (with async support)
- **Migrations:** Alembic
- **Database:** PostgreSQL (NeonDB)
- **Authentication:** JWT, Passlib (Bcrypt)
- **Storage/Media:** Cloudinary
- **Email Service:** Brevo (Sendinblue) API

## Setup Instructions

### 1. Prerequisites
- Python 3.10+
- PostgreSQL database

### 2. Virtual Environment
It's recommended to isolate your project dependencies using a virtual environment:

```bash
# Create the virtual environment
python3 -m venv venv

# Activate it (Mac/Linux)
source venv/bin/activate

# Activate it (Windows)
venv\Scripts\activate
```

### 3. Install Dependencies
Install all required Python packages from the `requirements.txt` file:

```bash
pip install -r requirements.txt
```

### 4. Environment Variables
Create a `.env` file in the project directory (`backend-new/.env`) and configure the necessary environment variables:

```env
PORT=8000
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
SECRET_KEY=your_super_secret_key_change_in_production
NODE_ENV=development

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Brevo Setup
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_sender_email@example.com
```

### 5. Database Migrations
This project uses Alembic for database migrations. To apply the latest schemas to your database, run:

```bash
alembic upgrade head
```

*Note: Whenever you make changes to your SQLAlchemy models in `app/modules/...`, you can generate a new migration file by running:*
```bash
alembic revision --autogenerate -m "description of changes"
```

### 6. Run the Application
Start the FastAPI development server using Uvicorn:

```bash
uvicorn app.main:app --reload --port 8000
```

### 7. API Documentation
FastAPI automatically generates interactive API documentation. Once the server is running, you can explore the API endpoints here:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
