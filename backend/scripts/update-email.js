const { readDb, writeDb, closePool } = require('../src/db');

async function main() {
  const [, , oldEmail, newEmail] = process.argv;

  if (!oldEmail || !newEmail) {
    console.error(
      'Usage: node scripts/update-email.js "old@example.com" "new@example.com"'
    );
    process.exitCode = 1;
    return;
  }

  const normOld = oldEmail.trim().toLowerCase();
  const normNew = newEmail.trim().toLowerCase();

  console.log('Connecting to database...');

  const db = await readDb();

  if (!db) {
    throw new Error('readDb() returned undefined.');
  }

  console.log('Database object loaded.');
  console.log('Database keys:', Object.keys(db));

  if (!Array.isArray(db.users)) {
    throw new Error(
      'Database does not contain a users array. Check db.js and DATABASE_URL.'
    );
  }

  console.log(`Found ${db.users.length} user account(s).`);

  const user = db.users.find(
    u => u.email && u.email.toLowerCase() === normOld
  );

  if (!user) {
    console.error(`No account found with email "${normOld}".`);
    return;
  }

  const existingUser = db.users.find(
    u =>
      u.email &&
      u.email.toLowerCase() === normNew &&
      u.id !== user.id
  );

  if (existingUser) {
    console.error(`An account with email "${normNew}" already exists.`);
    return;
  }

  const oldUserEmail = user.email;

  user.email = normNew;

  await writeDb(db);

  console.log(
    `Updated ${user.role} account: ${oldUserEmail} -> ${normNew}`
  );
}

main()
  .catch(err => {
    console.error('\n❌ Error updating email:');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  });