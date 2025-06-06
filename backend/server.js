const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { initializeEmailService } = require('./src/api/core/utils/emailService');

const connectDB = require('./src/config/db.js');
const app = require('./src/app.js');
const { startTimerScheduler } = require('./src/engine/timer.scheduler');

require('./src/api/v1/users/user.model.js');
require('./src/api/v1/workflows/workflow.model.js');
require('./src/api/v1/files/file.model.js');
require('./src/api/v1/instances/workflowInstance.model.js');
require('./src/api/v1/tasks/task.model.js');
require('./src/api/v1/issues/issueReport.model.js');
require('./src/api/v1/api-configs/apiConnectionConfig.model.js');

const PORT = process.env.PORT || 5000;

initializeEmailService().then(() => {
    console.log("Email service initialized successfully during app startup.");
}).catch(error => {
    console.error("Failed to initialize email service during app startup:", error);
});

if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in the .env file.");
    process.exit(1);
}


startTimerScheduler('*/10 * * * * *'); // Every 10 seconds - will fallback to 30 seconds if this fails

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
    console.error("Failed to start server due to DB connection issue:", err);
    process.exit(1);
});