import { SetMetadata } from '@nestjs/common';

export const ALLOW_NO_PLAN_ACCESS_KEY = 'allowNoPlanAccess';
export const AllowNoPlanAccess = () =>
  SetMetadata(ALLOW_NO_PLAN_ACCESS_KEY, true);