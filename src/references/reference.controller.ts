import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type UserPayload,
} from '../common/auth/decorators/current-user.decorator';
import { SUCCESS_CODE } from '../common/response/success/success-code';
import {
  CreateCommunicationDto,
  CreateLogDto,
  CreateReferenceDto,
  CreateReferenceQueryDto,
  GetReferenceUploadUrlDto,
  UpdateCommunicationDto,
  UpdateLogDto,
  UpdateReferenceDto,
} from './reference.dto';
import { ReferenceService } from './reference.service';

// 자료(Reference) 관련 API
@ApiTags('Reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Post('data/:taskId/upload-url')
  @HttpCode(SUCCESS_CODE.OK.status)
  @ApiOperation({ summary: '자료 파일 업로드 URL 발급' })
  async getReferenceUploadUrl(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: GetReferenceUploadUrlDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.getReferenceUploadUrl(
      taskId,
      user.id,
      dto,
    );
    return { message: '자료 파일 업로드 URL 발급 성공', data };
  }

  @Post('data/:taskId')
  @HttpCode(SUCCESS_CODE.OK.status) 
  @ApiOperation({ summary: '자료 생성 (링크 또는 파일)' })
  async createReferences(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CreateReferenceQueryDto,
    @Body() dto: CreateReferenceDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.createReferences(
      taskId,
      user.id,
      query.type,
      dto,
    );
    return { message: '자료 생성 성공', data };
  }

  @Patch('data/:taskId/:referenceId')
  @ApiOperation({ summary: '자료 수정' })
  async updateReference(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
    @Body() dto: UpdateReferenceDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.updateReference(
      taskId,
      referenceId,
      user.id,
      dto,
    );
    return { message: '자료 수정 성공', data };
  }

  @Delete('data/:taskId/:referenceId')
  @ApiOperation({ summary: '자료 삭제' })
  async deleteReference(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.deleteReference(
      taskId,
      referenceId,
      user.id,
    );
    return { message: '자료 삭제 성공', data };
  }

  // ===== 커뮤니케이션 =====

  @Post('communication/:taskId')
  @HttpCode(SUCCESS_CODE.OK.status) 
  @ApiOperation({ summary: '커뮤니케이션 생성' })
  async createCommunication(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommunicationDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.createCommunication(
      taskId,
      user.id,
      dto,
    );
    return { message: '커뮤니케이션 생성 성공', data };
  }

  @Patch('communication/:taskId/:communicationId')
  @ApiOperation({ summary: '커뮤니케이션 수정' })
  async updateCommunication(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('communicationId', ParseIntPipe) communicationId: number,
    @Body() dto: UpdateCommunicationDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.updateCommunication(
      taskId,
      communicationId,
      user.id,
      dto,
    );
    return { message: '커뮤니케이션 수정 성공', data };
  }

  @Delete('communication/:taskId/:communicationId')
  @ApiOperation({ summary: '커뮤니케이션 삭제' })
  async deleteCommunication(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('communicationId', ParseIntPipe) communicationId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.deleteCommunication(
      taskId,
      communicationId,
      user.id,
    );
    return { message: '커뮤니케이션 삭제 성공', data };
  }

  // ===== 회의록 =====

  @Post('log/:taskId')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '회의록 생성' })
  async createLog(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateLogDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.createLog(taskId, user.id, dto);
    return { message: '회의록 생성 성공', data };
  }

  @Patch('log/:taskId/:logId')
  @ApiOperation({ summary: '회의록 수정' })
  async updateLog(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('logId', ParseIntPipe) logId: number,
    @Body() dto: UpdateLogDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.updateLog(
      taskId,
      logId,
      user.id,
      dto,
    );
    return { message: '회의록 수정 성공', data };
  }

  @Delete('log/:taskId/:logId')
  @ApiOperation({ summary: '회의록 삭제' })
  async deleteLog(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('logId', ParseIntPipe) logId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.referenceService.deleteLog(taskId, logId, user.id);
    return { message: '회의록 삭제 성공', data };
  }
}
