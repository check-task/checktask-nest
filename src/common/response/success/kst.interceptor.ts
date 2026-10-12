import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Stream } from 'stream';
import { toKstString } from '../../utils/date.util';

// 일반 객체로 복사하면 깨지는 값 (파일·바이너리·스트림·컬렉션)은 그대로 둔다
const isPassThrough = (value: unknown): boolean =>
  value instanceof StreamableFile ||
  value instanceof Stream ||
  value instanceof ArrayBuffer ||
  ArrayBuffer.isView(value) || // Buffer·TypedArray
  value instanceof Map ||
  value instanceof Set;

// 객체(Response DTO 클래스 포함)·배열을 재귀적으로 순회하며 Date만 KST 문자열로 바꾼 새 값을 만든다 (원본은 수정하지 않음)
const convertDates = (value: unknown): unknown => {
  if (value instanceof Date) {
    // Invalid Date는 toISOString()이 예외를 던지므로 null로 응답한다
    return Number.isNaN(value.getTime()) ? null : toKstString(value);
  }
  if (Array.isArray(value)) return value.map(convertDates);
  if (isPassThrough(value)) return value;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, convertDates(v)]),
    );
  }
  return value;
};

/**
 * 응답의 모든 Date를 '+09:00' 오프셋 문자열(KST)로 변환하는 인터셉터.
 * 서버·DB는 UTC로 다루고, 응답으로 나갈 때만 KST로 맞춘다.
 * ResponseInterceptor보다 뒤에 등록해 KST 변환 후 래핑되게 한다. (응답 처리는 등록 역순)
 * @example app.useGlobalInterceptors(new ResponseInterceptor(), new KstInterceptor());
 */
@Injectable()
export class KstInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map(convertDates));
  }
}
