import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a Date object for `day` of the month that is `monthsAgo` months
 * before today.  Uses the Date constructor form so there is no day-overflow
 * when the current date is near the end of a month.
 */
function getDate(monthsAgo: number, day: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 12, 0, 0, 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...\n');

  // ── 1. Clean existing data (order matters for FK constraints) ──────────────
  await prisma.refreshToken.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️  Cleaned existing data.\n');

  // ── 2. Hash passwords ──────────────────────────────────────────────────────
  const ROUNDS = 12;
  const [adminHash, analystHash, viewerHash] = await Promise.all([
    bcrypt.hash('Admin@123456', ROUNDS),
    bcrypt.hash('Analyst@123456', ROUNDS),
    bcrypt.hash('Viewer@123456', ROUNDS),
  ]);

  // ── 3. Create users ────────────────────────────────────────────────────────
  const [adminUser, sarahUser, mikeUser, johnUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@finance.local',
        password: adminHash,
        name: 'Finance Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'sarah.analyst@finance.local',
        password: analystHash,
        name: 'Sarah Analyst',
        role: 'ANALYST',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'mike.analyst@finance.local',
        password: analystHash,
        name: 'Mike Analyst',
        role: 'ANALYST',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'john.viewer@finance.local',
        password: viewerHash,
        name: 'John Viewer',
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    }),
  ]);

  console.log('👤 Created users:');
  console.log(`   • ${adminUser.email}  (ADMIN)    — password: Admin@123456`);
  console.log(`   • ${sarahUser.email}  (ANALYST)  — password: Analyst@123456`);
  console.log(`   • ${mikeUser.email}  (ANALYST)  — password: Analyst@123456`);
  console.log(`   • ${johnUser.email}   (VIEWER)   — password: Viewer@123456`);
  console.log();

  // ── 4. Create transactions ─────────────────────────────────────────────────
  //
  // Distribution across 4 months:
  //   monthsAgo=4  → 3 income + 6 expenses  (admin creates income, sarah expenses)
  //   monthsAgo=3  → 4 income + 6 expenses  (sarah creates income, mike expenses)
  //   monthsAgo=2  → 3 income + 7 expenses  (mike creates income, sarah expenses)
  //   monthsAgo=0  → 2 income + 5 expenses  (admin creates all)
  //
  //   Total: 12 income + 24 expenses = 36 transactions

  const transactions = [
    // ─────────────────────────────────────────────────────────────────────
    // Month 4 ago — Income (created by admin)
    // ─────────────────────────────────────────────────────────────────────
    {
      amount: 8500,
      type: 'INCOME',
      category: 'Salary',
      date: getDate(4, 1),
      notes: 'Monthly salary - Software Engineer',
      createdById: adminUser.id,
    },
    {
      amount: 1200,
      type: 'INCOME',
      category: 'Freelance',
      date: getDate(4, 8),
      notes: 'Web development project',
      createdById: adminUser.id,
    },
    {
      amount: 350,
      type: 'INCOME',
      category: 'Investment',
      date: getDate(4, 15),
      notes: 'Stock dividends Q4',
      createdById: adminUser.id,
    },

    // Month 4 ago — Expenses (created by sarah)
    {
      amount: 1800,
      type: 'EXPENSE',
      category: 'Housing',
      date: getDate(4, 1),
      notes: 'Monthly rent payment',
      createdById: sarahUser.id,
    },
    {
      amount: 120,
      type: 'EXPENSE',
      category: 'Utilities',
      date: getDate(4, 5),
      notes: 'Electricity bill',
      createdById: sarahUser.id,
    },
    {
      amount: 85,
      type: 'EXPENSE',
      category: 'Utilities',
      date: getDate(4, 10),
      notes: 'Internet + phone bill',
      createdById: sarahUser.id,
    },
    {
      amount: 420,
      type: 'EXPENSE',
      category: 'Food & Dining',
      date: getDate(4, 12),
      notes: 'Monthly groceries',
      createdById: sarahUser.id,
    },
    {
      amount: 180,
      type: 'EXPENSE',
      category: 'Transportation',
      date: getDate(4, 20),
      notes: 'Monthly bus pass',
      createdById: sarahUser.id,
    },
    {
      amount: 60,
      type: 'EXPENSE',
      category: 'Subscriptions',
      date: getDate(4, 25),
      notes: 'Netflix, Spotify, Adobe',
      createdById: sarahUser.id,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Month 3 ago — Income (created by sarah)
    // ─────────────────────────────────────────────────────────────────────
    {
      amount: 500,
      type: 'INCOME',
      category: 'Freelance',
      date: getDate(3, 3),
      notes: 'Logo design project',
      createdById: sarahUser.id,
    },
    {
      amount: 8500,
      type: 'INCOME',
      category: 'Salary',
      date: getDate(3, 1),
      notes: 'Monthly salary - Software Engineer',
      createdById: sarahUser.id,
    },
    {
      amount: 2000,
      type: 'INCOME',
      category: 'Freelance',
      date: getDate(3, 14),
      notes: 'API integration project',
      createdById: sarahUser.id,
    },
    {
      amount: 180,
      type: 'INCOME',
      category: 'Dividends',
      date: getDate(3, 20),
      notes: 'Quarterly ETF dividends',
      createdById: sarahUser.id,
    },

    // Month 3 ago — Expenses (created by mike)
    {
      amount: 1800,
      type: 'EXPENSE',
      category: 'Housing',
      date: getDate(3, 1),
      notes: 'Monthly rent',
      createdById: mikeUser.id,
    },
    {
      amount: 95,
      type: 'EXPENSE',
      category: 'Utilities',
      date: getDate(3, 6),
      notes: 'Electricity bill',
      createdById: mikeUser.id,
    },
    {
      amount: 380,
      type: 'EXPENSE',
      category: 'Food & Dining',
      date: getDate(3, 11),
      notes: 'Groceries + restaurants',
      createdById: mikeUser.id,
    },
    {
      amount: 250,
      type: 'EXPENSE',
      category: 'Healthcare',
      date: getDate(3, 16),
      notes: 'Annual dental checkup',
      createdById: mikeUser.id,
    },
    {
      amount: 150,
      type: 'EXPENSE',
      category: 'Entertainment',
      date: getDate(3, 22),
      notes: 'Cinema + streaming',
      createdById: mikeUser.id,
    },
    {
      amount: 200,
      type: 'EXPENSE',
      category: 'Shopping',
      date: getDate(3, 27),
      notes: 'Winter clothing',
      createdById: mikeUser.id,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Month 2 ago — Income (created by mike)
    // ─────────────────────────────────────────────────────────────────────
    {
      amount: 8500,
      type: 'INCOME',
      category: 'Salary',
      date: getDate(2, 1),
      notes: 'Monthly salary - Software Engineer',
      createdById: mikeUser.id,
    },
    {
      amount: 750,
      type: 'INCOME',
      category: 'Freelance',
      date: getDate(2, 10),
      notes: 'Mobile app consulting',
      createdById: mikeUser.id,
    },
    {
      amount: 450,
      type: 'INCOME',
      category: 'Investment',
      date: getDate(2, 18),
      notes: 'Crypto portfolio gains',
      createdById: mikeUser.id,
    },

    // Month 2 ago — Expenses (created by sarah)
    {
      amount: 1800,
      type: 'EXPENSE',
      category: 'Housing',
      date: getDate(2, 1),
      notes: 'Monthly rent',
      createdById: sarahUser.id,
    },
    {
      amount: 78,
      type: 'EXPENSE',
      category: 'Utilities',
      date: getDate(2, 4),
      notes: 'Water + electricity',
      createdById: sarahUser.id,
    },
    {
      amount: 450,
      type: 'EXPENSE',
      category: 'Food & Dining',
      date: getDate(2, 9),
      notes: 'Groceries + dinner',
      createdById: sarahUser.id,
    },
    {
      amount: 320,
      type: 'EXPENSE',
      category: 'Travel',
      date: getDate(2, 15),
      notes: 'Weekend getaway',
      createdById: sarahUser.id,
    },
    {
      amount: 100,
      type: 'EXPENSE',
      category: 'Education',
      date: getDate(2, 20),
      notes: 'Online course',
      createdById: sarahUser.id,
    },
    {
      amount: 55,
      type: 'EXPENSE',
      category: 'Personal Care',
      date: getDate(2, 25),
      notes: 'Haircut + toiletries',
      createdById: sarahUser.id,
    },
    {
      amount: 75,
      type: 'EXPENSE',
      category: 'Gifts & Donations',
      date: getDate(2, 28),
      notes: 'Birthday gift',
      createdById: sarahUser.id,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Current month (monthsAgo=0) — Income (created by admin)
    // ─────────────────────────────────────────────────────────────────────
    {
      amount: 8500,
      type: 'INCOME',
      category: 'Salary',
      date: getDate(0, 1),
      notes: 'Monthly salary - Software Engineer',
      createdById: adminUser.id,
    },
    {
      amount: 300,
      type: 'INCOME',
      category: 'Rental Income',
      date: getDate(0, 5),
      notes: 'Parking spot rental',
      createdById: adminUser.id,
    },

    // Current month — Expenses (created by admin)
    {
      amount: 1800,
      type: 'EXPENSE',
      category: 'Housing',
      date: getDate(0, 1),
      notes: 'Monthly rent',
      createdById: adminUser.id,
    },
    {
      amount: 130,
      type: 'EXPENSE',
      category: 'Insurance',
      date: getDate(0, 3),
      notes: 'Health insurance',
      createdById: adminUser.id,
    },
    {
      amount: 400,
      type: 'EXPENSE',
      category: 'Food & Dining',
      date: getDate(0, 8),
      notes: 'Monthly groceries',
      createdById: adminUser.id,
    },
    {
      amount: 160,
      type: 'EXPENSE',
      category: 'Transportation',
      date: getDate(0, 12),
      notes: 'Gas + parking',
      createdById: adminUser.id,
    },
    {
      amount: 500,
      type: 'EXPENSE',
      category: 'Taxes',
      date: getDate(0, 18),
      notes: 'Quarterly estimated taxes',
      createdById: adminUser.id,
    },
  ];

  await prisma.transaction.createMany({ data: transactions });

  // ── 5. Compute and display summary ────────────────────────────────────────
  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpenses;

  const incomeCount = transactions.filter((t) => t.type === 'INCOME').length;
  const expenseCount = transactions.filter((t) => t.type === 'EXPENSE').length;

  console.log('💰 Transactions created:');
  console.log(`   • ${incomeCount} income  transactions`);
  console.log(`   • ${expenseCount} expense transactions`);
  console.log(`   • ${transactions.length} total (spread over 4 months)\n`);

  console.log('📊 Financial summary:');
  console.log(`   • Total income:   $${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`   • Total expenses: $${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`   • Net balance:    $${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log();

  console.log('✅ Seed complete!\n');
  console.log('─────────────────────────────────────────────────────');
  console.log('🚀 To start the development server:');
  console.log('      npm run dev');
  console.log();
  console.log('📚 API documentation (after server starts):');
  console.log('      http://localhost:3000/api/docs');
  console.log();
  console.log('🔑 Login credentials:');
  console.log('      admin@finance.local       /  Admin@123456   (ADMIN)');
  console.log('      sarah.analyst@finance.local / Analyst@123456 (ANALYST)');
  console.log('      mike.analyst@finance.local  / Analyst@123456 (ANALYST)');
  console.log('      john.viewer@finance.local   / Viewer@123456  (VIEWER)');
  console.log('─────────────────────────────────────────────────────\n');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
