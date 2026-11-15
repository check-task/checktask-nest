import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login — 로그인
   * - @Public()
   * - body: LoginDto
   * - Refresh Token은 쿠키로 설정: httpOnly / secure / sameSite: 'strict' / maxAge 7일
   * - return { message: '로그인 성공', data: { accessToken } }
   */

  /**
   * POST /auth/refresh — 토큰 재발급
   * - @Public() + @UseGuards(JwtRefreshGuard)
   * - Access·Refresh Token 모두 새로 발급하고 기존 Refresh Token은 폐기한다. (로테이션)
   * - return { message: '토큰 재발급 성공', data: { accessToken } }
   */

  /**
   * POST /auth/logout — 로그아웃
   * - 전역 JwtAuthGuard 적용 (@CurrentUser())
   * - 저장된 Refresh Token 삭제 + 쿠키 제거
   * - return { message: '로그아웃 성공' }
   */
}
