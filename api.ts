import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type TodoRow = {
  id: number | string;
  title?: string | null;
  task?: string | null;
  [key: string]: unknown;
};

export async function listTodos(): Promise<TodoRow[]> {
  return prisma.$queryRaw<TodoRow[]>`SELECT * FROM todos ORDER BY id DESC`;
}

export async function createTodo(text: string): Promise<TodoRow> {
  const value = text.trim();
  if (!value) {
    throw new Error("Todo text is required");
  }

  try {
    const byTitle = await prisma.$queryRaw<TodoRow[]>`
      INSERT INTO todos (title)
      VALUES (${value})
      RETURNING *
    `;
    return byTitle[0];
  } catch {
    const byTask = await prisma.$queryRaw<TodoRow[]>`
      INSERT INTO todos (task)
      VALUES (${value})
      RETURNING *
    `;
    return byTask[0];
  }
}

export async function deleteTodo(id: number | string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM todos WHERE id = ${id}`;
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
