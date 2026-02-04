/**
 * Agent entry point - generates token, starts server, handles shutdown.
 */
import fs from 'fs'
import path from 'path'
import { generateToken } from './auth.js'
import { AgentServer } from './server.js'
import chalk from 'chalk'

const TOKEN_FILE = '.agent-token'

function writeToken(token: string) {
  const tokenPath = path.join(process.cwd(), TOKEN_FILE)
  fs.writeFileSync(tokenPath, token, 'utf-8')
}

function cleanupToken() {
  const tokenPath = path.join(process.cwd(), TOKEN_FILE)
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
    console.log(chalk.gray('Cleaned up token file'))
  }
}

function main() {
  console.log(chalk.bold.cyan('\n🤖 Gold Miner Agent\n'))

  // Generate and save token
  const token = generateToken()
  writeToken(token)
  console.log(chalk.green('Generated token:'), chalk.bold(token))
  console.log(chalk.gray(`Token saved to ${TOKEN_FILE}\n`))

  // Create and start server
  const server = new AgentServer(token)
  server.start()

  console.log(chalk.gray('\nPress Ctrl+C to stop\n'))

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log(chalk.yellow('\n\nShutting down...'))
    await server.stop()
    cleanupToken()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)
}

main()
