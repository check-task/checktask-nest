/**
 * Refresh Token 저장 엔티티 (테이블: refresh_tokens)
 *
 * [컬럼]
 * - id: uuid (PK)
 * - userId: string — User 1명당 1개 (디바이스별 로그인 허용 시 deviceId 컬럼 추가)
 * - tokenHash: string — 원문이 아닌 해시값 저장 (DB 유출 대비), select: false
 * - expiresAt: Date — 7일
 * - createdAt / updatedAt
 *
 * [관계]
 * - User와 ManyToOne, onDelete: 'CASCADE' (User 엔티티 작성 후 연결)
 *
 * [대안]
 * - Redis에 `refresh:{userId}` 키로 TTL 7일 저장하면 만료 처리가 자동이라 엔티티가 필요 없다.
 *   DB / Redis 중 하나로 확정 후 이 파일 유지 여부를 결정한다.
 */
