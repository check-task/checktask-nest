import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SuccessCode } from './success-code';

// 컨트롤러가 반환한 { message, data }를 { resultType: 'SUCCESS', message, data }로 감싼다.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (body && typeof body === 'object' && 'message' in body) {
          const { message, data } = body as { message: string; data?: unknown };
          return { resultType: 'SUCCESS', message, data: data ?? null };
        }
        // { message } 형태가 아닌 반환값(undefined·문자열·객체 등)도 500 없이 기본 메시지로 감싼다
        return {
          resultType: 'SUCCESS',
          message: SuccessCode.OK.message,
          data: body ?? null,
        };
      }),
    );
  }
}
