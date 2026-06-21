import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ChatModule, UsersModule, AuthModule, RedisModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
