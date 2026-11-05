import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type UserPayload,
} from '../common/auth/decorators/current-user.decorator';
import { SUCCESS_CODE } from '../common/response/success/success-code';
import { GetProfileImageUploadUrlDto, UpdateProfileDto } from './user.dto';
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '내 정보 조회' })
  async getMyInfo(@CurrentUser() user: UserPayload) {
    const data = await this.userService.getMyInfo(user.id);
    return { message: '내 정보 조회 성공', data };
  }

  @Post('profile/image-upload-url')
  @HttpCode(SUCCESS_CODE.OK.status)
  @ApiOperation({ summary: '프로필 이미지 업로드 URL 발급' })
  async getProfileImageUploadUrl(@Body() dto: GetProfileImageUploadUrlDto) {
    const data = await this.userService.getProfileImageUploadUrl(dto);
    return { message: '프로필 이미지 업로드 URL 발급 성공', data };
  }

  @Patch('profile')
  @ApiOperation({ summary: '프로필 수정' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.userService.updateProfile(user.id, dto);
    return { message: '프로필 수정 성공', data };
  }
}
