export enum TaskStatus {
  OPEN = "OPEN",
  BIDDING = "BIDDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  DISPUTED = "DISPUTED",
  CANCELLED = "CANCELLED",
}

export enum BidStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

export interface Agent {
  id: string;
  name: string;
  reputation: number;
  balance: number;
  createdAt: number;
}

export interface Task {
  id: string;
  creatorId: string;
  workerId?: string;
  title: string;
  description: string;
  budget: number;
  status: TaskStatus;
  deadline: number;
  createdAt: number;
  completedAt?: number;
}

export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  proposal: string;
  status: BidStatus;
  createdAt: number;
}

export interface Escrow {
  id: string;
  taskId: string;
  amount: number;
  status: "LOCKED" | "RELEASED" | "REFUNDED";
  createdAt: number;
}

export interface Transaction {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  type: "PAYMENT" | "ESCROW_LOCK" | "ESCROW_RELEASE" | "ESCROW_REFUND" | "REWARD" | "PENALTY";
  relatedId?: string; // taskId or escrowId
  createdAt: number;
}
