// Migration script to update API Configuration schema for flexible sharing
// Run this script once to migrate existing data to the new flexible system

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflowdb';

async function migrateApiConfigs() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        const db = mongoose.connection.db;
        const collection = db.collection('apiconnectionconfigs');

        // Step 1: Drop the unique indexes
        console.log('Dropping unique indexes...');
        try {
            await collection.dropIndex('name_1');
            console.log('Dropped unique index on name field');
        } catch (error) {
            console.log('Index name_1 may not exist:', error.message);
        }

        try {
            await collection.dropIndex('apiUrl_1_apiMethod_1');
            console.log('Dropped unique compound index on apiUrl and apiMethod');
        } catch (error) {
            console.log('Index apiUrl_1_apiMethod_1 may not exist:', error.message);
        }

        // Step 2: Add new fields to existing documents
        console.log('Adding new fields to existing documents...');
        const updateResult = await collection.updateMany(
            {}, // Update all documents
            {
                $set: {
                    isShared: false, // Default to private
                    allowedUsers: [], // Empty array initially
                    usedByWorkflows: [], // Empty array initially
                    usageCount: 0, // Default usage count
                    // lastUsedAt is optional and will be set when first used
                }
            }
        );
        console.log(`Updated ${updateResult.modifiedCount} documents with new fields`);

        // Step 3: Create new indexes for better performance
        console.log('Creating new indexes...');
        await collection.createIndex({ requestedBy: 1, status: 1 });
        await collection.createIndex({ isShared: 1, status: 1 });
        await collection.createIndex({ apiUrl: 1, apiMethod: 1, status: 1 }); // Non-unique
        await collection.createIndex({ 'usedByWorkflows.workflowId': 1 });
        console.log('Created new indexes successfully');

        // Step 4: Optional - Mark some existing approved configs as shared
        console.log('Optionally marking some approved configs as shared...');
        const sharedUpdateResult = await collection.updateMany(
            { status: 'Approved' }, // Only approved configs
            {
                $set: {
                    isShared: true // Make approved configs shared by default
                }
            }
        );
        console.log(`Marked ${sharedUpdateResult.modifiedCount} approved configurations as shared`);

        console.log('Migration completed successfully!');
        console.log('\nSummary:');
        console.log('- Removed unique constraints on name and apiUrl+apiMethod');
        console.log('- Added new fields: isShared, allowedUsers, usedByWorkflows, usageCount');
        console.log('- Created new performance indexes');
        console.log('- Marked existing approved configs as shared');
        console.log('\nThe system now supports:');
        console.log('- Multiple configs with same name or URL+method combination');
        console.log('- Sharing configurations between workflow designers');
        console.log('- Usage tracking and analytics');
        console.log('- Better collaboration and reuse');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    migrateApiConfigs()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateApiConfigs }; 