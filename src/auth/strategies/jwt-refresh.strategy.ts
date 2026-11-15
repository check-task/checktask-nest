/**
 * Refresh Token 검증 전략 (passport-jwt, 이름: 'jwt-refresh')
 *
 * [역할]
 * - 재발급(POST /auth/refresh) API에서만 사용한다. 전역 Access Token 검증(common/auth)과 분리한다.
 *
 * [동작]
 * - 토큰 추출: Authorization 헤더가 아닌 쿠키(refreshToken)에서 꺼낸다. → cookie-parser 설치 필요
 * - 서명 검증: JWT_REFRESH_SECRET 사용 (Access Token과 다른 secret)
 * - validate(): payload.sub로 DB에 저장된 Refresh Token과 비교한다.
 *   저장된 값이 없거나 다르면(이미 로그아웃·재사용된 토큰) UnauthorizedException
 *   통과 시 { id, email, refreshToken }을 request.user에 담는다.
 */
