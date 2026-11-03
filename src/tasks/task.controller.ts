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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type UserPayload,
} from '../common/auth/decorators/current-user.decorator';
import { SUCCESS_CODE } from '../common/response/success/success-code';
import {
  CompletedTasksResponseDto,
  ConvertTaskResponseDto,
  CreatedSubTaskResponseDto,
  CreateSubTaskDto,
  CreateTaskDto,
  DeletedAllSubTasksResponseDto,
  DeletedSubTasksResponseDto,
  DeleteSubTasksDto,
  GetCompletedTasksQueryDto,
  GetTasksQueryDto,
  InviteCodeResponseDto,
  JoinTaskDto,
  JoinTaskResponseDto,
  LeaveTaskResponseDto,
  MemberProfileResponseDto,
  MemberRoleResponseDto,
  RemovedMemberResponseDto,
  SetSubTaskAssigneeDto,
  SubTaskAssigneesResponseDto,
  SubTaskDeadlineResponseDto,
  SubTaskStatusResponseDto,
  TaskDeadlineResponseDto,
  TaskDetailResponseDto,
  TaskIdResponseDto,
  TaskListResponseDto,
  TaskMembersResponseDto,
  CheckTaskTypeQueryDto,
  UpdatedSubTaskResponseDto,
  UpdateMemberRoleDto,
  UpdateSubTaskDeadlineDto,
  UpdateSubTasksDto,
  UpdateSubTaskStatusDto,
  UpdateTaskDeadlineDto,
  UpdateTaskDto,
  UpdateTaskPrioritiesDto,
} from './task.dto';
import { TaskService } from './task.service';

// 레거시 경로(/api/v1/task/...)를 그대로 유지한다.
// 고정 경로(completed, priority, join, subtask/...)를 :taskId보다 먼저 선언해야 :taskId로 잡히지 않는다.
@ApiTags('Task')
@ApiBearerAuth()
@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('completed')
  @ApiOperation({ summary: '완료(마감 지난) 과제 조회' })
  @ApiOkResponse({ type: CompletedTasksResponseDto })
  async getCompletedTasks(
    @Query() query: GetCompletedTasksQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.getCompletedTasks(query, user.id);
    return { message: '완료된 과제 조회 성공', data };
  }

  @Post()
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '과제 생성' })
  @ApiOkResponse({ type: TaskIdResponseDto })
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.createTask(dto, user.id);
    return {
      message: '요청이 처리되어서 새로운 과제가 생성되었습니다.',
      data,
    };
  }

  @Patch('priority')
  @ApiOperation({ summary: '과제 우선순위 일괄 변경' })
  async updateTaskPriorities(
    @Body() dto: UpdateTaskPrioritiesDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateTaskPriorities(dto, user.id);
    return { message: '과제 우선순위가 일괄 변경되었습니다.', data };
  }

  @Post('join')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '초대 코드로 팀 과제 참여' })
  @ApiOkResponse({ type: JoinTaskResponseDto })
  async joinTaskByInviteCode(
    @Body() dto: JoinTaskDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.joinTaskByInviteCode(dto, user.id);
    return { message: '팀에 성공적으로 참여했습니다.', data };
  }

  @Patch('subtask/:subTaskId/status')
  @ApiOperation({ summary: '세부 과제 완료 여부 변경' })
  @ApiOkResponse({ type: SubTaskStatusResponseDto })
  async updateSubTaskStatus(
    @Param('subTaskId', ParseIntPipe) subTaskId: number,
    @Body() dto: UpdateSubTaskStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateSubTaskStatus(
      subTaskId,
      dto,
      user.id,
    );
    return { message: '태스크 상태가 업데이트되었습니다.', data };
  }

  @Patch('subtask/:subTaskId/deadline')
  @ApiOperation({ summary: '세부 과제 마감일 변경' })
  @ApiOkResponse({ type: SubTaskDeadlineResponseDto })
  async updateSubTaskDeadline(
    @Param('subTaskId', ParseIntPipe) subTaskId: number,
    @Body() dto: UpdateSubTaskDeadlineDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateSubTaskDeadline(
      subTaskId,
      dto,
      user.id,
    );
    return { message: '마감 기한이 변경되었습니다.', data };
  }

  @Patch('subtask/:subTaskId/assignee')
  @ApiOperation({ summary: '세부 과제 담당자 지정·해제' })
  @ApiOkResponse({ type: SubTaskAssigneesResponseDto })
  async setSubTaskAssignee(
    @Param('subTaskId', ParseIntPipe) subTaskId: number,
    @Body() dto: SetSubTaskAssigneeDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.setSubTaskAssignee(
      subTaskId,
      dto,
      user.id,
    );
    return { message: '담당자가 지정되었습니다.', data };
  }

  @Get()
  @ApiOperation({ summary: '과제 목록 조회' })
  @ApiOkResponse({ type: TaskListResponseDto })
  async getTasks(
    @Query() query: GetTasksQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.getTasks(query, user.id);
    return { message: '서버가 요청을 성공적으로 처리하였습니다.', data };
  }

  @Patch(':taskId')
  @ApiOperation({ summary: '과제 수정 (제목·마감일·내 폴더)' })
  @ApiOkResponse({ type: TaskIdResponseDto })
  async updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateTask(
      taskId,
      dto,
      user.id,
      query.type,
    );
    return { message: '과제가 성공적으로 수정되었습니다.', data };
  }

  @Patch(':taskId/convert-to-team')
  @ApiOperation({ summary: '개인 과제 → 팀 과제 변경' })
  @ApiOkResponse({ type: ConvertTaskResponseDto })
  async convertTaskToTeam(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.convertTaskToTeam(taskId, user.id);
    return {
      message: '과제가 팀 과제로 성공적으로 변경되었습니다.',
      data,
    };
  }

  @Get(':taskId')
  @ApiOperation({ summary: '과제 상세 조회' })
  @ApiOkResponse({ type: TaskDetailResponseDto })
  async getTaskDetail(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.getTaskDetail(
      taskId,
      user.id,
      query.type,
    );
    return { message: '서버가 요청을 성공적으로 처리하였습니다.', data };
  }

  @Patch(':taskId/member/:targetUserId')
  @ApiOperation({ summary: '팀원 권한 변경 (소유자만)' })
  @ApiOkResponse({ type: MemberRoleResponseDto })
  async updateMemberRole(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateMemberRole(
      taskId,
      targetUserId,
      dto,
      user.id,
      query.type,
    );
    return { message: '멤버 권한이 변경되었습니다.', data };
  }

  @Delete(':taskId/member/:userId')
  @ApiOperation({ summary: '팀원 추방 (소유자만)' })
  @ApiOkResponse({ type: RemovedMemberResponseDto })
  async deleteTeamMember(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.deleteTeamMember(
      taskId,
      targetUserId,
      user.id,
      query.type,
    );
    return { message: `userId: ${targetUserId}가 추방되었습니다.`, data };
  }

  @Post(':taskId/subtask')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '세부 과제 추가' })
  @ApiOkResponse({ type: CreatedSubTaskResponseDto })
  async createSubTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: CreateSubTaskDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.createSubTask(
      taskId,
      dto,
      user.id,
      query.type,
    );
    return { message: '세부 Task가 성공적으로 추가되었습니다.', data };
  }

  @Patch(':taskId/subtask')
  @ApiOperation({ summary: '세부 과제 여러 개 수정' })
  @ApiOkResponse({ type: [UpdatedSubTaskResponseDto] })
  async updateSubTasks(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: UpdateSubTasksDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateSubTasks(
      taskId,
      dto,
      user.id,
      query.type,
    );
    return { message: '세부 Task가 성공적으로 수정되었습니다.', data };
  }

  @Delete(':taskId/subtask/all')
  @ApiOperation({ summary: '세부 과제 전체 삭제' })
  @ApiOkResponse({ type: DeletedAllSubTasksResponseDto })
  async deleteAllSubTasks(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.deleteAllSubTasks(
      taskId,
      user.id,
      query.type,
    );
    return {
      message: '선택한 과제에 대한 세부 과제가 삭제되었습니다.',
      data,
    };
  }

  @Delete(':taskId/subtask')
  @ApiOperation({ summary: '선택한 세부 과제 삭제' })
  @ApiOkResponse({ type: DeletedSubTasksResponseDto })
  async deleteSubTasks(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: DeleteSubTasksDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.deleteSubTasks(
      taskId,
      dto,
      user.id,
      query.type,
    );
    return { message: '선택한 세부 과제들이 삭제되었습니다.', data };
  }

  @Patch(':taskId/deadline')
  @ApiOperation({ summary: '과제 마감일 변경' })
  @ApiOkResponse({ type: TaskDeadlineResponseDto })
  async updateTaskDeadline(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @Body() dto: UpdateTaskDeadlineDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.updateTaskDeadline(
      taskId,
      dto,
      user.id,
      query.type,
    );
    return { message: 'Task 마감일이 성공적으로 변경되었습니다.', data };
  }

  @Post(':taskId/invitation')
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
  @ApiOperation({ summary: '팀 과제 초대 코드 발급' })
  @ApiOkResponse({ type: InviteCodeResponseDto })
  async generateInviteCode(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: CheckTaskTypeQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.generateInviteCode(
      taskId,
      user.id,
      query.type,
    );
    return { message: '초대 링크가 생성되었습니다.', data };
  }

  @Get(':taskId/members')
  @ApiOperation({ summary: '과제 참여자 목록' })
  @ApiOkResponse({ type: TaskMembersResponseDto })
  async getTaskMembers(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.getTaskMembers(taskId, user.id);
    return { message: '팀원 목록 조회에 성공했습니다.', data };
  }

  @Delete(':taskId')
  @ApiOperation({
    summary: '과제 삭제 또는 나가기',
    description: '소유자면 과제 전체를 삭제하고, 팀원이면 본인만 나갑니다.',
  })
  @ApiOkResponse({ type: LeaveTaskResponseDto })
  async deleteTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.deleteTask(taskId, user.id);
    return { message: '멤버가 삭제되었습니다.', data };
  }

  @Get(':taskId/members/:userId')
  @ApiOperation({ summary: '팀원 프로필 조회' })
  @ApiOkResponse({ type: MemberProfileResponseDto })
  async getMemberProfile(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: UserPayload,
  ) {
    const data = await this.taskService.getMemberProfile(
      taskId,
      targetUserId,
      user.id,
    );
    return { message: '팀원 프로필 조회에 성공했습니다.', data };
  }
}
