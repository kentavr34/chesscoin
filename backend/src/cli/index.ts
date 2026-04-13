#!/usr/bin/env node
import { Command } from 'commander';
import { userCommand } from './commands/user';
import { dbCommand } from './commands/db';
import { systemCommand } from './commands/system';

const program = new Command();

program
  .name('chesscoin-cli')
  .description('CLI для административных задач ChessCoin')
  .version('1.0.0');

program.addCommand(userCommand);
program.addCommand(dbCommand);
program.addCommand(systemCommand);

program.parse();
