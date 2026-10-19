# Maxing Tax Digital

A full-stack web application designed for digital tax management. The project is split into a scalable Node.js/Express backend and a responsive React/Vite frontend.

## Authors

@copyright : ToXSL Technologies Pvt. Ltd. < www.toxsl.com >
@author    : Shiv Charan Panjeta

All Rights Reserved.
Proprietary and confidential : All information contained herein is, and remains the property of ToXSL Technologies Pvt. Ltd. and its partners. Unauthorized copying of this file, via any medium is strictly prohibited.

---

## 🛠 Tech Stack

### Client (Frontend)
- **Framework:** React 18, Vite
- **State Management:** Redux Toolkit
- **Routing:** React Router DOM
- **Styling:** Bootstrap, SASS, SCSS
- **Forms & Validation:** Formik, Yup
- **Data Fetching:** Axios, React Query
- **Other:** Stripe, Chart.js, Socket.io-client, i18next

### Server (Backend)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT, bcrypt
- **File Uploads:** Multer
- **API Documentation:** Swagger UI
- **Other:** Twilio, Stripe, Socket.io, Puppeteer, FCM Push

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (if running locally without Docker)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (for containerized deployment)

---

## 💻 Run Locally (Without Docker)

### 1. Clone the Repository
```bash
git clone <PROJECT_URL>
cd maxing-tax-digital-node-2327
```

### 2. Server Setup
```bash
cd server
npm install -f
```
- Rename `.env.example` (or `env.default`) to `.env` and configure your backend environment variables (Database URL, JWT Secret, etc.).
- Start the backend server:
```bash
npm start
```
*The server will run on port 2326.*

### 3. Client Setup
Open a new terminal window:
```bash
cd client
npm install -f
```
- Rename `.env.example` (or `env.default`) to `.env`.
- Add the backend URL variable:
  ```env
  VITE_API_URL=http://localhost:2326
  ```
- Start the frontend development server:
```bash
npm run dev
```
*The client will run on port 2327.*

---

## 🐳 Run with Docker

This project includes a `docker-compose.yml` file to quickly spin up the entire stack (UI, API, MongoDB, and NGINX Load Balancer).

### 1. Configure Environment Variables
Ensure you have your `.env` files created in both the `client/` and `server/` directories.

### 2. Build and Start the Containers

To build the images without using the cache and start the containers:
```bash
# Build the images
sudo docker-compose build --no-cache

# Start the containers in detached mode
sudo docker-compose up -d --remove-orphans
```

To view real-time logs:
```bash
sudo docker-compose up
```

### Docker Services Overview:
- **ui**: Frontend application accessible on port `2327`.
- **api**: Backend application accessible on port `2326`.
- **db**: MongoDB instance mapped to port `27019` locally (internal `27017`).
- **lb**: NGINX server acting as a reverse proxy/load balancer on ports `80` and `443`.

*Note: For URL routing to work properly through NGINX, ensure the `nginx.conf` file is correctly configured.*

---

## 📚 API Documentation

Once the backend is running, the Swagger API documentation can be generated and viewed:
```bash
cd server
npm run gen-doc
```
*(Check your specific route configuration for the Swagger UI endpoint, typically `/api-docs`)*