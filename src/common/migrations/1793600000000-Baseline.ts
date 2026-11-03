import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 베이스라인: 레거시(Express/Prisma) DB 스키마 전체.
 * 레거시 prisma/migrations 9개(20260406_init ~ 20260809_add_sub_task_assignee)를 적용한 최종 상태를
 * pg_dump --schema-only로 뽑은 것이다.
 * - 기존 DB(운영·개발, 이미 Prisma로 테이블이 있음): 아무것도 하지 않고 "실행됨"으로만 기록한다.
 * - 빈 DB: 전체 스키마를 만든다.
 */
const BASELINE_SQL = [
  `CREATE TYPE "AlarmType" AS ENUM (
      'TASK',
      'SUBTASK',
      'MEMBER',
      'NOTIFICATION',
      'OTHER'
  )`,
  `CREATE TYPE "DeviceType" AS ENUM (
      'WEB_CHROME',
      'WEB_SAFARI',
      'WEB_FIREFOX',
      'APP_IOS',
      'APP_ANDROID'
  )`,
  `CREATE TYPE "Provider" AS ENUM (
      'KAKAO',
      'APPLE'
  )`,
  `CREATE TYPE "Role" AS ENUM (
      'USER',
      'ADMIN'
  )`,
  `CREATE TYPE "SubTaskStatus" AS ENUM (
      'PENDING',
      'PROGRESS',
      'COMPLETED'
  )`,
  `CREATE TYPE "TaskStatus" AS ENUM (
      'PENDING',
      'PROGRESS',
      'COMPLETED'
  )`,
  `CREATE TYPE "TaskType" AS ENUM (
      'PERSONAL',
      'TEAM'
  )`,
  `CREATE TABLE "Comment" (
      comment_id integer NOT NULL,
      sub_task_id integer NOT NULL,
      user_id integer NOT NULL,
      content text NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE SEQUENCE "Comment_comment_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Comment_comment_id_seq" OWNED BY "Comment".comment_id`,
  `CREATE TABLE "Communication" (
      comu_id integer NOT NULL,
      task_id integer NOT NULL,
      name character varying(50) NOT NULL,
      url character varying(255) NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone
  )`,
  `CREATE SEQUENCE "Communication_comu_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Communication_comu_id_seq" OWNED BY "Communication".comu_id`,
  `CREATE TABLE "Folder" (
      folder_id integer NOT NULL,
      user_id integer NOT NULL,
      folder_title character varying(10) NOT NULL,
      color character varying(7) NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      rank integer DEFAULT 0 NOT NULL
  )`,
  `CREATE SEQUENCE "Folder_folder_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Folder_folder_id_seq" OWNED BY "Folder".folder_id`,
  `CREATE TABLE "Log" (
      log_id integer NOT NULL,
      task_id integer NOT NULL,
      date date NOT NULL,
      agenda text,
      conclusion text,
      discussion text,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone
  )`,
  `CREATE SEQUENCE "Log_log_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Log_log_id_seq" OWNED BY "Log".log_id`,
  `CREATE TABLE "Member" (
      member_id integer NOT NULL,
      user_id integer NOT NULL,
      task_id integer NOT NULL,
      folder_id integer,
      role boolean NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE SEQUENCE "Member_member_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Member_member_id_seq" OWNED BY "Member".member_id`,
  `CREATE TABLE "Reference" (
      data_id integer NOT NULL,
      task_id integer NOT NULL,
      name character varying(50) NOT NULL,
      url character varying(255),
      file_url character varying(255),
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone,
      file_name character varying(255)
  )`,
  `CREATE SEQUENCE "Reference_data_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Reference_data_id_seq" OWNED BY "Reference".data_id`,
  `CREATE TABLE "SubTask" (
      sub_task_id integer NOT NULL,
      task_id integer NOT NULL,
      title character varying(100) NOT NULL,
      end_date timestamp without time zone,
      status "SubTaskStatus" DEFAULT 'PENDING'::"SubTaskStatus" NOT NULL,
      is_alarm boolean DEFAULT true NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone
  )`,
  `CREATE TABLE "SubTaskAssignee" (
      sub_task_assignee_id integer NOT NULL,
      sub_task_id integer NOT NULL,
      member_id integer NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE SEQUENCE "SubTaskAssignee_sub_task_assignee_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "SubTaskAssignee_sub_task_assignee_id_seq" OWNED BY "SubTaskAssignee".sub_task_assignee_id`,
  `CREATE SEQUENCE "SubTask_sub_task_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "SubTask_sub_task_id_seq" OWNED BY "SubTask".sub_task_id`,
  `CREATE TABLE "Task" (
      task_id integer NOT NULL,
      title character varying(10) NOT NULL,
      deadline timestamp without time zone NOT NULL,
      type "TaskType" NOT NULL,
      status "TaskStatus" NOT NULL,
      is_alarm boolean DEFAULT true NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone,
      invite_code character varying(50),
      invite_expired timestamp without time zone
  )`,
  `CREATE TABLE "TaskPriority" (
      priority_id integer NOT NULL,
      user_id integer NOT NULL,
      task_id integer NOT NULL,
      rank integer NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone
  )`,
  `CREATE SEQUENCE "TaskPriority_priority_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "TaskPriority_priority_id_seq" OWNED BY "TaskPriority".priority_id`,
  `CREATE SEQUENCE "Task_task_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "Task_task_id_seq" OWNED BY "Task".task_id`,
  `CREATE TABLE "User" (
      user_id integer NOT NULL,
      nickname character varying(30) NOT NULL,
      phone_num character varying(20) NOT NULL,
      email character varying(50) NOT NULL,
      profile_image character varying(200),
      password character varying(255),
      role "Role" DEFAULT 'USER'::"Role" NOT NULL,
      provider "Provider",
      provider_id character varying(100),
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone,
      deleted_at timestamp without time zone
  )`,
  `CREATE TABLE "UserAgreement" (
      agreement_id integer NOT NULL,
      user_id integer NOT NULL,
      terms_agreed_at date NOT NULL,
      push_updated_at date,
      is_push boolean DEFAULT false NOT NULL,
      third_party_updated_at date,
      is_third_party boolean DEFAULT false NOT NULL,
      marketing_updated_at date,
      is_marketing boolean DEFAULT false NOT NULL
  )`,
  `CREATE SEQUENCE "UserAgreement_agreement_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "UserAgreement_agreement_id_seq" OWNED BY "UserAgreement".agreement_id`,
  `CREATE TABLE "UserAlarm" (
      alarm_id integer NOT NULL,
      user_id integer NOT NULL,
      task_id integer,
      sub_task_id integer,
      title character varying(50) NOT NULL,
      alarm_content character varying(50) NOT NULL,
      is_read boolean DEFAULT false NOT NULL,
      alarm_date timestamp without time zone NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      type "AlarmType"
  )`,
  `CREATE TABLE "UserAlarmSetting" (
      user_alarm_id integer NOT NULL,
      user_id integer NOT NULL,
      deadline_alarm integer DEFAULT 24 NOT NULL,
      task_alarm integer DEFAULT 24 NOT NULL
  )`,
  `CREATE SEQUENCE "UserAlarmSetting_user_alarm_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "UserAlarmSetting_user_alarm_id_seq" OWNED BY "UserAlarmSetting".user_alarm_id`,
  `CREATE SEQUENCE "UserAlarm_alarm_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "UserAlarm_alarm_id_seq" OWNED BY "UserAlarm".alarm_id`,
  `CREATE TABLE "UserDevice" (
      device_id integer NOT NULL,
      user_id integer NOT NULL,
      fcm_token character varying(255) NOT NULL,
      device_type "DeviceType" NOT NULL,
      is_active boolean NOT NULL,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp without time zone
  )`,
  `CREATE SEQUENCE "UserDevice_device_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "UserDevice_device_id_seq" OWNED BY "UserDevice".device_id`,
  `CREATE SEQUENCE "User_user_id_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1`,
  `ALTER SEQUENCE "User_user_id_seq" OWNED BY "User".user_id`,
  `ALTER TABLE ONLY "Comment" ALTER COLUMN comment_id SET DEFAULT nextval('"Comment_comment_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Communication" ALTER COLUMN comu_id SET DEFAULT nextval('"Communication_comu_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Folder" ALTER COLUMN folder_id SET DEFAULT nextval('"Folder_folder_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Log" ALTER COLUMN log_id SET DEFAULT nextval('"Log_log_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Member" ALTER COLUMN member_id SET DEFAULT nextval('"Member_member_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Reference" ALTER COLUMN data_id SET DEFAULT nextval('"Reference_data_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "SubTask" ALTER COLUMN sub_task_id SET DEFAULT nextval('"SubTask_sub_task_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "SubTaskAssignee" ALTER COLUMN sub_task_assignee_id SET DEFAULT nextval('"SubTaskAssignee_sub_task_assignee_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Task" ALTER COLUMN task_id SET DEFAULT nextval('"Task_task_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "TaskPriority" ALTER COLUMN priority_id SET DEFAULT nextval('"TaskPriority_priority_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "User" ALTER COLUMN user_id SET DEFAULT nextval('"User_user_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "UserAgreement" ALTER COLUMN agreement_id SET DEFAULT nextval('"UserAgreement_agreement_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "UserAlarm" ALTER COLUMN alarm_id SET DEFAULT nextval('"UserAlarm_alarm_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "UserAlarmSetting" ALTER COLUMN user_alarm_id SET DEFAULT nextval('"UserAlarmSetting_user_alarm_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "UserDevice" ALTER COLUMN device_id SET DEFAULT nextval('"UserDevice_device_id_seq"'::regclass)`,
  `ALTER TABLE ONLY "Comment"
      ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (comment_id)`,
  `ALTER TABLE ONLY "Communication"
      ADD CONSTRAINT "Communication_pkey" PRIMARY KEY (comu_id)`,
  `ALTER TABLE ONLY "Folder"
      ADD CONSTRAINT "Folder_pkey" PRIMARY KEY (folder_id)`,
  `ALTER TABLE ONLY "Log"
      ADD CONSTRAINT "Log_pkey" PRIMARY KEY (log_id)`,
  `ALTER TABLE ONLY "Member"
      ADD CONSTRAINT "Member_pkey" PRIMARY KEY (member_id)`,
  `ALTER TABLE ONLY "Reference"
      ADD CONSTRAINT "Reference_pkey" PRIMARY KEY (data_id)`,
  `ALTER TABLE ONLY "SubTaskAssignee"
      ADD CONSTRAINT "SubTaskAssignee_pkey" PRIMARY KEY (sub_task_assignee_id)`,
  `ALTER TABLE ONLY "SubTask"
      ADD CONSTRAINT "SubTask_pkey" PRIMARY KEY (sub_task_id)`,
  `ALTER TABLE ONLY "TaskPriority"
      ADD CONSTRAINT "TaskPriority_pkey" PRIMARY KEY (priority_id)`,
  `ALTER TABLE ONLY "Task"
      ADD CONSTRAINT "Task_pkey" PRIMARY KEY (task_id)`,
  `ALTER TABLE ONLY "UserAgreement"
      ADD CONSTRAINT "UserAgreement_pkey" PRIMARY KEY (agreement_id)`,
  `ALTER TABLE ONLY "UserAlarmSetting"
      ADD CONSTRAINT "UserAlarmSetting_pkey" PRIMARY KEY (user_alarm_id)`,
  `ALTER TABLE ONLY "UserAlarm"
      ADD CONSTRAINT "UserAlarm_pkey" PRIMARY KEY (alarm_id)`,
  `ALTER TABLE ONLY "UserDevice"
      ADD CONSTRAINT "UserDevice_pkey" PRIMARY KEY (device_id)`,
  `ALTER TABLE ONLY "User"
      ADD CONSTRAINT "User_pkey" PRIMARY KEY (user_id)`,
  `CREATE UNIQUE INDEX "Member_user_id_task_id_key" ON "Member" USING btree (user_id, task_id)`,
  `CREATE UNIQUE INDEX "SubTaskAssignee_sub_task_id_member_id_key" ON "SubTaskAssignee" USING btree (sub_task_id, member_id)`,
  `CREATE UNIQUE INDEX "TaskPriority_user_id_task_id_key" ON "TaskPriority" USING btree (user_id, task_id)`,
  `CREATE UNIQUE INDEX "UserAgreement_user_id_key" ON "UserAgreement" USING btree (user_id)`,
  `CREATE UNIQUE INDEX "UserAlarmSetting_user_id_key" ON "UserAlarmSetting" USING btree (user_id)`,
  `CREATE UNIQUE INDEX "UserDevice_user_id_device_type_key" ON "UserDevice" USING btree (user_id, device_type)`,
  `CREATE INDEX "User_deleted_at_idx" ON "User" USING btree (deleted_at)`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree (email)`,
  `CREATE UNIQUE INDEX "User_provider_provider_id_key" ON "User" USING btree (provider, provider_id)`,
  `CREATE UNIQUE INDEX "User_user_id_key" ON "User" USING btree (user_id)`,
  `ALTER TABLE ONLY "Comment"
      ADD CONSTRAINT "Comment_sub_task_id_fkey" FOREIGN KEY (sub_task_id) REFERENCES "SubTask"(sub_task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "Comment"
      ADD CONSTRAINT "Comment_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "Communication"
      ADD CONSTRAINT "Communication_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "Folder"
      ADD CONSTRAINT "Folder_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "Log"
      ADD CONSTRAINT "Log_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "Member"
      ADD CONSTRAINT "Member_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES "Folder"(folder_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "Member"
      ADD CONSTRAINT "Member_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "Member"
      ADD CONSTRAINT "Member_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "Reference"
      ADD CONSTRAINT "Reference_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "SubTaskAssignee"
      ADD CONSTRAINT "SubTaskAssignee_member_id_fkey" FOREIGN KEY (member_id) REFERENCES "Member"(member_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "SubTaskAssignee"
      ADD CONSTRAINT "SubTaskAssignee_sub_task_id_fkey" FOREIGN KEY (sub_task_id) REFERENCES "SubTask"(sub_task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "SubTask"
      ADD CONSTRAINT "SubTask_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "TaskPriority"
      ADD CONSTRAINT "TaskPriority_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "TaskPriority"
      ADD CONSTRAINT "TaskPriority_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "UserAgreement"
      ADD CONSTRAINT "UserAgreement_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "UserAlarmSetting"
      ADD CONSTRAINT "UserAlarmSetting_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "UserAlarm"
      ADD CONSTRAINT "UserAlarm_sub_task_id_fkey" FOREIGN KEY (sub_task_id) REFERENCES "SubTask"(sub_task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "UserAlarm"
      ADD CONSTRAINT "UserAlarm_task_id_fkey" FOREIGN KEY (task_id) REFERENCES "Task"(task_id) ON UPDATE CASCADE ON DELETE CASCADE`,
  `ALTER TABLE ONLY "UserAlarm"
      ADD CONSTRAINT "UserAlarm_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `ALTER TABLE ONLY "UserDevice"
      ADD CONSTRAINT "UserDevice_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON UPDATE CASCADE ON DELETE CASCADE`,
];

export class Baseline1793600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 이미 Prisma로 만든 DB면 건너뛴다
    if (await queryRunner.hasTable('User')) return;

    for (const sql of BASELINE_SQL) {
      await queryRunner.query(sql);
    }
  }

  public async down(): Promise<void> {
    // 되돌리면 모든 테이블·데이터가 지워지므로 막는다
    throw new Error('베이스라인 마이그레이션은 되돌릴 수 없습니다.');
  }
}
