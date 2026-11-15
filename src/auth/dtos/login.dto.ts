/**
 * 로그인 요청 DTO
 *
 * TODO: 로그인 방식(이메일·비밀번호 / 소셜) 확정 후 필드 작성
 *
 * [예상 필드]
 * - email: string     @IsEmail()            @ApiProperty({ example: 'user@example.com' })
 * - password: string  @IsString() @IsNotEmpty()  @ApiProperty({ example: 'password1234' })
 *
 * [응답]
 * - Access Token은 응답 body(data.accessToken)로 내려준다.
 * - Refresh Token은 body에 담지 않고 httpOnly 쿠키로만 내려준다.
 */
