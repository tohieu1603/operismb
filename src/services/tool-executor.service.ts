/**
 * Tool Executor Service
 * Handles execution of AI-requested tools dynamically
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

class ToolExecutorService {
  /**
   * Execute multiple tool calls and return results
   */
  async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeSingleTool(toolCall);
        results.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        results.push({
          role: "tool", 
          content: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          }),
          tool_call_id: toolCall.id,
        });
      }
    }

    return results;
  }

  /**
   * Execute a single tool call dynamically
   */
  private async executeSingleTool(toolCall: ToolCall): Promise<any> {
    const { name } = toolCall.function;
    const args = JSON.parse(toolCall.function.arguments);

    console.log(`[tool] Executing ${name} with args:`, args);

    switch (name) {
      case "browser":
        return this.executeBrowserTool(args);
      
      case "exec":
        return this.executeExecTool(args);
      
      case "web_search":
        return this.executeWebSearchTool(args);
      
      case "file_read":
        return this.executeFileReadTool(args);
      
      case "file_write":
        return this.executeFileWriteTool(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Browser tool - open URLs, navigate
   */
  private async executeBrowserTool(args: any): Promise<any> {
    const { action, targetUrl } = args;

    if (!targetUrl) {
      throw new Error("targetUrl is required for browser tool");
    }

    // Sanitize URL
    let url = targetUrl.toString();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    try {
      // Use macOS 'open' command to open in default browser
      await execAsync(`open "${url}"`);
      
      console.log(`[browser] Opened: ${url}`);
      
      return {
        success: true,
        action,
        url,
        message: `Successfully opened ${url}`,
      };
    } catch (error) {
      throw new Error(`Failed to open browser: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Execute shell commands
   */
  private async executeExecTool(args: any): Promise<any> {
    const { command } = args;

    if (!command) {
      throw new Error("command is required for exec tool");
    }

    try {
      // Safety check - block potentially dangerous commands
      const dangerousCommands = ['rm -rf', 'sudo', 'passwd', 'shutdown', 'reboot'];
      if (dangerousCommands.some(cmd => command.includes(cmd))) {
        throw new Error(`Dangerous command blocked: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000, // 30s timeout
        maxBuffer: 1024 * 1024, // 1MB max output
      });

      return {
        success: true,
        command,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      };
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Web search tool (placeholder - integrate with real search API)
   */
  private async executeWebSearchTool(args: any): Promise<any> {
    const { query } = args;

    if (!query) {
      throw new Error("query is required for web_search tool");
    }

    // For now, just open Google search in browser
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.executeBrowserTool({ action: "open", targetUrl: searchUrl });
  }

  /**
   * File read tool
   */
  private async executeFileReadTool(args: any): Promise<any> {
    const { path } = args;

    if (!path) {
      throw new Error("path is required for file_read tool");
    }

    try {
      const { stdout } = await execAsync(`cat "${path}"`);
      return {
        success: true,
        path,
        content: stdout.toString(),
      };
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * File write tool
   */
  private async executeFileWriteTool(args: any): Promise<any> {
    const { path, content } = args;

    if (!path || content === undefined) {
      throw new Error("path and content are required for file_write tool");
    }

    try {
      // Use node.js to write file safely
      const fs = await import("node:fs/promises");
      await fs.writeFile(path, content, "utf8");
      
      return {
        success: true,
        path,
        message: `Successfully wrote to ${path}`,
      };
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Convert OpenAI tool calls to Anthropic tool_use blocks
   */
  toolCallsToBlocks(toolCalls: ToolCall[]): ToolUseBlock[] {
    return toolCalls.map(tc => ({
      type: "tool_use",
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || "{}"),
    }));
  }
}

export const toolExecutorService = new ToolExecutorService();