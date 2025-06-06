# DOST Process Management System Prototype

A comprehensive workflow management system designed to streamline business processes, task assignments, and process automation.

## Features

- **Workflow Designer**: Create and manage custom workflows with visual designer
- **Task Management**: Assign, track, and complete tasks within workflows
- **Role-Based Access Control**: Different access levels for staff, managers, and administrators
- **File Uploads/Downloads**: Attach and retrieve documents for workflow tasks
- **Issue Reporting**: Report and resolve issues within workflow instances
- **API Integration**: Connect with external services through custom API configurations
- **Dashboard & Analytics**: View workflow status and performance metrics
- **Email Notifications**: Automated notifications for task assignments and status changes

## Technologies

### Backend
- Node.js
- Express.js
- MongoDB
- RESTful API architecture
- JWT Authentication

### Frontend
- React.js
- React Router
- Tailwind CSS
- Lucide React Icons

## Getting Started

### Prerequisites
- Node.js (v14+)
- MongoDB database
- Docker (optional for containerized deployment)

### Installation

#### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DOST-process-management-system-prototype.git
   cd DOST-process-management-system-prototype
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/dost_process_management
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=7d
   ```

4. Install frontend dependencies:
   ```bash
   cd ../workflow-creator-frontend
   npm install
   ```

5. Create a `.env` file in the frontend directory:
   ```
   VITE_API_BASE_URL=http://localhost:5000/api/v1
   ```

### Running the Application

#### Local Development

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server in a separate terminal:
   ```bash
   cd workflow-creator-frontend
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

#### Using Docker

Please refer to [DOCKER_SETUP.md](./DOCKER_SETUP.md) for detailed instructions on running the application with Docker.

## Usage

### Default User Roles
- **Staff**: Regular users who can complete assigned workflow tasks
- **Manager**: Can create workflows and oversee staff progress
- **Admin**: Full system access with user management capabilities

### Local Tunneling with ngrok
For testing with external APIs or mobile devices, see [NGROK_SETUP.md](./NGROK_SETUP.md) for instructions on how to expose your local development environment securely.

## Documentation

Additional documentation is available in:
- [DOCKER_SETUP.md](./DOCKER_SETUP.md) - Docker deployment instructions
- [NGROK_SETUP.md](./NGROK_SETUP.md) - Local tunneling setup

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.