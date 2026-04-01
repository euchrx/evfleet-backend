import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, PrismaService } from '../prisma/prisma.service';

type CreateAuditEntryInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  performedByUserId?: string | null;
  metadata?: Record<string, unknown>;
  client?: Prisma.TransactionClient | PrismaService;
  swallowErrors?: boolean;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createEntry(input: CreateAuditEntryInput) {
    const client = input.client ?? this.prisma;

    try {
      await client.auditLog.create({
        data: {
          id: randomUUID(),
          action: input.action,
          entity: input.entity,
          entityId: input.entityId || null,
          actorUserId: input.performedByUserId || null,
          metadata: (input.metadata || undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Falha ao registrar auditoria: ${this.getErrorMessage(error)}`,
      );

      if (!input.swallowErrors) {
        throw error;
      }
    }
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'erro desconhecido';
  }
}
