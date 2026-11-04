import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type UserPayload,
} from '../common/auth/decorators/current-user.decorator';
import { SUCCESS_CODE } from '../common/response/success/success-code';
import {
  CreateFolderDto,
  DeleteFolderQueryDto,
  UpdateFolderDto,
  UpdateFolderPriorityDto,
} from './folder.dto';
import { ParseFolderIdsPipe } from './folder.pipe';
import { FolderService } from './folder.service';

// 레거시 경로(/user/folder)를 유지한다
@ApiTags('Folder')
@ApiBearerAuth()
@Controller('user/folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '폴더 생성' })
  async createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.folderService.createFolder(user.id, dto);
    return { message: '폴더 생성 성공', data };
  }

  // ':folderId'보다 먼저 선언해야 'priority'가 folderId로 잡히지 않는다
  @Patch('priority')
  @ApiOperation({ summary: '폴더 순서 일괄 변경' })
  async updateFolderPriority(
    @Body() dto: UpdateFolderPriorityDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.folderService.updateFolderPriority(user.id, dto);
    return { message: '폴더 순서가 일괄 변경되었습니다.', data: null };
  }

  @Patch(':folderId')
  @ApiOperation({ summary: '폴더 수정' })
  async updateFolder(
    @Param('folderId', ParseIntPipe) folderId: number,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.folderService.updateFolder(user.id, folderId, dto);
    return { message: '폴더 수정 성공', data };
  }

  @Delete(':folderId')
  @ApiOperation({ summary: '폴더 삭제' })
  async deleteFolder(
    @Param('folderId', ParseIntPipe) folderId: number,
    @Query() query: DeleteFolderQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.folderService.deleteFolder(user.id, folderId, query.moveTasks);
    const message = query.moveTasks
      ? '과제 이동 및 폴더 삭제 성공'
      : '폴더 삭제 성공';
    return { message, data: null };
  }

  @Get(':folderId')
  @ApiOperation({ summary: '폴더 상세 조회 (과제·세부 과제 포함)' })
  @ApiParam({
    name: 'folderId',
    type: String,
    description: '쉼표로 구분한 폴더 ID (예: 1,2,3)',
  })
  async getFolderDetail(
    @Param('folderId', ParseFolderIdsPipe) folderIds: number[],
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.folderService.getFolderDetail(user.id, folderIds);
    return { message: '폴더 상세 정보 및 과제 목록 조회 성공', data };
  }
}
