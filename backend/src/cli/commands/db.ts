import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export const dbCommand = new Command('db')
  .description('Команды для работы с базой данных')
  .addCommand(
    new Command('migrate')
      .description('Выполнить миграции')
      .option('--name <string>', 'Имя миграции')
      .action(async (options) => {
        try {
          const command = options.name 
            ? `npx prisma migrate dev --name ${options.name}`
            : 'npx prisma migrate deploy';
          console.log('Выполнение команды:', command);
          const { stdout, stderr } = await execAsync(command);
          console.log(stdout);
          if (stderr) console.error(stderr);
        } catch (error) {
          console.error('Ошибка при выполнении миграции:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('backup')
      .description('Создать резервную копию базы данных')
      .option('-o, --output <path>', 'Путь для сохранения бэкапа', './backup.sql')
      .action(async (options) => {
        try {
          const databaseUrl = process.env.DATABASE_URL;
          if (!databaseUrl) {
            throw new Error('DATABASE_URL не установлен');
          }
          const url = new URL(databaseUrl);
          const host = url.hostname;
          const port = url.port || '5432';
          const database = url.pathname.slice(1);
          const username = url.username;
          const password = url.password;
          
          const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -f ${options.output}`;
          console.log('Создание резервной копии...');
          const { stdout, stderr } = await execAsync(command);
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          console.log(`Резервная копия сохранена в: ${options.output}`);
        } catch (error) {
          console.error('Ошибка при создании резервной копии:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Проверить состояние базы данных')
      .action(async () => {
        try {
          await prisma.$queryRaw`SELECT 1 as status`;
          console.log('✅ База данных доступна');
          
          const userCount = await prisma.user.count();
          console.log(`👥 Пользователей: ${userCount}`);
          
          const gameCount = await prisma.gameSession.count();
          console.log(`🎮 Игровых сессий: ${gameCount}`);
        } catch (error) {
          console.error('❌ Ошибка подключения к базе данных:', error);
          process.exit(1);
        } finally {
          await prisma.$disconnect();
        }
      })
  );
