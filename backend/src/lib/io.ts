/**
 * src/lib/io.ts
 * BUG-01 fix: Выносим io в отдельный файл чтобы разорвать circular dependency
 * index.ts → tournaments.ts → index.ts
 *
 * Использование:
 *   import { getIo, setIo } from "@/lib/io";
 *   // В index.ts после создания: setIo(ioInstance);
 *   // В routes: const io = getIo();
 */

import type { Server } from "socket.io";

let _io: Server | null = null;

export const setIo = (io: Server) => {
  _io = io;
};

export const getIo = (): Server => {
  if (!_io) throw new Error("[io] Socket.io не инициализирован. Вызови setIo() в index.ts");
  return _io;
};
