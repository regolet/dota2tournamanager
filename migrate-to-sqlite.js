import { migrateFromJson } from './db.js';

// Run migration
migrateFromJson()
  .then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      console.error('Migration failed:', result.message);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error during migration:', error);
    process.exit(1);
  }); 