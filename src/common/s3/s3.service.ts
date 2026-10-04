import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

// Presigned URL 유효 시간 (5분)
const PRESIGNED_EXPIRES_IN = 300;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.client = new S3Client({
      region: config.getOrThrow('AWS_REGION'),
      // 키가 없으면 SDK 기본 자격 증명 체인(EC2 IAM Role 등)을 사용한다
      ...(accessKeyId &&
        secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
    });
    this.bucket = config.getOrThrow('AWS_S3_BUCKET');
  }

  /**
   * 클라이언트가 직접 업로드할 수 있는 Presigned URL을 발급한다.
   * 반환된 key를 DB에 저장하고, 조회 시 getDownloadUrl(key)로 URL을 발급한다.
   * @param dir 저장 경로 (예: 'profile', 'post')
   * @param fileName 원본 파일명 (확장자 추출용)
   * @param contentType 업로드 시 클라이언트가 같은 Content-Type 헤더를 보내야 서명이 일치한다
   */
  async getUploadUrl(dir: string, fileName: string, contentType: string) {
    // 원본 파일명은 덮어쓰기·경로 조작 방지를 위해 키에 쓰지 않는다
    const key = `${dir}/${randomUUID()}${extname(fileName).toLowerCase()}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_EXPIRES_IN,
    });
    return { key, url };
  }

  // 비공개 버킷의 파일을 조회할 수 있는 Presigned URL을 발급한다.
  getDownloadUrl(key: string) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_EXPIRES_IN,
    });
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
