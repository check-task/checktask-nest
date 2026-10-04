import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { SuccessCode } from './success-code';

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
      message: SuccessCode.OK.message,
      data,
    });
  });
});
