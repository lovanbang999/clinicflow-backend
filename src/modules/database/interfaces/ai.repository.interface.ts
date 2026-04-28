import { Prisma } from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';

export const I_AI_REPOSITORY = 'IAiRepository';

export interface IAiRepository {
  createAiChatSession<T extends Prisma.AiChatSessionCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionCreateArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>>;
  findFirstAiChatSession<T extends Prisma.AiChatSessionFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatSessionFindFirstArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T> | null>;
  findManyAiChatSession<T extends Prisma.AiChatSessionFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatSessionFindManyArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>[]>;
  findUniqueAiChatSession<T extends Prisma.AiChatSessionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionFindUniqueArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T> | null>;
  updateAiChatSession<T extends Prisma.AiChatSessionUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionUpdateArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>>;
  deleteAiChatSession<T extends Prisma.AiChatSessionDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionDeleteArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>>;

  createAiChatMessage<T extends Prisma.AiChatMessageCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageCreateArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>>;
  findFirstAiChatMessage<T extends Prisma.AiChatMessageFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatMessageFindFirstArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T> | null>;
  findManyAiChatMessage<T extends Prisma.AiChatMessageFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatMessageFindManyArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>[]>;
  findUniqueAiChatMessage<T extends Prisma.AiChatMessageFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageFindUniqueArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T> | null>;
  updateAiChatMessage<T extends Prisma.AiChatMessageUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageUpdateArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>>;
  deleteAiChatMessage<T extends Prisma.AiChatMessageDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageDeleteArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>>;

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
