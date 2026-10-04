import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

// S3Service를 전역 단일 클라이언트로 제공한다.
@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
