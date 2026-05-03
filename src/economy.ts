import { EconomyDB } from "./db";
import { TaskStatus, BidStatus, type Agent, type Task, type Bid, type Transaction } from "./types";
import { randomUUID } from "crypto";

export class AgentEconomy {
  private db: EconomyDB;

  constructor(dbPath?: string) {
    this.db = new EconomyDB(dbPath);
  }

  /**
   * Register a new agent in the economy
   */
  registerAgent(name: string, initialBalance: number = 1000): Agent {
    const agent: Agent = {
      id: `agent_${randomUUID().split("-")[0]}`,
      name,
      reputation: 100,
      balance: initialBalance,
      createdAt: Date.now(),
    };
    this.db.saveAgent(agent);
    console.log(`[Economy] Registered agent: ${agent.name} (${agent.id})`);
    return agent;
  }

  /**
   * Create a new task in the economy
   */
  createTask(creatorId: string, title: string, description: string, budget: number, deadlineInHours: number = 24): Task {
    const agent = this.db.getAgent(creatorId);
    if (!agent) throw new Error("Agent not found");
    if (agent.balance < budget) throw new Error("Insufficient balance to create task");

    const task: Task = {
      id: `task_${randomUUID().split("-")[0]}`,
      creatorId,
      title,
      description,
      budget,
      status: TaskStatus.OPEN,
      deadline: Date.now() + (deadlineInHours * 60 * 60 * 1000),
      createdAt: Date.now(),
    };

    // Lock funds in escrow
    this.db.updateBalance(creatorId, -budget);
    this.db.saveTask(task);
    
    this.recordTransaction(creatorId, "SYSTEM_ESCROW", budget, "ESCROW_LOCK", task.id);
    
    console.log(`[Economy] Task created: ${task.title} by ${agent.name}`);
    return task;
  }

  /**
   * Submit a bid for an open task
   */
  submitBid(taskId: string, agentId: string, amount: number, proposal: string): Bid {
    const task = this.db.getTask(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.OPEN && task.status !== TaskStatus.BIDDING) {
      throw new Error("Task is not open for bidding");
    }

    const agent = this.db.getAgent(agentId);
    if (!agent) throw new Error("Agent not found");

    const bid: Bid = {
      id: `bid_${randomUUID().split("-")[0]}`,
      taskId,
      agentId,
      amount,
      proposal,
      status: BidStatus.PENDING,
      createdAt: Date.now(),
    };

    this.db.saveBid(bid);
    
    if (task.status === TaskStatus.OPEN) {
      task.status = TaskStatus.BIDDING;
      this.db.saveTask(task);
    }

    console.log(`[Economy] Bid submitted for task ${taskId} by ${agent.name}: ${amount} tokens`);
    return bid;
  }

  /**
   * Accept a bid for a task
   */
  acceptBid(taskId: string, bidId: string): void {
    const task = this.db.getTask(taskId);
    if (!task) throw new Error("Task not found");
    
    const bids = this.db.getBidsForTask(taskId);
    const bid = bids.find(b => b.id === bidId);
    if (!bid) throw new Error("Bid not found");

    // Update task
    task.status = TaskStatus.IN_PROGRESS;
    task.workerId = bid.agentId;
    this.db.saveTask(task);

    // Update bids
    for (const b of bids) {
      b.status = b.id === bidId ? BidStatus.ACCEPTED : BidStatus.REJECTED;
      this.db.saveBid(b);
    }

    // Adjust escrow if bid amount is different from budget
    if (bid.amount !== task.budget) {
      const diff = task.budget - bid.amount;
      if (diff > 0) {
        // Refund excess to creator
        this.db.updateBalance(task.creatorId, diff);
        this.recordTransaction("SYSTEM_ESCROW", task.creatorId, diff, "ESCROW_REFUND", task.id);
      } else {
        // Charge creator more (if they have it)
        const creator = this.db.getAgent(task.creatorId);
        if (!creator || creator.balance < Math.abs(diff)) {
          throw new Error("Creator has insufficient funds for the accepted bid amount");
        }
        this.db.updateBalance(task.creatorId, diff);
        this.recordTransaction(task.creatorId, "SYSTEM_ESCROW", Math.abs(diff), "ESCROW_LOCK", task.id);
      }
    }

    console.log(`[Economy] Bid accepted for task ${task.title}. Worker: ${bid.agentId}`);
  }

  /**
   * Complete a task and release funds
   */
  completeTask(taskId: string): void {
    const task = this.db.getTask(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.IN_PROGRESS) throw new Error("Task is not in progress");
    if (!task.workerId) throw new Error("No worker assigned to task");

    const bids = this.db.getBidsForTask(taskId);
    const acceptedBid = bids.find(b => b.status === BidStatus.ACCEPTED);
    if (!acceptedBid) throw new Error("No accepted bid found");

    task.status = TaskStatus.COMPLETED;
    task.completedAt = Date.now();
    this.db.saveTask(task);

    // Release funds to worker
    this.db.updateBalance(task.workerId, acceptedBid.amount);
    this.recordTransaction("SYSTEM_ESCROW", task.workerId, acceptedBid.amount, "ESCROW_RELEASE", task.id);

    // Update reputation
    this.updateAgentReputation(task.workerId, true, acceptedBid.amount);
    this.updateAgentReputation(task.creatorId, true, acceptedBid.amount / 10);

    console.log(`[Economy] Task completed: ${task.title}. ${acceptedBid.amount} tokens released to ${task.workerId}`);
  }

  /**
   * Raise a dispute for a task
   */
  disputeTask(taskId: string, reason: string): void {
    const task = this.db.getTask(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.IN_PROGRESS) throw new Error("Only in-progress tasks can be disputed");

    task.status = TaskStatus.DISPUTED;
    this.db.saveTask(task);
    console.log(`[Economy] Task ${taskId} entered DISPUTE status. Reason: ${reason}`);
  }

  /**
   * Resolve a dispute
   */
  resolveDispute(taskId: string, winnerId: string, percentage: number = 100): void {
    const task = this.db.getTask(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.DISPUTED) throw new Error("Task is not in dispute");

    if (winnerId !== task.creatorId && winnerId !== task.workerId) {
      throw new Error("Winner must be creator or worker");
    }

    const bids = this.db.getBidsForTask(taskId);
    const acceptedBid = bids.find(b => b.status === BidStatus.ACCEPTED);
    if (!acceptedBid) throw new Error("No accepted bid found");

    const winnerAmount = (acceptedBid.amount * percentage) / 100;
    const loserAmount = acceptedBid.amount - winnerAmount;

    if (winnerId === task.workerId) {
      // Worker wins some or all
      this.db.updateBalance(task.workerId, winnerAmount);
      this.recordTransaction("SYSTEM_ESCROW", task.workerId, winnerAmount, "ESCROW_RELEASE", task.id);
      
      if (loserAmount > 0) {
        this.db.updateBalance(task.creatorId, loserAmount);
        this.recordTransaction("SYSTEM_ESCROW", task.creatorId, loserAmount, "ESCROW_REFUND", task.id);
      }
      
      this.updateAgentReputation(task.workerId, percentage > 50, acceptedBid.amount);
    } else {
      // Creator wins some or all
      this.db.updateBalance(task.creatorId, winnerAmount);
      this.recordTransaction("SYSTEM_ESCROW", task.creatorId, winnerAmount, "ESCROW_REFUND", task.id);

      if (loserAmount > 0 && task.workerId) {
        this.db.updateBalance(task.workerId, loserAmount);
        this.recordTransaction("SYSTEM_ESCROW", task.workerId, loserAmount, "ESCROW_RELEASE", task.id);
      }
      
      if (task.workerId) {
        this.updateAgentReputation(task.workerId, false, acceptedBid.amount);
      }
    }

    task.status = TaskStatus.FAILED;
    this.db.saveTask(task);
    console.log(`[Economy] Dispute resolved for ${taskId}. Winner: ${winnerId} received ${winnerAmount} tokens.`);
  }

  private updateAgentReputation(agentId: string, success: boolean, amount: number) {
    const agent = this.db.getAgent(agentId);
    if (!agent) return;

    const change = success ? 1 * Math.log10(amount + 1) : -5 * Math.log10(amount + 1);
    agent.reputation = Math.max(0, Math.min(1000, agent.reputation + change));
    this.db.saveAgent(agent);
  }

  private recordTransaction(fromId: string, toId: string, amount: number, type: Transaction["type"], relatedId?: string) {
    const tx: Transaction = {
      id: `tx_${randomUUID().split("-")[0]}`,
      fromId,
      toId,
      amount,
      type,
      relatedId,
      createdAt: Date.now(),
    };
    this.db.saveTransaction(tx);
  }

  getAgentState(agentId: string) {
    return this.db.getAgent(agentId);
  }

  listTasks(status?: TaskStatus) {
    return this.db.getTasks(status);
  }

  getAgentTasks(agentId: string, role: "creator" | "worker" = "worker") {
    return this.db.getTasksByAgent(agentId, role);
  }

  getAgentHistory(agentId: string) {
    return this.db.getTransactions(agentId);
  }

  getTaskBids(taskId: string) {
    return this.db.getBidsForTask(taskId);
  }
}
