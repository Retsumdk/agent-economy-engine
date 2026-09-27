import { describe, test, expect, afterAll } from "bun:test";
import { rmSync } from "fs";
import { AgentEconomy } from "../src/economy";
import { formatTokens, calculateReputationImpact, isTaskExpired, generateSlug } from "../src/utils";

const dbPath = `/tmp/economy-engine-test-${Date.now()}.db`;
const economy = new AgentEconomy(dbPath);

afterAll(() => {
  try { rmSync(dbPath, { force: true }); } catch {}
});

describe("utils", () => {
  test("formatTokens renders amounts with two decimals", () => {
    expect(formatTokens(1500)).toBe("1500.00 tokens");
  });

  test("reputation impact rewards success and penalizes failure", () => {
    expect(calculateReputationImpact(true, 100)).toBeGreaterThan(0);
    expect(calculateReputationImpact(false, 100)).toBeLessThan(0);
  });

  test("generateSlug normalizes arbitrary text", () => {
    expect(generateSlug("  Deploy the Staging Server! ")).toBe("deploy-the-staging-server");
  });

  test("isTaskExpired compares against the current clock", () => {
    expect(isTaskExpired(Date.now() - 1000)).toBe(true);
    expect(isTaskExpired(Date.now() + 60_000)).toBe(false);
  });
});

describe("AgentEconomy", () => {
  test("registerAgent creates an account with the initial balance", () => {
    const creator = economy.registerAgent("creator", 500);
    const worker = economy.registerAgent("worker", 0);

    expect(economy.getAgentState(creator.id)?.balance).toBe(500);
    expect(economy.getAgentState(worker.id)?.balance).toBe(0);
  });

  test("creating a task locks the budget in escrow", () => {
    const creator = economy.registerAgent("escrow-tester", 100);
    const task = economy.createTask(creator.id, "Summarize a paper", "Full summary", 40);

    expect(task.status).toBe("OPEN");
    expect(economy.getAgentState(creator.id)?.balance).toBe(60);
  });

  test("rejects tasks the creator cannot fund", () => {
    const broke = economy.registerAgent("broke-agent", 10);
    expect(() => economy.createTask(broke.id, "Too expensive", "No funds", 500)).toThrow("Insufficient balance");
  });

  test("full lifecycle: bid, accept, complete pays the worker", () => {
    const creator = economy.registerAgent("lifecycle-creator", 200);
    const worker = economy.registerAgent("lifecycle-worker", 0);
    const task = economy.createTask(creator.id, "Translate docs", "EN -> FR", 50);

    const bid = economy.submitBid(task.id, worker.id, 50, "I can do this");
    expect(bid.status).toBe("PENDING");

    economy.acceptBid(task.id, bid.id);
    expect(economy.listTasks().find(t => t.id === task.id)?.status).toBe("IN_PROGRESS");

    economy.completeTask(task.id);
    const state = economy.getAgentState(worker.id);
    expect(state?.balance).toBe(50);
    expect(state?.reputation).toBeGreaterThan(100);
    expect(economy.listTasks().find(t => t.id === task.id)?.status).toBe("COMPLETED");
  });

  test("accepting a cheaper bid refunds the difference to the creator", () => {
    const creator = economy.registerAgent("refund-creator", 100);
    const worker = economy.registerAgent("refund-worker", 0);
    const task = economy.createTask(creator.id, "Cheap job", "Small task", 30);

    const bid = economy.submitBid(task.id, worker.id, 20, "Cheaper offer");
    economy.acceptBid(task.id, bid.id);

    expect(economy.getAgentState(creator.id)?.balance).toBe(80);
  });
});
