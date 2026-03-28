import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestScope } from '../common/request-scope';

type AuthenticatedRequest = {
  user?: {
    role?: string;
    companyId?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  companyScopeId?: string;
};

@Injectable()
export class CompanyScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req?.user;

    if (!user?.companyId) {
      return next.handle();
    }

    const requestedScope = this.readHeader(req, 'x-company-scope');
    const selectedCompanyId = this.resolveCompanyScope(
      user.role || '',
      user.companyId,
      requestedScope,
    );

    req.companyScopeId = selectedCompanyId;

    return RequestScope.run({ companyId: selectedCompanyId }, () => next.handle());
  }

  private resolveCompanyScope(
    role: string,
    userCompanyId: string,
    requestedCompanyId?: string,
  ) {
    const requested = String(requestedCompanyId || '').trim();
    if (role === 'ADMIN') {
      if (!requested || requested === '__ALL__') {
        return undefined;
      }
      return requested;
    }

    if (!requested) return userCompanyId;

    if (requested !== userCompanyId) {
      throw new ForbiddenException('Escopo de empresa inválido para este usuário.');
    }

    return userCompanyId;
  }

  private readHeader(req: AuthenticatedRequest, key: string) {
    const value = req.headers?.[key] ?? req.headers?.[key.toLowerCase()];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }
}
