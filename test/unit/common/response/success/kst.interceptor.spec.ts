import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { KstInterceptor } from '../../../../../src/common/response/success/kst.interceptor';

describe('KstInterceptor', () => {
  const interceptor = new KstInterceptor();
  const run = (body: unknown) =>
    lastValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        { handle: () => of(body) } as CallHandler,
      ),
    );

  it('중첩 객체·배열 안의 Date를 모두 변환하고 다른 값은 유지한다', async () => {
    const deadline = new Date('2026-10-20T14:59:00.000Z');
    await expect(
      run({
        message: '조회 성공',
        data: {
          id: 1,
          deadline,
          subtasks: [{ deadline, done: false }],
          memo: null,
        },
      }),
    ).resolves.toEqual({
      message: '조회 성공',
      data: {
        id: 1,
        deadline: '2026-10-20T23:59:00.000+09:00',
        subtasks: [{ deadline: '2026-10-20T23:59:00.000+09:00', done: false }],
        memo: null,
      },
    });
  });

  it('원본 객체는 수정하지 않는다', async () => {
    const deadline = new Date('2026-10-20T14:59:00.000Z');
    const data = { deadline };
    await run({ message: '조회 성공', data });
    expect(data.deadline).toBe(deadline);
  });

  it('Invalid Date는 null로 바꾼다', async () => {
    await expect(run({ at: new Date('invalid') })).resolves.toEqual({
      at: null,
    });
  });

  it('Response DTO 클래스 인스턴스 안의 Date도 변환한다', async () => {
    class TaskResponseDto {
      id = 1;
      deadline = new Date('2026-10-20T14:59:00.000Z');
    }
    await expect(run(new TaskResponseDto())).resolves.toEqual({
      id: 1,
      deadline: '2026-10-20T23:59:00.000+09:00',
    });
  });

  it('파일·바이너리·컬렉션은 그대로 둔다', async () => {
    const file = new StreamableFile(Buffer.from('file'));
    const buffer = Buffer.from('raw');
    const map = new Map([['a', 1]]);
    await expect(run(file)).resolves.toBe(file);
    await expect(run({ buffer, map })).resolves.toEqual({ buffer, map });
    const result = (await run({ buffer })) as { buffer: Buffer };
    expect(result.buffer).toBe(buffer);
  });
});
