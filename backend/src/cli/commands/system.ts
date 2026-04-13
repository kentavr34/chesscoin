import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export const systemCommand = new Command('system')
  .description('Проверка состояния системы')
  .addCommand(
    new Command('health')
      .description('Проверить здоровье системы')
      .action(async () => {
        console.log('=== Проверка здоровья системы ===');
        
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = (usedMem / totalMem) * 100;
        console.log(`💾 Память: ${Math.round(memUsagePercent)}% использовано (${Math.round(usedMem / 1024 / 1024)} MB / ${Math.round(totalMem / 1024 / 1024)} MB)`);
        
        const loadAvg = os.loadavg();
        console.log(`⚡ Нагрузка CPU (1/5/15 мин): ${loadAvg[0].toFixed(2)} / ${loadAvg[1].toFixed(2)} / ${loadAvg[2].toFixed(2)}`);
        
        try {
          await prisma.$queryRaw`SELECT 1 as status`;
          console.log('✅ База данных: доступна');
        } catch (error) {
          console.log('❌ База данных: недоступна', error);
        }
        
        try {
          const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
          const redisClient = createClient({ url: redisUrl });
          await redisClient.connect();
          await redisClient.ping();
          console.log('✅ Redis: доступен');
          await redisClient.quit();
        } catch (error) {
          console.log('❌ Redis: недоступен', error);
        }
        
        try {
          const { stdout } = await execAsync('df -h /');
          console.log('💿 Дисковое пространство:');
          console.log(stdout);
        } catch (error) {
          console.log('❌ Не удалось проверить дисковое пространство');
        }
        
        await prisma.$disconnect();
      })
  )
  .addCommand(
    new Command('metrics')
      .description('Показать метрики системы')
      .action(async () => {
        console.log('=== Метрики системы ===');
        
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUsers = await prisma.user.count({
          where: {
            lastSeen: {
              gte: twentyFourHoursAgo,
            },
          },
        });
        console.log(`👥 Активных пользователей (24ч): ${activeUsers}`);
        
        const activeGames = await prisma.gameSession.count({
          where: {
            status: 'IN_PROGRESS',
          },
        });
        console.log(`🎮 Активных игр: ${activeGames}`);
        
        const totalBalance = await prisma.$queryRaw<{ sum: bigint }[]>`SELECT SUM(balance) as sum FROM "User"`;
        const balance = totalBalance[0]?.sum || BigInt(0);
        console.log(`💰 Общий баланс пользователей: ${balance} монет`);
        
        await prisma.$disconnect();
      })
  );
