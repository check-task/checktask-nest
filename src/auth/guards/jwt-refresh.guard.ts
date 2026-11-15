/**
 * Refresh Token 가드
 *
 * - AuthGuard('jwt-refresh')를 상속한다. (strategies/jwt-refresh.strategy.ts 사용)
 * - 재발급 API는 Access Token이 만료된 상태에서 호출되므로 @Public()으로 전역 JwtAuthGuard를 건너뛰고,
 *   이 가드를 @UseGuards(JwtRefreshGuard)로 붙인다.
 */
