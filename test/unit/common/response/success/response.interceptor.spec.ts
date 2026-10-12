import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../../../../../src/common/response/success/response.interceptor';
import { SUCCESS_CODE } from '../../../../../src/common/response/success/success-code';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const run = (body: unknown) =>
    lastValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        {
          handle: () => of(body),
        } as CallHandler,
      ),
    );

  it('{ message, data }를 SUCCESS 응답으로 감싼다', async () => {
    await expect(
      run({ message: '생성 성공', data: { id: 1 } }),
    ).resolves.toEqual({
      resultType: 'SUCCESS',
      message: '생성 성공',
      data: { id: 1 },
    });
  });

  it('data 없이 { message }만 반환하면 data는 null이다', async () => {
    await expect(run({ message: '로그아웃 성공' })).resolves.toEqual({
      resultType: 'SUCCESS',
      message: '로그아웃 성공',
      data: null,
    });
  });

  it.each([
    ['undefined', undefined, null],
    ['null', null, null],
    ['문자열', 'ok', 'ok'],
    ['message 없는 객체', { id: 1 }, { id: 1 }],
    ['배열', [1, 2], [1, 2]],
  ])('%s를 반환해도 기본 메시지로 감싼다', async (_, body, data) => {
    await expect(run(body)).resolves.toEqual({
      resultType: 'SUCCESS',
      message: SUCCESS_CODE.OK.message,
      data,
    });
  });

  it('message 외 다른 필드가 있는 객체(엔티티 등)는 data로 감싼다', async () => {
    const alarm = { id: 1, message: '마감 1시간 전', isRead: false };
    await expect(run(alarm)).resolves.toEqual({
      resultType: 'SUCCESS',
      message: SUCCESS_CODE.OK.message,
      data: alarm,
    });
  });

  it('이미 resultType이 있는 응답은 다시 감싸지 않는다', async () => {
    const wrapped = { resultType: 'SUCCESS', message: '성공', data: null };
    await expect(run(wrapped)).resolves.toBe(wrapped);
  });

  it('StreamableFile은 감싸지 않는다', async () => {
    const file = new StreamableFile(Buffer.from('file'));
    await expect(run(file)).resolves.toBe(file);
  });
});
