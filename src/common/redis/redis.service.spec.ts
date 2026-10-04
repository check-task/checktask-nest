import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// 실제 Redis 서버 없이 검증하기 위해 ioredis 클라이언트를 목으로 대체한다
const client = vi.hoisted(() => ({
  options: undefined as unknown,
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: class {
    constructor(options: unknown) {
      client.options = options;
      return client;
    }
  },
}));

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = new ConfigService({
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    });
    service = new RedisService(config);
  });

  it('환경변수로 접속하고, 빈 비밀번호는 undefined로 넘긴다', () => {
    expect(client.options).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
  });

  it('ttl을 주면 EX 옵션으로 만료 시간을 걸어 저장한다', async () => {
    await service.set('verify:01012345678', '123456', 600);
    expect(client.set).toHaveBeenCalledWith(
      'verify:01012345678',
      '123456',
      'EX',
      600,
    );
  });

  it('ttl이 없으면 만료 없이 저장한다', async () => {
    await service.set('key', 'value');
    expect(client.set).toHaveBeenCalledWith('key', 'value');
  });

  it('get은 저장된 값을, 없으면 null을 반환한다', async () => {
    client.get.mockResolvedValueOnce('123456').mockResolvedValueOnce(null);
    await expect(service.get('verify:01012345678')).resolves.toBe('123456');
    await expect(service.get('none')).resolves.toBeNull();
  });

  it('del은 키를 삭제한다', async () => {
    await service.del('verify:01012345678');
    expect(client.del).toHaveBeenCalledWith('verify:01012345678');
  });

  it('incr은 처음 생성된 키에만 만료 시간을 건다', async () => {
    client.incr.mockResolvedValueOnce(1);
    await expect(service.incr('sms:count:01012345678', 86400)).resolves.toBe(1);
    expect(client.expire).toHaveBeenCalledWith('sms:count:01012345678', 86400);
  });

  it('incr은 이미 있는 키의 만료 시간을 갱신하지 않는다', async () => {
    client.incr.mockResolvedValueOnce(3);
    await expect(service.incr('sms:count:01012345678', 86400)).resolves.toBe(3);
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('모듈 종료 시 연결을 닫는다', async () => {
    await service.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });
});
