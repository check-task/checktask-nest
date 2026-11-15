import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  /**
   * 로그인
   * 1. 사용자 조회 (password는 select: false이므로 명시적으로 선택)
   * 2. bcrypt.compare로 비밀번호 검증
   *    실패 시 CustomException(ErrorCode.UNAUTHORIZED) — 아이디/비밀번호 중 무엇이 틀렸는지 구분하지 않는다
   * 3. Access Token(1h, JWT_SECRET) + Refresh Token(7d, JWT_REFRESH_SECRET) 발급
   *    payload: { sub: userId, email }
   * 4. Refresh Token 해시 저장 (refresh-token.entity.ts 또는 Redis)
   * @throws CustomException(UNAUTHORIZED) - 사용자가 없거나 비밀번호가 틀렸을 때
   */
  /**
   * 토큰 재발급 (로테이션)
   * 1. JwtRefreshStrategy에서 검증된 userId 사용
   * 2. 새 Access·Refresh Token 발급
   * 3. 저장된 Refresh Token을 새 값으로 교체
   */
  /**
   * 로그아웃
   * - userId의 저장된 Refresh Token 삭제
   */
  /** 토큰 발급 공통 로직 (JwtService.signAsync 2회) */
}
