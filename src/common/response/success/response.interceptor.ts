import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SUCCESS_CODE } from './success-code';

const ENVELOPE_KEYS = new Set(['message', 'data']);

/**
 * 컨트롤러가 반환한 { message, data } 형태인지 확인한다.
 * message가 문자열이고 message·data 외의 키가 없어야 한다.
 * (message 컬럼이 있는 엔티티를 그대로 반환해도 envelope로 오인하지 않게)
 */
const isEnvelope = (
  body: unknown,
): body is { message: string; data?: unknown } =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as { message?: unknown }).message === 'string' &&
  Object.keys(body).every((key) => ENVELOPE_KEYS.has(key));

// 컨트롤러가 반환한 { message, data }를 { resultType: 'SUCCESS', message, data }로 감싼다.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        // 파일 다운로드는 감싸지 않는다
        if (body instanceof StreamableFile) return body;
        // 이미 감싼 응답은 다시 감싸지 않는다
        if (typeof body === 'object' && body !== null && 'resultType' in body) {
          return body;
        }
        if (isEnvelope(body)) {
          return {
            resultType: 'SUCCESS',
            message: body.message,
            data: body.data ?? null,
          };
        }
        // { message, data } 형태가 아닌 반환값(undefined·문자열·엔티티 등)은 data로 보고 기본 메시지로 감싼다
        return {
          resultType: 'SUCCESS',
          message: SUCCESS_CODE.OK.message,
          data: body ?? null,
        };
      }),
    );
  }
}
