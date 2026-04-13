import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

export const userCommand = new Command('user')
  .description('Управление пользователями')
  .addCommand(
    new Command('list')
      .description('Список пользователей')
      .option('-l, --limit <number>', 'Количество записей', '10')
      .option('-o, --offset <number>', 'Смещение', '0')
      .action(async (options) => {
        try {
          const users = await prisma.user.findMany({
            take: parseInt(options.limit),
            skip: parseInt(options.offset),
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              isActive: true,
              isAdmin: true,
              createdAt: true,
            },
          });
          console.table(users);
          console.log(`Всего: ${users.length}`);
        } catch (error) {
          console.error('Ошибка при получении пользователей:', error);
          process.exit(1);
        } finally {
          await prisma.$disconnect();
        }
      })
  )
  .addCommand(
    new Command('create')
      .description('Создать нового пользователя')
      .requiredOption('-f, --firstName <string>', 'Имя')
      .requiredOption('-l, --lastName <string>', 'Фамилия')
      .option('-u, --username <string>', 'Имя пользователя')
      .requiredOption('-e, --email <string>', 'Email')
      .requiredOption('-p, --password <string>', 'Пароль')
      .option('--admin', 'Сделать администратором', false)
      .action(async (options) => {
        try {
          const hashedPassword = await hash(options.password, 10);
          const user = await prisma.user.create({
            data: {
              firstName: options.firstName,
              lastName: options.lastName,
              username: options.username,
              email: options.email,
              password: hashedPassword,
              isAdmin: options.admin,
              isActive: true,
            },
          });
          console.log('Пользователь создан:', {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
          });
        } catch (error) {
          console.error('Ошибка при создании пользователя:', error);
          process.exit(1);
        } finally {
          await prisma.$disconnect();
        }
      })
  )
  .addCommand(
    new Command('block')
      .description('Заблокировать пользователя')
      .requiredOption('-i, --id <string>', 'ID пользователя')
      .action(async (options) => {
        try {
          const user = await prisma.user.update({
            where: { id: options.id },
            data: { isActive: false },
          });
          console.log('Пользователь заблокирован:', user.email);
        } catch (error) {
          console.error('Ошибка при блокировке пользователя:', error);
          process.exit(1);
        } finally {
          await prisma.$disconnect();
        }
      })
  )
  .addCommand(
    new Command('unblock')
      .description('Разблокировать пользователя')
      .requiredOption('-i, --id <string>', 'ID пользователя')
      .action(async (options) => {
        try {
          const user = await prisma.user.update({
            where: { id: options.id },
            data: { isActive: true },
          });
          console.log('Пользователь разблокирован:', user.email);
        } catch (error) {
          console.error('Ошибка при разблокировке пользователя:', error);
          process.exit(1);
        } finally {
          await prisma.$disconnect();
        }
      })
  );
