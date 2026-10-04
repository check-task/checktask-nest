/**
 * 공통 enum 모음
 *
 * - 여러 도메인에서 함께 쓰는 enum만 이곳에 둔다. (한 도메인 전용 enum은 해당 도메인 폴더에 둔다)
 * - 파일명: `{이름}.enum.ts` (예: role.enum.ts, task-status.enum.ts)
 * - 값은 DB·응답에 그대로 저장/노출되므로 문자열 enum을 사용한다. (숫자 enum은 순서가 바뀌면 기존 데이터가 깨진다)
 * - 엔티티 컬럼: @Column({ type: 'enum', enum: {Enum이름} })
 * - DTO 검증: @IsEnum({Enum이름}) + @ApiProperty({ enum: {Enum이름} })
 * - 새 enum을 만들면 이 파일에서 re-export 해 `common/enums`로 한 번에 import 한다.
 */
