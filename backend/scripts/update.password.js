const bcrypt = require('bcryptjs');
const { readDb, writeDb, closePool } = require('../src/db');

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error('Usage: node scripts/update.password.js "email@example.com" "NewStrongPassword123"');
    process.exitCode = 1;
    return;
  }
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const normEmail = email.trim().toLowerCase();
  const db = await readDb();

  const user = db.users.find(u => u.email.toLowerCase() === normEmail);
  if (!user) {
    console.error(`No account found with email "${normEmail}".`);
    process.exitCode = 1;
    return;
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  await writeDb(db);

  console.log(`Password updated for ${user.role} account: ${normEmail}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());