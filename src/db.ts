import { Database } from "bun:sqlite";
import type { Agent, Task, Bid, Escrow, Transaction } from "./types";

export class EconomyDB {
  private db: Database;

  constructor(path: string = "economy.db") {
    this.db = new Database(path);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reputation REAL DEFAULT 100,
        balance REAL DEFAULT 0,
        createdAt INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        creatorId TEXT NOT NULL,
        workerId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        budget REAL NOT NULL,
        status TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        completedAt INTEGER,
        FOREIGN KEY(creatorId) REFERENCES agents(id),
        FOREIGN KEY(workerId) REFERENCES agents(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS bids (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        amount REAL NOT NULL,
        proposal TEXT,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(taskId) REFERENCES tasks(id),
        FOREIGN KEY(agentId) REFERENCES agents(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS escrow (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(taskId) REFERENCES tasks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        fromId TEXT NOT NULL,
        toId TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        relatedId TEXT,
        createdAt INTEGER NOT NULL
      )
    `);
  }

  // Agent methods
  saveAgent(agent: Agent) {
    this.db.run(
      "INSERT OR REPLACE INTO agents (id, name, reputation, balance, createdAt) VALUES (?, ?, ?, ?, ?)",
      [agent.id, agent.name, agent.reputation, agent.balance, agent.createdAt]
    );
  }

  getAgent(id: string): Agent | null {
    return this.db.query("SELECT * FROM agents WHERE id = ?").get(id) as Agent | null;
  }

  updateBalance(id: string, amount: number) {
    this.db.run("UPDATE agents SET balance = balance + ? WHERE id = ?", [amount, id]);
  }

  // Task methods
  saveTask(task: Task) {
    this.db.run(
      "INSERT OR REPLACE INTO tasks (id, creatorId, workerId, title, description, budget, status, deadline, createdAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [task.id, task.creatorId, task.workerId, task.title, task.description, task.budget, task.status, task.deadline, task.createdAt, task.completedAt]
    );
  }

  getTask(id: string): Task | null {
    return this.db.query("SELECT * FROM tasks WHERE id = ?").get(id) as Task | null;
  }

  // Bid methods
  saveBid(bid: Bid) {
    this.db.run(
      "INSERT OR REPLACE INTO bids (id, taskId, agentId, amount, proposal, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [bid.id, bid.taskId, bid.agentId, bid.amount, bid.proposal, bid.status, bid.createdAt]
    );
  }

  getBidsForTask(taskId: string): Bid[] {
    return this.db.query("SELECT * FROM bids WHERE taskId = ?").all(taskId) as Bid[];
  }

  // Task listing
  getTasks(status?: TaskStatus): Task[] {
    if (status) {
      return this.db.query("SELECT * FROM tasks WHERE status = ?").all(status) as Task[];
    }
    return this.db.query("SELECT * FROM tasks").all() as Task[];
  }

  getTasksByAgent(agentId: string, role: "creator" | "worker"): Task[] {
    const column = role === "creator" ? "creatorId" : "workerId";
    return this.db.query(`SELECT * FROM tasks WHERE ${column} = ?`).all(agentId) as Task[];
  }

  // Transaction history
  getTransactions(agentId: string): Transaction[] {
    return this.db.query("SELECT * FROM transactions WHERE fromId = ? OR toId = ? ORDER BY createdAt DESC").all(agentId, agentId) as Transaction[];
  }

  // Transaction methods
  saveTransaction(tx: Transaction) {
    this.db.run(
      "INSERT INTO transactions (id, fromId, toId, amount, type, relatedId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tx.id, tx.fromId, tx.toId, tx.amount, tx.type, tx.relatedId, tx.createdAt]
    );
  }
}
