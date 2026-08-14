import { prisma } from "@/lib/prisma";

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}
