import { SetMetadata } from '@nestjs/common';

// public 인증 데코레이터
export const Public = () => SetMetadata('isPublic', true);
