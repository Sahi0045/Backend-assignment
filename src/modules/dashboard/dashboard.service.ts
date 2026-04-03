import prisma from "../../config/database";
import { TransactionType } from "../../types/enums";

interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

class DashboardService {
  /**
   * Overall financial summary
   */
  async getSummary(filter: DateRangeFilter = {}) {
    const dateWhere = this.buildDateWhere(filter);

    const [incomeAgg, expenseAgg, transactionCount, recentTransactions] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: {
            type: TransactionType.INCOME,
            isDeleted: false,
            ...dateWhere,
          },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            type: TransactionType.EXPENSE,
            isDeleted: false,
            ...dateWhere,
          },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true },
        }),
        prisma.transaction.count({ where: { isDeleted: false, ...dateWhere } }),
        prisma.transaction.findMany({
          where: { isDeleted: false },
          orderBy: { date: "desc" },
          take: 5,
          select: {
            id: true,
            amount: true,
            type: true,
            category: true,
            date: true,
            notes: true,
            createdBy: { select: { name: true } },
          },
        }),
      ]);

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    return {
      overview: {
        totalIncome: this.round(totalIncome),
        totalExpenses: this.round(totalExpenses),
        netBalance: this.round(netBalance),
        savingsRate: this.round(savingsRate),
        transactionCount,
      },
      income: {
        total: this.round(totalIncome),
        count: incomeAgg._count.id,
        average: this.round(incomeAgg._avg.amount ?? 0),
      },
      expenses: {
        total: this.round(totalExpenses),
        count: expenseAgg._count.id,
        average: this.round(expenseAgg._avg.amount ?? 0),
      },
      recentTransactions,
      ...(filter.startDate || filter.endDate ? { period: filter } : {}),
    };
  }

  /**
   * Category-wise breakdown of income and expenses
   */
  async getCategoryBreakdown(
    filter: DateRangeFilter & { type?: TransactionType } = {},
  ) {
    const { type, ...dateFilter } = filter;
    const dateWhere = this.buildDateWhere(dateFilter);

    const baseWhere = {
      isDeleted: false,
      ...dateWhere,
      ...(type ? { type } : {}),
    };

    const [categoryGroups, totalAgg] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["category", "type"],
        where: baseWhere,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
        _max: { amount: true },
        _min: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.transaction.aggregate({
        where: baseWhere,
        _sum: { amount: true },
      }),
    ]);

    const grandTotal = totalAgg._sum.amount ?? 0;

    const breakdown = categoryGroups.map((group) => ({
      category: group.category,
      type: group.type,
      total: this.round(group._sum.amount ?? 0),
      count: group._count.id,
      average: this.round(group._avg.amount ?? 0),
      max: this.round(group._max.amount ?? 0),
      min: this.round(group._min.amount ?? 0),
      percentage:
        grandTotal > 0
          ? this.round(((group._sum.amount ?? 0) / grandTotal) * 100)
          : 0,
    }));

    // Group by type
    const byIncome = breakdown.filter((b) => b.type === TransactionType.INCOME);
    const byExpense = breakdown.filter(
      (b) => b.type === TransactionType.EXPENSE,
    );

    return {
      all: breakdown,
      income: byIncome,
      expenses: byExpense,
      topIncomeCategory: byIncome[0] ?? null,
      topExpenseCategory: byExpense[0] ?? null,
    };
  }

  /**
   * Monthly trends for the last N months
   */
  async getMonthlyTrends(months: number = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        isDeleted: false,
        date: { gte: startDate },
      },
      select: {
        amount: true,
        type: true,
        date: true,
      },
      orderBy: { date: "asc" },
    });

    // Group by year-month
    const monthMap = new Map<
      string,
      { income: number; expense: number; count: number }
    >();

    transactions.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { income: 0, expense: 0, count: 0 });
      }
      const entry = monthMap.get(key)!;
      entry.count++;
      if (t.type === TransactionType.INCOME) {
        entry.income += t.amount;
      } else {
        entry.expense += t.amount;
      }
    });

    const trends = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [year, m] = month.split("-");
        return {
          month,
          year: parseInt(year!, 10),
          monthNumber: parseInt(m!, 10),
          monthName: new Date(
            parseInt(year!, 10),
            parseInt(m!, 10) - 1,
            1,
          ).toLocaleString("en-US", {
            month: "long",
          }),
          income: this.round(data.income),
          expenses: this.round(data.expense),
          netBalance: this.round(data.income - data.expense),
          transactionCount: data.count,
        };
      });

    // Calculate growth rates
    const trendsWithGrowth = trends.map((t, i) => {
      if (i === 0) return { ...t, incomeGrowth: null, expenseGrowth: null };
      const prev = trends[i - 1]!;
      return {
        ...t,
        incomeGrowth:
          prev.income > 0
            ? this.round(((t.income - prev.income) / prev.income) * 100)
            : null,
        expenseGrowth:
          prev.expenses > 0
            ? this.round(((t.expenses - prev.expenses) / prev.expenses) * 100)
            : null,
      };
    });

    return {
      trends: trendsWithGrowth,
      period: {
        from: startDate.toISOString().slice(0, 7),
        to: new Date().toISOString().slice(0, 7),
        months,
      },
      summary: {
        avgMonthlyIncome: this.round(
          trends.reduce((s, t) => s + t.income, 0) / (trends.length || 1),
        ),
        avgMonthlyExpenses: this.round(
          trends.reduce((s, t) => s + t.expenses, 0) / (trends.length || 1),
        ),
        bestIncomeMonth: trends.reduce(
          (best, t) => (t.income > (best?.income ?? 0) ? t : best),
          trends[0] ?? null,
        ),
        highestExpenseMonth: trends.reduce(
          (worst, t) => (t.expenses > (worst?.expenses ?? 0) ? t : worst),
          trends[0] ?? null,
        ),
      },
    };
  }

  /**
   * Weekly breakdown for current month
   */
  async getWeeklyTrends() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const transactions = await prisma.transaction.findMany({
      where: {
        isDeleted: false,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { amount: true, type: true, date: true },
      orderBy: { date: "asc" },
    });

    // Group into weeks
    const weekMap = new Map<
      number,
      { income: number; expense: number; count: number }
    >();

    transactions.forEach((t) => {
      const weekNum = Math.ceil(t.date.getDate() / 7);
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, { income: 0, expense: 0, count: 0 });
      }
      const entry = weekMap.get(weekNum)!;
      entry.count++;
      if (t.type === TransactionType.INCOME) {
        entry.income += t.amount;
      } else {
        entry.expense += t.amount;
      }
    });

    const weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, data]) => ({
        week,
        label: `Week ${week}`,
        income: this.round(data.income),
        expenses: this.round(data.expense),
        netBalance: this.round(data.income - data.expense),
        transactionCount: data.count,
      }));

    return {
      currentMonth: now.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
      weeks,
    };
  }

  /**
   * Recent activity feed
   */
  async getRecentActivity(limit: number = 20) {
    const transactions = await prisma.transaction.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      select: {
        id: true,
        amount: true,
        type: true,
        category: true,
        date: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return {
      count: transactions.length,
      transactions,
    };
  }

  /**
   * Cash flow analysis
   */
  async getCashFlow(filter: DateRangeFilter = {}) {
    const dateWhere = this.buildDateWhere(filter);

    const transactions = await prisma.transaction.findMany({
      where: { isDeleted: false, ...dateWhere },
      select: { amount: true, type: true, date: true },
      orderBy: { date: "asc" },
    });

    // Running balance calculation
    let runningBalance = 0;
    const cashFlow = transactions.map((t) => {
      const delta = t.type === TransactionType.INCOME ? t.amount : -t.amount;
      runningBalance += delta;
      return {
        date: t.date,
        type: t.type,
        amount: this.round(t.amount),
        delta: this.round(delta),
        balance: this.round(runningBalance),
      };
    });

    return {
      cashFlow,
      finalBalance: this.round(runningBalance),
      period: filter,
    };
  }

  private buildDateWhere(filter: DateRangeFilter) {
    if (!filter.startDate && !filter.endDate) return {};
    return {
      date: {
        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
        ...(filter.endDate ? { lte: new Date(filter.endDate) } : {}),
      },
    };
  }

  private round(num: number, decimals: number = 2): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

export const dashboardService = new DashboardService();
