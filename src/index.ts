#!/usr/bin/env bun
import { Command } from "commander";
import { AgentEconomy } from "./economy";
import { TaskStatus } from "./types";

const economy = new AgentEconomy();
const program = new Command();

program
  .name("agent-economy")
  .description("Token-based economy for AI agent services")
  .version("1.0.0");

program
  .command("register")
  .description("Register a new agent")
  .argument("<name>", "Agent name")
  .option("-b, --balance <number>", "Initial balance", "1000")
  .action((name, options) => {
    const agent = economy.registerAgent(name, parseFloat(options.balance));
    console.log(`Agent registered: ${agent.name} (ID: ${agent.id}) Balance: ${agent.balance}`);
  });

program
  .command("balance")
  .description("Check agent balance")
  .argument("<agentId>", "Agent ID")
  .action((agentId) => {
    const agent = economy.getAgentState(agentId);
    if (agent) {
      console.log(`Agent: ${agent.name} | Balance: ${agent.balance} | Reputation: ${agent.reputation}`);
    } else {
      console.error("Agent not found");
    }
  });

program
  .command("create-task")
  .description("Create a new task")
  .requiredOption("-a, --agent <id>", "Creator Agent ID")
  .requiredOption("-t, --title <string>", "Task Title")
  .requiredOption("-d, --desc <string>", "Task Description")
  .requiredOption("-b, --budget <number>", "Task Budget")
  .action((options) => {
    try {
      const task = economy.createTask(
        options.agent,
        options.title,
        options.desc,
        parseFloat(options.budget)
      );
      console.log(`Task created: ${task.id} Status: ${task.status}`);
    } catch (e: any) {
      console.error(`Failed to create task: ${e.message}`);
    }
  });

program
  .command("bid")
  .description("Submit a bid for a task")
  .requiredOption("-t, --task <id>", "Task ID")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .requiredOption("-m, --amount <number>", "Bid Amount")
  .requiredOption("-p, --proposal <string>", "Proposal Details")
  .action((options) => {
    try {
      const bid = economy.submitBid(
        options.task,
        options.agent,
        parseFloat(options.amount),
        options.proposal
      );
      console.log(`Bid submitted: ${bid.id} Status: ${bid.status}`);
    } catch (e: any) {
      console.error(`Failed to submit bid: ${e.message}`);
    }
  });

program
  .command("accept")
  .description("Accept a bid for a task")
  .argument("<taskId>", "Task ID")
  .argument("<bidId>", "Bid ID")
  .action((taskId, bidId) => {
    try {
      economy.acceptBid(taskId, bidId);
      console.log("Bid accepted successfully");
    } catch (e: any) {
      console.error(`Failed to accept bid: ${e.message}`);
    }
  });

program
  .command("complete")
  .description("Mark a task as completed")
  .argument("<taskId>", "Task ID")
  .action((taskId) => {
    try {
      economy.completeTask(taskId);
      console.log("Task completed and funds released");
    } catch (e: any) {
      console.error(`Failed to complete task: ${e.message}`);
    }
  });

program
  .command("tasks")
  .description("List all tasks")
  .option("-s, --status <status>", "Filter by status")
  .action((options) => {
    const tasks = economy.listTasks(options.status);
    console.table(tasks.map(t => ({
      id: t.id,
      title: t.title,
      budget: t.budget,
      status: t.status,
      creator: t.creatorId
    })));
  });

program
  .command("history")
  .description("Show agent transaction history")
  .argument("<agentId>", "Agent ID")
  .action((agentId) => {
    const history = economy.getAgentHistory(agentId);
    console.table(history.map(tx => ({
      type: tx.type,
      amount: tx.amount,
      from: tx.fromId,
      to: tx.toId,
      date: new Date(tx.createdAt).toLocaleString()
    })));
  });

program
  .command("bids")
  .description("List bids for a task")
  .argument("<taskId>", "Task ID")
  .action((taskId) => {
    const bids = economy.getTaskBids(taskId);
    console.table(bids.map(b => ({
      id: b.id,
      agent: b.agentId,
      amount: b.amount,
      status: b.status
    })));
  });

program.parse();
