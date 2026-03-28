import { SetMetadata } from '@nestjs/common';

export const ALLOW_INADIMPLENTE_ACCESS_KEY = 'allowInadimplenteAccess';
export const AllowInadimplenteAccess = () => SetMetadata(ALLOW_INADIMPLENTE_ACCESS_KEY, true);

