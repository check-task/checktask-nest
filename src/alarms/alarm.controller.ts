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
  GetAlarmsQueryDto,
  RegisterDeviceDto,
  SendTestPushDto,
  UpdateAlarmReadStatusDto,
  UpdateAlarmStatusDto,
  UpdateDeadlineAlarmDto,
  UpdateTaskAlarmDto,
} from './alarm.dto';
import { AlarmService } from './alarm.service';

// 레거시 경로(/api/v1/alarm, 단수)를 그대로 쓴다
@ApiTags('Alarm')
@ApiBearerAuth()
@Controller('alarm')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Get()
  @ApiOperation({
    summary: '알림 목록 조회',
    description: '사용자의 알림 목록을 조회합니다.',
  })
  async getAlarms(
    @Query() query: GetAlarmsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.getAlarms(user.id, query);
    return { message: '알림 목록 조회 성공', data };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: '안읽은 알림 여부 반환',
    description: '안읽은 알림 여부를 반환합니다.',
  })
  async getUnreadAlarmCount(@CurrentUser() user: UserPayload) {
    const data = await this.alarmService.getUnreadAlarmCount(user.id);
    return { message: '안읽은 알림 개수 조회 성공', data };
  }

  @Delete()
  @ApiOperation({
    summary: '전체 알림 삭제',
    description: '사용자의 모든 알림을 삭제합니다.',
  })
  async deleteAllAlarms(@CurrentUser() user: UserPayload) {
    const data = await this.alarmService.deleteAllAlarms(user.id);
    return { message: '알림 전체 삭제 성공', data };
  }

  @Patch()
  @ApiOperation({
    summary: '모든 알림 읽음 처리',
    description: '모든 알림을 읽음으로 표시합니다.',
  })
  async updateAllAlarmReadStatus(@CurrentUser() user: UserPayload) {
    const data = await this.alarmService.updateAllAlarmReadStatus(user.id);
    return { message: '모든 알림 읽음 처리 성공', data };
  }

  @Patch('settings/deadline')
  @ApiOperation({
    summary: '최종 마감 알림 설정 수정',
    description: '사용자의 최종 마감 알림 전송 시간을 변경합니다.',
  })
  async updateDeadlineAlarm(
    @Body() dto: UpdateDeadlineAlarmDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.updateDeadlineAlarm(
      user.id,
      dto.deadlineAlarm,
    );
    return {
      message: '최종 마감 시간의 알림 전송 시간을 변경했습니다.',
      data,
    };
  }

  @Patch('settings/task')
  @ApiOperation({
    summary: '과제 마감 알림 설정 수정',
    description: '사용자의 과제 마감 알림 전송 시간을 변경합니다.',
  })
  async updateTaskAlarm(
    @Body() dto: UpdateTaskAlarmDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.updateTaskAlarm(
      user.id,
      dto.taskAlarm,
    );
    return {
      message: '과제 마감 시간의 알림 전송 시간을 변경했습니다.',
      data,
    };
  }

  @Patch('subtask/:subtaskId')
  @ApiOperation({
    summary: '세부과제 알림 여부 수정',
    description: '특정 세부과제의 알림 여부를 변경합니다.',
  })
  @ApiParam({ name: 'subtaskId', description: '세부과제 ID' })
  async updateSubTaskAlarmStatus(
    @Param('subtaskId', ParseIntPipe) subTaskId: number,
    @Body() dto: UpdateAlarmStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.updateSubTaskAlarmStatus(
      user.id,
      subTaskId,
      dto.isAlarm,
    );
    return { message: '세부과제에 대한 알림 여부를 변경하였습니다.', data };
  }

  @Patch('task/:taskId')
  @ApiOperation({
    summary: '과제 알림 여부 수정',
    description: '특정 과제의 알림 여부를 변경합니다.',
  })
  @ApiParam({ name: 'taskId', description: '과제 ID' })
  async updateTaskAlarmStatus(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateAlarmStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.updateTaskAlarmStatus(
      user.id,
      taskId,
      dto.isAlarm,
    );
    return { message: '과제에 대한 알림 여부를 변경하였습니다.', data };
  }

  @Post('device')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({
    summary: '모바일 디바이스 FCM 토큰 등록 및 갱신',
    description:
      '유저가 로그인하거나 앱을 구동할 때 발급받은 FCM 디바이스 토큰을 Redis에 저장 및 갱신합니다. (유효기간 30일)',
  })
  async registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.registerDevice(user.id, dto.fcmToken);
    return { message: '디바이스 토큰 등록 성공', data };
  }

  @Post('test')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({
    summary: '테스트 푸시 알림 즉시 발송',
    description:
      '로그인된 유저의 Redis에 저장된 FCM 토큰을 조회하여 푸시 알림을 테스트로 발송합니다.',
  })
  async sendTestPush(
    @Body() dto: SendTestPushDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.sendTestPush(
      user.id,
      dto.title,
      dto.body,
    );
    return { message: '테스트 알림 발송 성공', data };
  }

  @Delete(':alarmId')
  @ApiOperation({
    summary: '개별 알림 삭제',
    description: '특정 알림을 삭제합니다.',
  })
  @ApiParam({ name: 'alarmId', description: '알림 ID' })
  async deleteAlarm(
    @Param('alarmId', ParseIntPipe) alarmId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.deleteAlarm(user.id, alarmId);
    return { message: '개별 알림 삭제 성공', data };
  }

  @Patch(':alarmId')
  @ApiOperation({
    summary: '개별 알림 읽음 처리',
    description: '특정 알림을 읽음으로 표시합니다.',
  })
  @ApiParam({ name: 'alarmId', description: '알림 ID' })
  async updateAlarmReadStatus(
    @Param('alarmId', ParseIntPipe) alarmId: number,
    @Body() dto: UpdateAlarmReadStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.alarmService.updateAlarmReadStatus(
      user.id,
      alarmId,
      dto.isRead,
    );
    return { message: '알림 읽음 처리 성공', data };
  }
}
